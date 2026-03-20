CREATE TABLE "lesson_quiz_results" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "day_number" INTEGER NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "latest_correct_answers" INTEGER NOT NULL DEFAULT 0,
  "latest_total_questions" INTEGER NOT NULL DEFAULT 0,
  "latest_percentage" INTEGER NOT NULL DEFAULT 0,
  "best_correct_answers" INTEGER NOT NULL DEFAULT 0,
  "best_percentage" INTEGER NOT NULL DEFAULT 0,
  "last_answers" JSONB,
  "last_attempt_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_quiz_results_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users"("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX "lesson_quiz_results_user_id_day_number_key"
  ON "lesson_quiz_results" ("user_id", "day_number");
