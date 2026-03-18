import { Job } from "bullmq";
import {
  createLeadInKommo,
  qualifyLeadInKommo,
  requestConsultationInKommo,
  requestMarathonInterestInKommo,
} from "../services/crmService.js";
import { CrmJobPayload } from "../services/schedulerService.js";

export async function processCrmJob(job: Job<CrmJobPayload>): Promise<void> {
  if (job.data.action === "create_lead") {
    await createLeadInKommo(job.data.userId, job.data.firstRequestedService ?? undefined);
  }

  if (job.data.action === "qualify_lead") {
    await qualifyLeadInKommo(job.data.userId);
  }

  if (job.data.action === "request_consultation") {
    await requestConsultationInKommo(job.data.userId, {
      requestedService: job.data.requestedService,
      priority: job.data.priority,
      reason: job.data.reason,
      note: job.data.note,
    });
  }

  if (job.data.action === "request_marathon_interest") {
    await requestMarathonInterestInKommo(job.data.userId, {
      packageKey: job.data.packageKey,
      packageLabel: job.data.packageLabel,
      cohortLabel: job.data.cohortLabel,
      priceLabel: job.data.priceLabel,
    });
  }
}
