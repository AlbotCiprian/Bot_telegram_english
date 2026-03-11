import axios from "axios";
import { prisma } from "../db/client.js";
import { config, isConfigured } from "../utils/config.js";
import { logger } from "../utils/logger.js";

function parseOptionalId(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildCustomField(fieldId: string, value: string | number | null | undefined) {
  const parsedFieldId = parseOptionalId(fieldId);
  if (!parsedFieldId || value === null || value === undefined || value === "") {
    return null;
  }

  return {
    field_id: parsedFieldId,
    values: [{ value }],
  };
}

const kommoApi = axios.create({
  baseURL: `${config.kommoBaseUrl}/api/v4`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 20_000,
});

function getKommoHeaders() {
  if (!isConfigured(config.KOMMO_TOKEN)) {
    throw new Error("KOMMO_TOKEN nu este configurat.");
  }

  return {
    Authorization: `Bearer ${config.KOMMO_TOKEN}`,
  };
}

function sanitizeName(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildContactName(user: {
  firstName: string | null;
  lastName: string | null;
}) {
  const storedFirstName = sanitizeName(user.firstName);
  const storedLastName = sanitizeName(user.lastName);

  if (storedFirstName && storedLastName) {
    return {
      displayName: `${storedFirstName} ${storedLastName}`,
      firstName: storedFirstName,
      lastName: storedLastName,
    };
  }

  if (storedFirstName?.includes(" ")) {
    const [derivedFirstName, ...rest] = storedFirstName.split(" ");
    const derivedLastName = rest.join(" ").trim();

    return {
      displayName: storedFirstName,
      firstName: sanitizeName(derivedFirstName),
      lastName: sanitizeName(derivedLastName),
    };
  }

  return {
    displayName: storedFirstName ?? "Lead Telegram",
    firstName: storedFirstName,
    lastName: storedLastName,
  };
}

function extractLeadResponse(data: unknown): { leadId?: number; contactId?: number } {
  if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
    const lead = data[0] as { id?: number; contact_id?: number };
    return {
      leadId: typeof lead.id === "number" ? lead.id : undefined,
      contactId: typeof lead.contact_id === "number" ? lead.contact_id : undefined,
    };
  }

  if (data && typeof data === "object" && "_embedded" in data) {
    const embedded = (
      data as {
        _embedded?: {
          leads?: Array<{
            id?: number;
            _embedded?: {
              contacts?: Array<{ id?: number }>;
            };
          }>;
        };
      }
    )._embedded;
    const lead = embedded?.leads?.[0];
    return {
      leadId: typeof lead?.id === "number" ? lead.id : undefined,
      contactId: typeof lead?._embedded?.contacts?.[0]?.id === "number" ? lead._embedded.contacts[0].id : undefined,
    };
  }

  return {};
}

export async function createLeadInKommo(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new Error(`User ${userId} nu exista.`);
  }

  const contactName = buildContactName(user);

  const payload = [
    {
      name: `Telegram lead - ${contactName.displayName} - a inceput 3 lectii gratuite`,
      pipeline_id: parseOptionalId(config.KOMMO_PIPELINE_ID),
      status_id: parseOptionalId(config.KOMMO_STAGE_NEW_ID),
      tags_to_add: [
        { name: "telegram" },
        { name: "english-express" },
        { name: "free-lessons" },
        { name: `free-lesson-day-${Math.max(user.currentLessonDay, 1)}` },
      ],
      custom_fields_values: [
        buildCustomField(config.KOMMO_CUSTOM_FIELD_SOURCE, "telegram bot"),
        buildCustomField(config.KOMMO_CUSTOM_FIELD_CURRENT_LESSON, Math.max(user.currentLessonDay, 1)),
        buildCustomField(config.KOMMO_CUSTOM_FIELD_LAST_ACTIVITY, user.lastInteractionAt.toISOString()),
        buildCustomField(config.KOMMO_CUSTOM_FIELD_TELEGRAM_ID, user.telegramId.toString()),
        buildCustomField(config.KOMMO_CUSTOM_FIELD_TELEGRAM_USERNAME, user.username ?? ""),
        buildCustomField(config.KOMMO_CUSTOM_FIELD_ENGLISH_LEVEL, user.profile?.englishLevel ?? ""),
        buildCustomField(config.KOMMO_CUSTOM_FIELD_GOAL, user.profile?.goal ?? ""),
      ].filter(Boolean),
      _embedded: {
        contacts: [
          {
            name: contactName.displayName,
            ...(contactName.firstName ? { first_name: contactName.firstName } : {}),
            ...(contactName.lastName ? { last_name: contactName.lastName } : {}),
            custom_fields_values: [
              user.phone
                ? {
                    field_code: "PHONE",
                    values: [{ value: user.phone }],
                  }
                : null,
              user.email
                ? {
                    field_code: "EMAIL",
                    values: [{ value: user.email }],
                  }
                : null,
            ].filter(Boolean),
          },
        ],
      },
    },
  ];

  await prisma.crmSyncLog.create({
    data: {
      userId,
      action: "create_lead",
      status: "pending",
      requestPayload: payload,
    },
  });

  try {
    const response = await kommoApi.post("/leads/complex", payload, {
      headers: getKommoHeaders(),
    });

    const { leadId, contactId } = extractLeadResponse(response.data);

    await prisma.user.update({
      where: { id: userId },
      data: {
        kommoLeadId: leadId ? BigInt(leadId) : undefined,
        kommoContactId: contactId ? BigInt(contactId) : undefined,
      },
    });

    await prisma.crmSyncLog.create({
      data: {
        userId,
        action: "create_lead",
        status: "success",
        requestPayload: payload,
        responsePayload: response.data,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error({ err: error }, "Kommo create lead esuat.");
    await prisma.crmSyncLog.create({
      data: {
        userId,
        action: "create_lead",
        status: "failed",
        requestPayload: payload,
        errorMessage: message,
      },
    });
    throw error;
  }
}

export async function qualifyLeadInKommo(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new Error(`User ${userId} nu exista.`);
  }

  if (!user.kommoLeadId) {
    await createLeadInKommo(userId);
  }

  const refreshedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!refreshedUser?.kommoLeadId) {
    throw new Error("Lead-ul Kommo nu a putut fi creat inainte de calificare.");
  }

  const wantsConsultation = Boolean(refreshedUser.profile?.consultationWanted);
  const stageId = wantsConsultation
    ? parseOptionalId(config.KOMMO_STAGE_CONSULT_ID)
    : parseOptionalId(config.KOMMO_STAGE_WARM_ID);

  const patchPayload = [
    {
      id: Number(refreshedUser.kommoLeadId),
      pipeline_id: parseOptionalId(config.KOMMO_PIPELINE_ID),
      status_id: stageId,
    },
  ];

  const notePayload = [
    {
      entity_id: Number(refreshedUser.kommoLeadId),
      note_type: "common",
      params: {
        text: [
          "Actualizare din botul Telegram:",
          `Nivel: ${refreshedUser.profile?.englishLevel ?? "nesetat"}`,
          `Scop: ${refreshedUser.profile?.goal ?? "nesetat"}`,
          `Timp disponibil: ${refreshedUser.profile?.timeAvailable ?? "nesetat"}`,
          `Vrea contact: ${wantsConsultation ? "Da" : "Nu"}`,
        ].join("\n"),
      },
    },
  ];

  await prisma.crmSyncLog.create({
    data: {
      userId,
      action: "qualify_lead",
      status: "pending",
      requestPayload: {
        patchPayload,
        notePayload,
      },
    },
  });

  try {
    const [leadResponse, noteResponse] = await Promise.all([
      kommoApi.patch("/leads", patchPayload, { headers: getKommoHeaders() }),
      kommoApi.post("/leads/notes", notePayload, { headers: getKommoHeaders() }),
    ]);

    await prisma.crmSyncLog.create({
      data: {
        userId,
        action: "qualify_lead",
        status: "success",
        requestPayload: {
          patchPayload,
          notePayload,
        },
        responsePayload: {
          lead: leadResponse.data,
          notes: noteResponse.data,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error({ err: error }, "Kommo qualify lead esuat.");
    await prisma.crmSyncLog.create({
      data: {
        userId,
        action: "qualify_lead",
        status: "failed",
        requestPayload: {
          patchPayload,
          notePayload,
        },
        errorMessage: message,
      },
    });
    throw error;
  }
}
