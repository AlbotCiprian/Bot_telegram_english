import { Worker } from "bullmq";
import { processCrmJob } from "./jobs/crmSyncProcessor.js";
import { markTrackedJob, CAMPAIGN_QUEUE_NAME, CRM_QUEUE_NAME, redisConnection } from "./services/queue.js";
import { logger } from "./utils/logger.js";
import { processLessonJob } from "./jobs/lessonScheduler.js";
import { processReminderJob } from "./jobs/reminderScheduler.js";
import { CampaignJobPayload, CrmJobPayload } from "./services/schedulerService.js";

async function bootstrapWorker(): Promise<void> {
  const campaignWorker = new Worker<CampaignJobPayload>(
    CAMPAIGN_QUEUE_NAME,
    async (job) => {
      await markTrackedJob(job.id as string, "processing");
      await processLessonJob(job);
      await processReminderJob(job);
      await markTrackedJob(job.id as string, "completed");
    },
    {
      connection: redisConnection,
      concurrency: 4,
    },
  );

  campaignWorker.on("failed", async (job, error) => {
    if (job?.id) {
      await markTrackedJob(job.id as string, "failed", error.message);
    }
    logger.error({ err: error }, "Campaign worker failed.");
  });

  const crmWorker = new Worker<CrmJobPayload>(
    CRM_QUEUE_NAME,
    async (job) => {
      await markTrackedJob(job.id as string, "processing");
      await processCrmJob(job);
      await markTrackedJob(job.id as string, "completed");
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  crmWorker.on("failed", async (job, error) => {
    if (job?.id) {
      await markTrackedJob(job.id as string, "failed", error.message);
    }
    logger.error({ err: error }, "CRM worker failed.");
  });

  logger.info("Worker-ul local a pornit.");

  const shutdown = async () => {
    await campaignWorker.close();
    await crmWorker.close();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

bootstrapWorker().catch((error) => {
  logger.error({ err: error }, "Worker bootstrap esuat.");
  process.exit(1);
});
