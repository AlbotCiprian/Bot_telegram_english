import { prisma } from "../db/client.js";
import { addTrackedJob, campaignQueue, crmQueue } from "./queue.js";
import { getDelayMap, getRunAt } from "../utils/schedule.js";

export type CampaignJobPayload =
  | { userId: number; type: "lesson_unlock"; dayNumber: 2 | 3 }
  | { userId: number; type: "follow_up" }
  | { userId: number; type: "inactive" }
  | { userId: number; type: "long_reminder" };

export type CrmJobPayload =
  | { userId: number; action: "create_lead"; firstRequestedService?: string | null }
  | { userId: number; action: "qualify_lead" };

function buildCampaignJobId(payload: CampaignJobPayload): string {
  if (payload.type === "lesson_unlock") {
    return `campaign:${payload.userId}:${payload.type}:${payload.dayNumber}`;
  }

  return `campaign:${payload.userId}:${payload.type}`;
}

function buildCrmJobId(payload: CrmJobPayload): string {
  return `crm:${payload.userId}:${payload.action}`;
}

export async function scheduleFreeLessonCampaign(userId: number): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { key: "free-lessons" },
  });

  if (!campaign) {
    throw new Error("Campania free-lessons nu este seed-uita.");
  }

  await cancelPendingCampaignJobs(userId);

  await prisma.userCampaign.upsert({
    where: {
      userId_campaignId: {
        userId,
        campaignId: campaign.id,
      },
    },
    update: {
      status: "active",
      startedAt: new Date(),
      stoppedAt: null,
      completedAt: null,
      lastLessonDay: 1,
    },
    create: {
      userId,
      campaignId: campaign.id,
      status: "active",
      lastLessonDay: 1,
    },
  });

  const delayMap = getDelayMap();
  await scheduleCampaignJob({ userId, type: "lesson_unlock", dayNumber: 2 }, delayMap.lesson2Ms);
  await scheduleCampaignJob({ userId, type: "lesson_unlock", dayNumber: 3 }, delayMap.lesson3Ms);
  await scheduleCampaignJob({ userId, type: "follow_up" }, delayMap.followUpMs);
  await scheduleCampaignJob({ userId, type: "inactive" }, delayMap.inactiveMs);
  await scheduleCampaignJob({ userId, type: "long_reminder" }, delayMap.longReminderMs);
}

export async function scheduleCampaignJob(payload: CampaignJobPayload, delayMs: number): Promise<void> {
  const runAt = getRunAt(delayMs);
  await addTrackedJob(campaignQueue, payload.type, payload, {
    jobId: buildCampaignJobId(payload),
    userId: payload.userId,
    delay: delayMs,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10_000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
    runAt,
  });
}

export async function scheduleCrmJob(payload: CrmJobPayload): Promise<void> {
  await addTrackedJob(crmQueue, payload.action, payload, {
    jobId: buildCrmJobId(payload),
    userId: payload.userId,
    delay: 0,
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 15_000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
    runAt: new Date(),
  });
}

export async function cancelPendingCampaignJobs(userId: number): Promise<void> {
  const pendingJobs = await prisma.scheduledJob.findMany({
    where: {
      userId,
      queueName: "campaigns",
      status: "scheduled",
    },
  });

  for (const job of pendingJobs) {
    const bullJob = await campaignQueue.getJob(job.jobId);
    if (bullJob) {
      await bullJob.remove();
    }
  }

  await prisma.scheduledJob.updateMany({
    where: {
      userId,
      queueName: "campaigns",
      status: "scheduled",
    },
    data: {
      status: "cancelled",
      errorMessage: "Rescheduled campaign timeline.",
    },
  });
}

export async function cancelPendingUserJobs(userId: number): Promise<void> {
  const pendingJobs = await prisma.scheduledJob.findMany({
    where: {
      userId,
      status: "scheduled",
    },
  });

  for (const job of pendingJobs) {
    const queue = job.queueName === "crm" ? crmQueue : campaignQueue;
    const bullJob = await queue.getJob(job.jobId);
    if (bullJob) {
      await bullJob.remove();
    }
  }

  await prisma.scheduledJob.updateMany({
    where: {
      userId,
      status: "scheduled",
    },
    data: {
      status: "cancelled",
      errorMessage: "Oprit dupa intrarea in flow comercial.",
    },
  });
}
