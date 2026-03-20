import axios from "axios";
import { config, isConfigured } from "../utils/config.js";

type KommoField = {
  id: number;
  name: string;
  code?: string | null;
};

type KommoStage = {
  id: number;
  name: string;
};

type KommoPipeline = {
  id: number;
  name: string;
};

const api = axios.create({
  baseURL: `https://${config.KOMMO_SUBDOMAIN}.kommo.com/api/v4`,
  headers: {
    Authorization: `Bearer ${config.KOMMO_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 20_000,
});

function requireKommoConfig(): void {
  if (!isConfigured(config.KOMMO_SUBDOMAIN) || !isConfigured(config.KOMMO_TOKEN)) {
    throw new Error("KOMMO_SUBDOMAIN sau KOMMO_TOKEN lipsesc din .env.local");
  }
}

function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const normalized = name.trim().toLowerCase();
  return items.find((item) => item.name.trim().toLowerCase() === normalized);
}

async function getPipelines(): Promise<KommoPipeline[]> {
  const response = await api.get("/leads/pipelines");
  return response.data?._embedded?.pipelines ?? [];
}

async function getStages(pipelineId: number): Promise<KommoStage[]> {
  const response = await api.get(`/leads/pipelines/${pipelineId}/statuses`);
  return response.data?._embedded?.statuses ?? [];
}

async function getCustomFields(entityType: "contacts" | "leads"): Promise<KommoField[]> {
  const response = await api.get(`/${entityType}/custom_fields`);
  return response.data?._embedded?.custom_fields ?? [];
}

function printFieldRecommendation(label: string, field?: KommoField): void {
  console.log(`${label}=${field?.id ?? ""}`);
}

function findContactOrLeadField(
  contactFields: KommoField[],
  leadFields: KommoField[],
  name: string,
): KommoField | undefined {
  return findByName(contactFields, name) ?? findByName(leadFields, name);
}

async function main(): Promise<void> {
  requireKommoConfig();

  const account = await api.get("/account");
  console.log("Kommo OK");
  console.log(`account=${account.data?.name ?? "unknown"}`);
  console.log(`subdomain=${account.data?.subdomain ?? config.KOMMO_SUBDOMAIN}`);
  console.log("");

  const pipelines = await getPipelines();
  console.log("Pipelines:");
  for (const pipeline of pipelines) {
    console.log(`- ${pipeline.id}: ${pipeline.name}`);
  }

  const targetPipeline = findByName(pipelines, "Telegram Bot Leads");
  if (targetPipeline) {
    const stages = await getStages(targetPipeline.id);
    console.log("");
    console.log(`Stages for "${targetPipeline.name}":`);
    for (const stage of stages) {
      console.log(`- ${stage.id}: ${stage.name}`);
    }

    console.log("");
    console.log("Suggested .env.local values:");
    console.log(`KOMMO_PIPELINE_ID=${targetPipeline.id}`);
    console.log(`KOMMO_STAGE_NEW_ID=${findByName(stages, "New Telegram Lead")?.id ?? ""}`);
    console.log(`KOMMO_STAGE_WARM_ID=${findByName(stages, "Warm Lead")?.id ?? ""}`);
    console.log(`KOMMO_STAGE_CONSULT_ID=${findByName(stages, "Consultation Requested")?.id ?? ""}`);
    console.log(`KOMMO_STAGE_URGENT_ID=${findByName(stages, "Consultation Requested Urgent")?.id ?? ""}`);
    console.log(`KOMMO_STAGE_ASTROLOGY_ID=${findByName(stages, "Consultation Requested Astrology")?.id ?? ""}`);
    console.log(`KOMMO_STAGE_MARATON_ID=${findByName(stages, "Maraton Interested")?.id ?? ""}`);
  } else {
    console.log("");
    console.log('Pipeline "Telegram Bot Leads" nu exista inca.');
  }

  const [contactFields, leadFields] = await Promise.all([
    getCustomFields("contacts"),
    getCustomFields("leads"),
  ]);

  console.log("");
  console.log("Suggested profile field IDs:");
  printFieldRecommendation(
    "KOMMO_CUSTOM_FIELD_TELEGRAM_ID",
    findContactOrLeadField(contactFields, leadFields, "Telegram ID"),
  );
  printFieldRecommendation(
    "KOMMO_CUSTOM_FIELD_TELEGRAM_USERNAME",
    findContactOrLeadField(contactFields, leadFields, "Telegram Username"),
  );
  printFieldRecommendation(
    "KOMMO_CUSTOM_FIELD_ENGLISH_LEVEL",
    findContactOrLeadField(contactFields, leadFields, "English Level"),
  );
  printFieldRecommendation(
    "KOMMO_CUSTOM_FIELD_GOAL",
    findContactOrLeadField(contactFields, leadFields, "Goal"),
  );

  console.log("");
  console.log("Suggested lead field IDs:");
  printFieldRecommendation("KOMMO_CUSTOM_FIELD_CURRENT_LESSON", findByName(leadFields, "Current Lesson"));
  printFieldRecommendation("KOMMO_CUSTOM_FIELD_SOURCE", findByName(leadFields, "Source"));
  printFieldRecommendation("KOMMO_CUSTOM_FIELD_LAST_ACTIVITY", findByName(leadFields, "Last Activity"));

  console.log("");
  console.log("Existing contact fields:");
  for (const field of contactFields) {
    console.log(`- ${field.id}: ${field.name}${field.code ? ` [${field.code}]` : ""}`);
  }

  console.log("");
  console.log("Existing lead fields:");
  for (const field of leadFields) {
    console.log(`- ${field.id}: ${field.name}${field.code ? ` [${field.code}]` : ""}`);
  }
}

main().catch((error) => {
  if (axios.isAxiosError(error)) {
    console.error(`Kommo verification failed: ${error.response?.status ?? "no-status"} ${error.response?.data?.detail ?? error.message}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exit(1);
});
