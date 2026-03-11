export type SessionFlow = "lead_capture" | "course_interest" | "ai_question";

export type LeadCaptureStep =
  | "first_name"
  | "last_name"
  | "phone"
  | "email"
  | "level"
  | "goal"
  | "consent_privacy"
  | "consent_marketing";

export type CourseInterestStep =
  | "level"
  | "goal"
  | "time_available"
  | "wants_contact";

export type AiQuestionStep = "awaiting_question";

export type SessionStep = LeadCaptureStep | CourseInterestStep | AiQuestionStep;

export type SessionPayload = Record<string, unknown>;

export const LEAD_CAPTURE_STEPS: LeadCaptureStep[] = [
  "first_name",
  "last_name",
  "phone",
  "email",
  "level",
  "goal",
  "consent_privacy",
  "consent_marketing",
];

export const COURSE_INTEREST_STEPS: CourseInterestStep[] = [
  "level",
  "goal",
  "time_available",
  "wants_contact",
];
