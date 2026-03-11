ALTER TABLE "users"
ADD COLUMN "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN "lesson1_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lesson2_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lesson3_unlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lesson2_unlock_time" TIMESTAMP(3),
ADD COLUMN "lesson3_unlock_time" TIMESTAMP(3);
