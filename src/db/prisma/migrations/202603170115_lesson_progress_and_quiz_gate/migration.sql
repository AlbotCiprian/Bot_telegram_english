CREATE TABLE "lesson_progress" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "day_number" INTEGER NOT NULL,
  "video_sent_at" TIMESTAMP(3),
  "quiz_available_at" TIMESTAMP(3),
  "quiz_completed_at" TIMESTAMP(3),
  "opened_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_progress_user_id_day_number_key" UNIQUE ("user_id", "day_number")
);

CREATE INDEX "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");
