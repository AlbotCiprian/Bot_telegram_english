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
  TELEGRAM_API_ROOT: z.string().default(""),
  TELEGRAM_USE_LOCAL_API: z.enum(["true", "false"]).default("false"),
  TELEGRAM_LOCAL_API_ID: z.string().default(""),
  TELEGRAM_LOCAL_API_HASH: z.string().default(""),
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
  KOMMO_STAGE_URGENT_ID: z.string().default(""),
  KOMMO_STAGE_ASTROLOGY_ID: z.string().default(""),
  KOMMO_STAGE_MARATON_ID: z.string().default(""),
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
  STREAMING_ENABLED: z.enum(["true", "false"]).default("false"),
  STREAM_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  STREAM_HLS_ROOT: z.string().default("stream/hls"),
  STREAM_MP4_ROOT: z.string().default("stream/mp4"),
  STREAM_POSTER_ROOT: z.string().default("stream/posters"),
  STREAM_SIGNING_SECRET: z.string().default("dev-streaming-secret"),
  STREAM_SESSION_TTL_SEC: z.coerce.number().default(21600),
  STREAM_MOBILE_MAX_RENDITION: z.coerce.number().default(720),
  STREAM_DESKTOP_MAX_RENDITION: z.coerce.number().default(720),
  LESSON_DELIVERY_MODE: z.enum(["telegram_video", "internal_stream"]).default("internal_stream"),
  LESSON_TELEGRAM_FALLBACK: z.enum(["true", "false"]).default("false"),
  MEDIA_WARMUP_CHAT_ID: z.string().default(""),
  MEDIA_UPLOAD_LOCK_TTL_SEC: z.coerce.number().default(600),
  BOT_ACTION_DEBOUNCE_MS: z.coerce.number().default(2000),
  AI_USER_COOLDOWN_SEC: z.coerce.number().default(10),
  AI_MAX_CONCURRENCY: z.coerce.number().default(8),
  CAMPAIGN_WORKER_CONCURRENCY: z.coerce.number().default(4),
  CRM_WORKER_CONCURRENCY: z.coerce.number().default(2),
  MARATHON_START_DATE: z.string().default(""),
  MARATHON_END_DATE: z.string().default(""),
  MARATHON_BASIC_PRICE: z.string().default(""),
  MARATHON_BASIC_TERM: z.string().default(""),
  MARATHON_SILVER_PRICE: z.string().default(""),
  MARATHON_SILVER_TERM: z.string().default(""),
  MARATHON_GOLD_PRICE: z.string().default(""),
  MARATHON_GOLD_TERM: z.string().default(""),
  MARATHON_PREMIUM_PRICE: z.string().default(""),
  MARATHON_PREMIUM_TERM: z.string().default(""),
  MARATHON_VIP_PRICE: z.string().default(""),
  MARATHON_VIP_TERM: z.string().default(""),
  MARATHON_COHORT_OPTIONS: z.string().default(""),
  MARATHON_BASIC_PRICES: z.string().default(""),
  MARATHON_SILVER_PRICES: z.string().default(""),
  MARATHON_GOLD_PRICES: z.string().default(""),
  MARATHON_PREMIUM_PRICES: z.string().default(""),
  MARATHON_VIP_PRICES: z.string().default(""),
  WELCOME_IMAGE_PATH: z.string().default("video/Image_welcome.JPG"),
  WELCOME_IMAGE_URL: z
    .string()
    .default("https://www.expres.allengual.md/assets/favicon/web-app-manifest-192x192.png"),
  MONITOR_BOT_TOKEN: z.string().default(""),
  MONITOR_ALLOWED_USER_IDS: z.string().default(""),
  MONITOR_ALERT_CHAT_ID: z.string().default(""),
  MONITOR_ACCESS_PASSWORD: z.string().default(""),
  MONITOR_MAX_LOGIN_ATTEMPTS: z.coerce.number().default(3),
  MONITOR_TARGET_BASE_URL: z.string().default("http://bot:3000"),
  MONITOR_POLL_INTERVAL_SEC: z.coerce.number().default(60),
  MONITOR_DAILY_REPORT_HOUR: z.coerce.number().default(9),
  MONITOR_TIMEZONE: z.string().default("Europe/Chisinau"),
  MONITOR_ENABLE_DANGEROUS_COMMANDS: z.enum(["true", "false"]).default("false"),
  MONITOR_QUEUE_BACKLOG_THRESHOLD: z.coerce.number().default(20),
  MONITOR_CRM_FAILURE_WINDOW_MIN: z.coerce.number().default(15),
  MONITOR_CRM_FAILURE_THRESHOLD: z.coerce.number().default(3),
  MONITOR_LOG_TAIL_LINES: z.coerce.number().default(80),
  DOCKER_SOCKET_PATH: z.string().default("/var/run/docker.sock"),
  MONITOR_EXPRESS_BOT_CONTAINER: z.string().default("allengual-bot-prod"),
  MONITOR_EXPRESS_WORKER_CONTAINER: z.string().default("allengual-worker-prod"),
  MONITOR_EXPRESS_DB_CONTAINER: z.string().default("allengual-postgres-prod"),
  MONITOR_EXPRESS_REDIS_CONTAINER: z.string().default("allengual-redis-prod"),
  EMBEDDING_DIMENSION: z.coerce.number().default(384),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsedEnv = envSchema.parse(process.env);

const usingDockerComposeNetwork =
  parsedEnv.DATABASE_URL.includes("@postgres:") || parsedEnv.REDIS_URL.includes("redis://redis");

const telegramApiRoot = parsedEnv.TELEGRAM_API_ROOT.trim().length > 0
  ? parsedEnv.TELEGRAM_API_ROOT.trim()
  : parsedEnv.TELEGRAM_USE_LOCAL_API === "true"
    ? parsedEnv.NODE_ENV === "production" || usingDockerComposeNetwork
      ? "http://telegram-bot-api:8081"
      : "http://localhost:8081"
    : "https://api.telegram.org";

export const config = {
  ...parsedEnv,
  telegramUseLocalApi: parsedEnv.TELEGRAM_USE_LOCAL_API === "true",
  monitorDangerousCommands: parsedEnv.MONITOR_ENABLE_DANGEROUS_COMMANDS === "true",
  streamingEnabled: parsedEnv.STREAMING_ENABLED === "true",
  lessonTelegramFallback: parsedEnv.LESSON_TELEGRAM_FALLBACK === "true",
  telegramApiRoot,
  kommoBaseUrl: `https://${parsedEnv.KOMMO_SUBDOMAIN}.kommo.com`,
} as const;

export function isConfigured(value: string): boolean {
  return value.trim().length > 0;
}
