export type SessionFlow = "lead_capture" | "course_interest" | "consultation_request" | "marathon_interest" | "ai_question";

export type LeadCaptureStep =
  | "first_name"
  | "phone"
  | "consent_privacy";

export type CourseInterestStep =
  | "level"
  | "goal"
  | "time_available"
  | "wants_contact";

export type ConsultationRequestStep =
  | "phone"
  | "reason";

export type MarathonInterestStep =
  | "menu"
  | "phone";

export type AiQuestionStep = "awaiting_question";

export type SessionStep = LeadCaptureStep | CourseInterestStep | ConsultationRequestStep | MarathonInterestStep | AiQuestionStep;

export type SessionPayload = Record<string, unknown>;

export const LEAD_CAPTURE_STEPS: LeadCaptureStep[] = [
  "first_name",
  "phone",
  "consent_privacy",
];

export const COURSE_INTEREST_STEPS: CourseInterestStep[] = [
  "level",
  "goal",
  "time_available",
  "wants_contact",
];

export const CONSULTATION_REQUEST_STEPS: ConsultationRequestStep[] = [
  "phone",
  "reason",
];

export const MARATHON_INTEREST_STEPS: MarathonInterestStep[] = [
  "menu",
  "phone",
];
