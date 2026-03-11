import { Job, JobsOptions, Queue } from "bullmq";
import { prisma } from "../db/client.js";
import { asJson } from "../utils/json.js";
import { config } from "../utils/config.js";

export const CAMPAIGN_QUEUE_NAME = "campaigns";
export const CRM_QUEUE_NAME = "crm";

const redisUrl = new URL(config.REDIS_URL);

export const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  password: redisUrl.password || undefined,
  username: redisUrl.username || undefined,
  maxRetriesPerRequest: null as null,
};

export const campaignQueue = new Queue(CAMPAIGN_QUEUE_NAME, {
  connection: redisConnection,
});

export const crmQueue = new Queue(CRM_QUEUE_NAME, {
  connection: redisConnection,
});

export async function addTrackedJob(
  queue: Queue,
  jobName: string,
  data: Record<string, unknown>,
  options: JobsOptions & { userId?: number; runAt?: Date },
) {
  const { userId, runAt, ...queueOptions } = options;
  const job = await queue.add(jobName, data, queueOptions);

  await prisma.scheduledJob.upsert({
    where: { jobId: job.id as string },
    update: {
      status: "scheduled",
      runAt: runAt ?? new Date(),
      queueName: queue.name,
      jobType: jobName,
      payload: asJson(data),
      userId: userId ?? null,
      errorMessage: null,
    },
    create: {
      jobId: job.id as string,
      queueName: queue.name,
      jobType: jobName,
      runAt: runAt ?? new Date(),
      status: "scheduled",
      payload: asJson(data),
      userId: userId ?? null,
    },
  });

  return job;
}

export async function markTrackedJob(jobId: string, status: string, errorMessage?: string): Promise<void> {
  await prisma.scheduledJob.updateMany({
    where: { jobId },
    data: {
      status,
      errorMessage: errorMessage ?? null,
    },
  });
}
