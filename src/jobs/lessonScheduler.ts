import { Job } from "bullmq";
import { CampaignJobPayload } from "../services/schedulerService.js";
import { unlockLesson } from "../services/lessonService.js";

export async function processLessonJob(job: Job<CampaignJobPayload>): Promise<void> {
  if (job.data.type !== "lesson_unlock") {
    return;
  }

  await unlockLesson(job.data.userId, job.data.dayNumber);
}
