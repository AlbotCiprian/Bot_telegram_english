import axios from "axios";
import { prisma } from "../db/client.js";
import {
  createLeadInKommo,
  qualifyLeadInKommo,
  requestConsultationInKommo,
  requestMarathonInterestInKommo,
} from "../services/crmService.js";
import { campaignQueue, crmQueue } from "../services/queue.js";
import { ensureProfile } from "../services/userService.js";
import { config } from "../utils/config.js";

function requireConfig(value: string, name: string) {
  if (!value.trim()) {
    throw new Error(`${name} lipseste.`);
  }
}

function parseStageId(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} este invalid.`);
  }
  return parsed;
}

const kommoApi = axios.create({
  baseURL: `${config.kommoBaseUrl}/api/v4`,
  headers: {
    Authorization: `Bearer ${config.KOMMO_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 20_000,
});

async function getLeadStatus(leadId: bigint): Promise<number | null> {
  const response = await kommoApi.get(`/leads/${leadId.toString()}`);
  return typeof response.data?.status_id === "number" ? response.data.status_id : null;
}

async function createAuditUser(label: string, telegramId: bigint) {
  const user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username: `audit_${label}_${telegramId.toString()}`,
      firstName: "Audit",
      lastName: label,
      phone: "+37368123456",
      leadFormCompleted: true,
      onboardingCompletedAt: new Date(),
      lastInteractionAt: new Date(),
    },
    update: {
      username: `audit_${label}_${telegramId.toString()}`,
      firstName: "Audit",
      lastName: label,
      phone: "+37368123456",
      leadFormCompleted: true,
      onboardingCompletedAt: new Date(),
      kommoLeadId: null,
      kommoContactId: null,
      lastInteractionAt: new Date(),
    },
  });

  await ensureProfile(user.id);
  await prisma.userProfile.update({
    where: { userId: user.id },
    data: {
      englishLevel: "Incepator",
      goal: "Job / cariera",
      consultationWanted: false,
    },
  });

  return user;
}

async function closeResources(): Promise<void> {
  await Promise.allSettled([campaignQueue.close(), crmQueue.close(), prisma.$disconnect()]);
}

async function main(): Promise<void> {
  requireConfig(config.KOMMO_TOKEN, "KOMMO_TOKEN");
  requireConfig(config.KOMMO_PIPELINE_ID, "KOMMO_PIPELINE_ID");
  requireConfig(config.KOMMO_STAGE_NEW_ID, "KOMMO_STAGE_NEW_ID");
  requireConfig(config.KOMMO_STAGE_WARM_ID, "KOMMO_STAGE_WARM_ID");
  requireConfig(config.KOMMO_STAGE_CONSULT_ID, "KOMMO_STAGE_CONSULT_ID");
  requireConfig(config.KOMMO_STAGE_URGENT_ID, "KOMMO_STAGE_URGENT_ID");

  const expectedNew = parseStageId(config.KOMMO_STAGE_NEW_ID, "KOMMO_STAGE_NEW_ID");
  const expectedWarm = parseStageId(config.KOMMO_STAGE_WARM_ID, "KOMMO_STAGE_WARM_ID");
  const expectedConsult = parseStageId(config.KOMMO_STAGE_CONSULT_ID, "KOMMO_STAGE_CONSULT_ID");
  const expectedUrgent = parseStageId(config.KOMMO_STAGE_URGENT_ID, "KOMMO_STAGE_URGENT_ID");
  const expectedMarathon = config.KOMMO_STAGE_MARATON_ID.trim()
    ? parseStageId(config.KOMMO_STAGE_MARATON_ID, "KOMMO_STAGE_MARATON_ID")
    : null;

  const baseId = BigInt(Date.now());
  const urgentUser = await createAuditUser("urgent", baseId);
  const consultUser = await createAuditUser("consult", baseId + 1n);
  const marathonUser = expectedMarathon ? await createAuditUser("marathon", baseId + 2n) : null;

  await createLeadInKommo(urgentUser.id, "free_lessons");
  const urgentLead = await prisma.user.findUniqueOrThrow({ where: { id: urgentUser.id } });
  if (!urgentLead.kommoLeadId) {
    throw new Error("Lead urgent nu a fost creat in Kommo.");
  }

  const newStage = await getLeadStatus(urgentLead.kommoLeadId);
  if (newStage !== expectedNew) {
    throw new Error(`Stage initial invalid pentru lead urgent. expected=${expectedNew} actual=${newStage}`);
  }

  await qualifyLeadInKommo(urgentUser.id);
  const warmStage = await getLeadStatus(urgentLead.kommoLeadId);
  if (warmStage !== expectedWarm) {
    throw new Error(`Stage warm invalid pentru lead urgent. expected=${expectedWarm} actual=${warmStage}`);
  }

  await requestConsultationInKommo(urgentUser.id, {
    requestedService: "operator",
    priority: "urgent_contact",
    reason: "Audit urgent contact",
    note: "Smoke test local urgent flow",
  });
  const urgentStage = await getLeadStatus(urgentLead.kommoLeadId);
  if (urgentStage !== expectedUrgent) {
    throw new Error(`Stage urgent invalid. expected=${expectedUrgent} actual=${urgentStage}`);
  }

  await createLeadInKommo(consultUser.id, "career_astrology");
  const consultLead = await prisma.user.findUniqueOrThrow({ where: { id: consultUser.id } });
  if (!consultLead.kommoLeadId) {
    throw new Error("Lead consult nu a fost creat in Kommo.");
  }

  await requestConsultationInKommo(consultUser.id, {
    requestedService: "career_astrology",
    priority: "consultation",
    reason: "Audit consult",
    note: "Smoke test local consultation flow",
  });
  const consultStage = await getLeadStatus(consultLead.kommoLeadId);
  if (consultStage !== expectedConsult) {
    throw new Error(`Stage consultation invalid. expected=${expectedConsult} actual=${consultStage}`);
  }

  let marathonLeadId: string | null = null;
  let marathonStage: number | null = null;
  if (marathonUser && expectedMarathon !== null) {
    await createLeadInKommo(marathonUser.id, "marathon");
    const marathonLead = await prisma.user.findUniqueOrThrow({ where: { id: marathonUser.id } });
    if (!marathonLead.kommoLeadId) {
      throw new Error("Lead marathon nu a fost creat in Kommo.");
    }

    await requestMarathonInterestInKommo(marathonUser.id, {
      packageKey: "basic",
      packageLabel: "🔹 Basic",
      cohortLabel: "29 martie",
      priceLabel: "89 eur",
    });
    marathonStage = await getLeadStatus(marathonLead.kommoLeadId);
    if (marathonStage !== expectedMarathon) {
      throw new Error(`Stage marathon invalid. expected=${expectedMarathon} actual=${marathonStage}`);
    }

    marathonLeadId = marathonLead.kommoLeadId.toString();
  }

  const recentLogs = await prisma.crmSyncLog.findMany({
    where: {
      userId: {
        in: [urgentUser.id, consultUser.id, ...(marathonUser ? [marathonUser.id] : [])],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      userId: true,
      action: true,
      status: true,
      createdAt: true,
    },
  });

  console.log("CRM smoke OK");
  console.log(
    JSON.stringify(
      {
        urgentLeadId: urgentLead.kommoLeadId.toString(),
        consultLeadId: consultLead.kommoLeadId.toString(),
        marathonLeadId,
        expectedStages: {
          new: expectedNew,
          warm: expectedWarm,
          urgent: expectedUrgent,
          consultation: expectedConsult,
          marathon: expectedMarathon,
        },
        resolvedStages: {
          urgent: urgentStage,
          consultation: consultStage,
          marathon: marathonStage,
        },
        marathonSmoke: expectedMarathon === null ? "skipped_missing_KOMMO_STAGE_MARATON_ID" : "ok",
        recentLogs,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await closeResources();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await closeResources();
    process.exit(1);
  });
