import { Job } from "bullmq";
import { CampaignJobPayload } from "../services/schedulerService.js";
import { sendReminder } from "../services/lessonService.js";

export async function processReminderJob(job: Job<CampaignJobPayload>): Promise<void> {
  if (job.data.type === "follow_up") {
    await sendReminder(job.data.userId, "follow_up");
  }

  if (job.data.type === "inactive") {
    await sendReminder(job.data.userId, "inactive");
  }

  if (job.data.type === "long_reminder") {
    await sendReminder(job.data.userId, "long_reminder");
  }
}
