CREATE TABLE IF NOT EXISTS "telegram_media_assets" (
  "id" SERIAL PRIMARY KEY,
  "asset_key" TEXT NOT NULL UNIQUE,
  "telegram_file_id" TEXT NOT NULL,
  "telegram_file_unique_id" TEXT,
  "source_file_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
