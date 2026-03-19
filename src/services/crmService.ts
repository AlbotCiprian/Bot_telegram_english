import axios from "axios";
import { prisma } from "../db/client.js";
import { PUBLIC_ENTRY_LABELS, PublicEntryKey } from "../content/staticContent.js";
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

function resolveConfiguredStageId(primaryValue: string, fallbackValue: string): number | undefined {
  return parseOptionalId(primaryValue) ?? parseOptionalId(fallbackValue);
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveLeadIntent(firstRequestedService?: string) {
  if (!firstRequestedService) {
    return null;
  }

  const key = firstRequestedService as PublicEntryKey;
  const label = PUBLIC_ENTRY_LABELS[key] ?? firstRequestedService;
  return {
    key,
    label,
    tag: `intent-${slugify(key)}`,
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

export async function createLeadInKommo(userId: number, firstRequestedService?: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new Error(`User ${userId} nu există.`);
  }

  if (user.kommoLeadId) {
    logger.info({ userId, kommoLeadId: user.kommoLeadId.toString() }, "Lead-ul Kommo exista deja, sar peste create_lead.");
    return;
  }

  const contactName = buildContactName(user);
  const leadIntent = resolveLeadIntent(firstRequestedService);
  const leadNameSuffix =
    leadIntent?.key === "free_lessons"
      ? "a cerut 3 zile gratuite"
      : leadIntent
        ? `interes: ${leadIntent.label}`
        : "lead nou din bot";

  const payload = [
    {
      name: `Telegram lead - ${contactName.displayName} - ${leadNameSuffix}`,
      pipeline_id: parseOptionalId(config.KOMMO_PIPELINE_ID),
      status_id: parseOptionalId(config.KOMMO_STAGE_NEW_ID),
      tags_to_add: [
        { name: "telegram" },
        { name: "express-english-academy" },
        ...(leadIntent ? [{ name: leadIntent.tag }] : []),
        ...(leadIntent?.key === "free_lessons"
          ? [
              { name: "free-lessons" },
              { name: `free-lesson-day-${Math.max(user.currentLessonDay, 1)}` },
            ]
          : []),
      ],
      custom_fields_values: [
        buildCustomField(config.KOMMO_CUSTOM_FIELD_SOURCE, "telegram bot"),
        buildCustomField(
          config.KOMMO_CUSTOM_FIELD_CURRENT_LESSON,
          leadIntent?.key === "free_lessons" ? Math.max(user.currentLessonDay, 1) : 0,
        ),
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

    if (leadId && leadIntent) {
      try {
        await kommoApi.post(
          "/leads/notes",
          [
            {
              entity_id: leadId,
              note_type: "common",
              params: {
                text: `Primul serviciu ales în bot: ${leadIntent.label}`,
              },
            },
          ],
          { headers: getKommoHeaders() },
        );
      } catch (noteError) {
        logger.warn({ err: noteError, userId, leadId }, "Nu am putut salva nota internă Kommo pentru intenția inițială.");
      }
    }

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
    logger.error({ err: error }, "Kommo create lead eșuat.");
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

export async function requestConsultationInKommo(
  userId: number,
  params: {
    requestedService: "operator" | "career_astrology";
    priority: "urgent_contact" | "consultation";
    reason?: string | null;
    note?: string | null;
  },
): Promise<void> {
  const serviceLabel = PUBLIC_ENTRY_LABELS[params.requestedService] ?? params.requestedService;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new Error(`User ${userId} nu există.`);
  }

  if (!user.kommoLeadId) {
    await createLeadInKommo(userId, params.requestedService);
  }

  const refreshedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!refreshedUser?.kommoLeadId) {
    throw new Error("Lead-ul Kommo nu a putut fi creat înainte de request_consultation.");
  }

  const patchPayload = [
    {
      id: Number(refreshedUser.kommoLeadId),
      pipeline_id: parseOptionalId(config.KOMMO_PIPELINE_ID),
      status_id:
        params.priority === "urgent_contact"
          ? resolveConfiguredStageId(config.KOMMO_STAGE_URGENT_ID, config.KOMMO_STAGE_CONSULT_ID)
          : parseOptionalId(config.KOMMO_STAGE_CONSULT_ID),
    },
  ];

  const notePayload = [
    {
      entity_id: Number(refreshedUser.kommoLeadId),
      note_type: "common",
      params: {
        text: [
          "Cerere nouă din botul Telegram:",
          `Tip cerere: ${serviceLabel}`,
          `Prioritate: ${params.priority === "urgent_contact" ? "Urgent contact" : "Consultation Requested"}`,
          `Motiv: ${params.reason?.trim() || "nespecificat"}`,
          `Mesaj: ${params.note?.trim() || "fără mesaj suplimentar"}`,
          `Telefon: ${refreshedUser.phone ?? "nesetat"}`,
          `Telegram: ${refreshedUser.username ? `@${refreshedUser.username}` : refreshedUser.telegramId.toString()}`,
        ].join("\n"),
      },
    },
  ];

  await prisma.crmSyncLog.create({
    data: {
      userId,
      action: "request_consultation",
      status: "pending",
      requestPayload: {
        requestedService: params.requestedService,
        priority: params.priority,
        reason: params.reason ?? null,
        note: params.note ?? null,
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
        action: "request_consultation",
        status: "success",
        requestPayload: {
          requestedService: params.requestedService,
          priority: params.priority,
          reason: params.reason ?? null,
          note: params.note ?? null,
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
    logger.error({ err: error, userId, requestedService: params.requestedService }, "Kommo request consultation eșuat.");
    await prisma.crmSyncLog.create({
      data: {
        userId,
        action: "request_consultation",
        status: "failed",
        requestPayload: {
          requestedService: params.requestedService,
          priority: params.priority,
          reason: params.reason ?? null,
          note: params.note ?? null,
          patchPayload,
          notePayload,
        },
        errorMessage: message,
      },
    });
    throw error;
  }
}

export async function requestMarathonInterestInKommo(
  userId: number,
  params: {
    packageKey: "basic" | "silver" | "gold" | "premium" | "vip";
    packageLabel: string;
    cohortLabel: string;
    priceLabel: string;
  },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new Error(`User ${userId} nu există.`);
  }

  if (!user.kommoLeadId) {
    await createLeadInKommo(userId, "marathon");
  }

  const refreshedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!refreshedUser?.kommoLeadId) {
    throw new Error("Lead-ul Kommo nu a putut fi creat înainte de request_marathon_interest.");
  }

  const stageId = resolveConfiguredStageId(config.KOMMO_STAGE_MARATON_ID, config.KOMMO_STAGE_NEW_ID);
  if (!parseOptionalId(config.KOMMO_STAGE_MARATON_ID)) {
    logger.warn("KOMMO_STAGE_MARATON_ID lipseste. Folosesc fallback spre KOMMO_STAGE_NEW_ID pana este creat stage-ul dedicat.");
  }

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
          "Cerere nouă din botul Telegram:",
          "Tip cerere: Maraton de engleză",
          `Pachet: ${params.packageLabel}`,
          `Data de start: ${params.cohortLabel}`,
          `Preț: ${params.priceLabel}`,
          `Telefon: ${refreshedUser.phone ?? "nesetat"}`,
          `Telegram: ${refreshedUser.username ? `@${refreshedUser.username}` : refreshedUser.telegramId.toString()}`,
        ].join("\n"),
      },
    },
  ];

  await prisma.crmSyncLog.create({
    data: {
      userId,
      action: "request_marathon_interest",
      status: "pending",
      requestPayload: {
        packageKey: params.packageKey,
        packageLabel: params.packageLabel,
        cohortLabel: params.cohortLabel,
        priceLabel: params.priceLabel,
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
        action: "request_marathon_interest",
        status: "success",
        requestPayload: {
          packageKey: params.packageKey,
          packageLabel: params.packageLabel,
          cohortLabel: params.cohortLabel,
          priceLabel: params.priceLabel,
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
    logger.error({ err: error, userId, packageKey: params.packageKey }, "Kommo request marathon interest eșuat.");
    await prisma.crmSyncLog.create({
      data: {
        userId,
        action: "request_marathon_interest",
        status: "failed",
        requestPayload: {
          packageKey: params.packageKey,
          packageLabel: params.packageLabel,
          cohortLabel: params.cohortLabel,
          priceLabel: params.priceLabel,
          patchPayload,
          notePayload,
        },
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
    throw new Error(`User ${userId} nu există.`);
  }

  if (!user.kommoLeadId) {
    await createLeadInKommo(userId);
  }

  const refreshedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!refreshedUser?.kommoLeadId) {
    throw new Error("Lead-ul Kommo nu a putut fi creat înainte de calificare.");
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
    logger.error({ err: error }, "Kommo qualify lead eșuat.");
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
