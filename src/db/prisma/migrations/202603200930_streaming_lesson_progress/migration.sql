ALTER TABLE "lesson_progress"
  ADD COLUMN IF NOT EXISTS "stream_session_created_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stream_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stream_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_playback_second" INTEGER;
