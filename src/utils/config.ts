import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

for (const fileName of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: true });
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().default(3000),
  APP_HOST: z.string().default("0.0.0.0"),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  AI_PROVIDER: z.enum(["auto", "groq", "deepseek", "openrouter", "none"]).default("auto"),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default(""),
  GROQ_API_KEY: z.string().default(""),
  GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_MODEL: z.string().default("openrouter/auto"),
  DEEPSEEK_API_KEY: z.string().default(""),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:55432/botdb?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  KOMMO_SUBDOMAIN: z.string().default("allengualmd"),
  KOMMO_TOKEN: z.string().default(""),
  KOMMO_PIPELINE_ID: z.string().default(""),
  KOMMO_STAGE_NEW_ID: z.string().default(""),
  KOMMO_STAGE_WARM_ID: z.string().default(""),
  KOMMO_STAGE_CONSULT_ID: z.string().default(""),
  KOMMO_CUSTOM_FIELD_TELEGRAM_ID: z.string().default(""),
  KOMMO_CUSTOM_FIELD_TELEGRAM_USERNAME: z.string().default(""),
  KOMMO_CUSTOM_FIELD_ENGLISH_LEVEL: z.string().default(""),
  KOMMO_CUSTOM_FIELD_GOAL: z.string().default(""),
  KOMMO_CUSTOM_FIELD_CURRENT_LESSON: z.string().default(""),
  KOMMO_CUSTOM_FIELD_SOURCE: z.string().default(""),
  KOMMO_CUSTOM_FIELD_LAST_ACTIVITY: z.string().default(""),
  LESSON_DELAY_MODE: z.enum(["dev", "prod"]).default("dev"),
  WEBSITE_SOURCE_URL: z.string().default("https://www.expres.allengual.md/"),
  WEBINAR_URL: z.string().default("https://youtu.be/yBGyEyWSCMg?si=1wLJkhP2Mpmv5dVY"),
  OPERATOR_CONTACT_URL: z.string().default("https://www.expres.allengual.md/"),
  ASTROLOGY_CONSULTATION_URL: z.string().default("https://www.expres.allengual.md/"),
  WELCOME_IMAGE_URL: z
    .string()
    .default("https://www.expres.allengual.md/assets/favicon/web-app-manifest-192x192.png"),
  EMBEDDING_DIMENSION: z.coerce.number().default(384),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsedEnv = envSchema.parse(process.env);

export const config = {
  ...parsedEnv,
  kommoBaseUrl: `https://${parsedEnv.KOMMO_SUBDOMAIN}.kommo.com`,
} as const;

export function isConfigured(value: string): boolean {
  return value.trim().length > 0;
}
