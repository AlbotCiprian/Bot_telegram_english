import { Job } from "bullmq";
import { createLeadInKommo, qualifyLeadInKommo, requestConsultationInKommo } from "../services/crmService.js";
import { CrmJobPayload } from "../services/schedulerService.js";

export async function processCrmJob(job: Job<CrmJobPayload>): Promise<void> {
  if (job.data.action === "create_lead") {
    await createLeadInKommo(job.data.userId, job.data.firstRequestedService ?? undefined);
  }

  if (job.data.action === "qualify_lead") {
    await qualifyLeadInKommo(job.data.userId);
  }

  if (job.data.action === "request_consultation") {
    await requestConsultationInKommo(job.data.userId, job.data.requestedService);
  }
}
