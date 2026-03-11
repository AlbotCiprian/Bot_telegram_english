CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "telegram_id" BIGINT NOT NULL UNIQUE,
  "username" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "language_code" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "lead_form_completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "current_lesson_day" INTEGER NOT NULL DEFAULT 0,
  "kommo_lead_id" BIGINT,
  "kommo_contact_id" BIGINT,
  "last_interaction_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_profiles" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "english_level" TEXT,
  "goal" TEXT,
  "occupation" TEXT,
  "time_available" TEXT,
  "consent_privacy" BOOLEAN NOT NULL DEFAULT FALSE,
  "consent_marketing" BOOLEAN NOT NULL DEFAULT FALSE,
  "consultation_wanted" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "bot_sessions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "flow_type" TEXT,
  "step" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "campaigns" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "lessons" (
  "id" SERIAL PRIMARY KEY,
  "campaign_id" INTEGER NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "key" TEXT NOT NULL UNIQUE,
  "day_number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "message_text" TEXT NOT NULL,
  "media_type" TEXT NOT NULL,
  "media_url" TEXT,
  "cta" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lessons_campaign_id_day_number_key" UNIQUE ("campaign_id", "day_number")
);

CREATE TABLE "user_campaigns" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "campaign_id" INTEGER NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "stopped_at" TIMESTAMP(3),
  "last_lesson_day" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_campaigns_user_id_campaign_id_key" UNIQUE ("user_id", "campaign_id")
);

CREATE TABLE "scheduled_jobs" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "queue_name" TEXT NOT NULL,
  "job_id" TEXT NOT NULL UNIQUE,
  "job_type" TEXT NOT NULL,
  "run_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "payload" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "documents" (
  "id" SERIAL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'page',
  "chunk_index" INTEGER NOT NULL DEFAULT 0,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "embedding" vector(384),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documents_url_kind_chunk_index_key" UNIQUE ("url", "kind", "chunk_index")
);

CREATE TABLE "crm_sync_logs" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "request_payload" JSONB,
  "response_payload" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_events" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "scheduled_jobs_user_id_status_idx" ON "scheduled_jobs"("user_id", "status");
CREATE INDEX "documents_kind_idx" ON "documents"("kind");
CREATE INDEX "documents_embedding_idx" ON "documents" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX "user_events_event_type_idx" ON "user_events"("event_type");
