export type SessionFlow = "lead_capture" | "course_interest" | "consultation_request" | "ai_question";

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
  | "reason"
  | "message";

export type AiQuestionStep = "awaiting_question";

export type SessionStep = LeadCaptureStep | CourseInterestStep | ConsultationRequestStep | AiQuestionStep;

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
  "message",
];
