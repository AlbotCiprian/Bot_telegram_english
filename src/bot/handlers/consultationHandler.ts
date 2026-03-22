import crypto from "node:crypto";
import { Context } from "telegraf";
import { SHARED_COPY, UI_LABELS } from "../../content/copy.js";
import { prisma } from "../../db/client.js";
import { PUBLIC_ENTRY_LABELS } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { cancelPendingUserJobs, scheduleCrmJob } from "../../services/schedulerService.js";
import { clearSession, setSession, updateSessionPayload, updateSessionStep } from "../../services/sessionService.js";
import { ensureProfile } from "../../services/userService.js";
import { BotUser } from "../../types/bot.js";
import { ConsultationRequestStep, SessionPayload } from "../../types/session.js";
import { normalizePhone, normalizeWhitespace, isValidPhone } from "../../utils/validators.js";
import { getMainMenuKeyboard, getPhoneRequestKeyboard, getReasonChoiceKeyboard } from "../menu.js";

export type ConsultationRequestType = "operator" | "career_astrology" | "course_contact";
export type ConsultationPriority = "urgent_contact" | "consultation";

const CONSULTATION_REASON_OPTIONS: Record<ConsultationRequestType, string[]> = {
  operator: [
    "Vreau să fiu sunat cât mai curând",
    "Vreau prețurile",
    "Vreau să mă înscriu",
    "Altă întrebare",
  ],
  career_astrology: [
    "Vreau consultația astrologică în carieră",
    "Vreau detalii despre pachete",
    "Vreau să fiu sunat",
    "Altă întrebare",
  ],
  course_contact: [
    "Vreau să aflu ce curs mi se potrivește",
    "Vreau prețurile",
    "Vreau să fiu contactat în scurt timp",
    "Altă întrebare",
  ],
};

function getServiceTitle(service: ConsultationRequestType): string {
  if (service === "career_astrology") {
    return PUBLIC_ENTRY_LABELS.career_astrology;
  }

  if (service === "course_contact") {
    return "cursul potrivit pentru tine";
  }

  return "solicitarea ta";
}

async function replyConsultationStepPrompt(
  ctx: Context,
  service: ConsultationRequestType,
  step: ConsultationRequestStep,
): Promise<void> {
  if (step === "phone") {
    const prompt =
      service === "course_contact"
        ? "Te rog să-mi trimiți numărul tău de telefon ca să te putem contacta în legătură cu cursul potrivit pentru tine."
        : `Te rog să-mi trimiți numărul de telefon pentru ${getServiceTitle(service)}.`;

    await ctx.reply(prompt, {
      reply_markup: getPhoneRequestKeyboard().reply_markup,
    });
    return;
  }

  await ctx.reply("Care este motivul principal pentru care vrei să fii contactat?", {
    reply_markup: getReasonChoiceKeyboard(CONSULTATION_REASON_OPTIONS[service]).reply_markup,
  });
}

function parsePayload(payload: SessionPayload) {
  return {
    requestedService:
      payload.requestedService === "operator" ||
      payload.requestedService === "career_astrology" ||
      payload.requestedService === "course_contact"
        ? payload.requestedService
        : "course_contact",
    priority: payload.priority === "urgent_contact" ? "urgent_contact" : "consultation",
    presetReason: typeof payload.presetReason === "string" ? payload.presetReason : null,
    reason: typeof payload.reason === "string" ? payload.reason : null,
  } as const;
}

async function finalizeConsultationRequest(
  ctx: Context,
  user: BotUser,
  params: {
    requestedService: ConsultationRequestType;
    priority: ConsultationPriority;
    reason: string;
    message?: string | null;
  },
) {
  await ensureProfile(user.id);
  await prisma.userProfile.update({
    where: { userId: user.id },
    data: {
      consultationWanted: true,
    },
  });

  await clearSession(user.id);
  await cancelPendingUserJobs(user.id);

  await scheduleCrmJob({
    userId: user.id,
    action: "request_consultation",
    requestedService: params.requestedService,
    priority: params.priority,
    reason: params.reason,
    note: params.message ?? null,
    requestKey: crypto.randomUUID(),
  });

  await logUserEvent({
    userId: user.id,
    eventType: "consultation_requested",
    metadata: {
      requestedService: params.requestedService,
      priority: params.priority,
      reason: params.reason,
      message: params.message ?? null,
    },
  });

  await ctx.reply(
    params.requestedService === "course_contact"
      ? SHARED_COPY.courseContactConfirmation
      : params.priority === "urgent_contact"
      ? "Procesăm cererea ta cu prioritate. În curând vei fi contactat. Îți mulțumim!"
      : "Procesăm cererea ta. În curând vei fi contactat. Îți mulțumim!",
    {
      reply_markup: getMainMenuKeyboard({ showLessons: Boolean(user.lesson1Unlocked || user.currentLessonDay > 0) }).reply_markup,
    },
  );
}

export async function startConsultationRequestFlow(
  ctx: Context,
  user: BotUser,
  params: {
    requestedService: ConsultationRequestType;
    priority: ConsultationPriority;
    presetReason?: string | null;
  },
): Promise<void> {
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!currentUser) {
    return;
  }

  if (currentUser.phone && params.presetReason) {
    await finalizeConsultationRequest(ctx, user, {
      requestedService: params.requestedService,
      priority: params.priority,
      reason: params.presetReason,
      message: null,
    });
    return;
  }

  const nextStep: ConsultationRequestStep = currentUser.phone ? "reason" : "phone";

  await setSession({
    userId: user.id,
    flowType: "consultation_request",
    step: nextStep,
    payload: {
      requestedService: params.requestedService,
      priority: params.priority,
      presetReason: params.presetReason ?? null,
      reason: params.presetReason ?? null,
    },
  });

  await replyConsultationStepPrompt(ctx, params.requestedService, nextStep);
}

export async function resumeConsultationRequest(
  ctx: Context,
  step: ConsultationRequestStep,
  payload: SessionPayload,
): Promise<void> {
  const parsed = parsePayload(payload);
  await ctx.reply(SHARED_COPY.continueFromWhereLeftOff);
  await replyConsultationStepPrompt(ctx, parsed.requestedService, step);
}

export async function startCourseContactFlow(ctx: Context, user: BotUser): Promise<void> {
  await startConsultationRequestFlow(ctx, user, {
    requestedService: "course_contact",
    priority: "urgent_contact",
    presetReason: "Interes pentru curs",
  });
}

export async function handleConsultationContactInput(
  ctx: Context,
  user: BotUser,
  contact: { phone_number: string },
  payload: SessionPayload,
): Promise<void> {
  const parsed = parsePayload(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      phone: normalizePhone(contact.phone_number),
    },
  });

  if (parsed.presetReason || parsed.reason) {
    await finalizeConsultationRequest(ctx, user, {
      requestedService: parsed.requestedService,
      priority: parsed.priority,
      reason: parsed.reason ?? parsed.presetReason ?? "Cerere generală",
      message: null,
    });
    return;
  }

  await updateSessionStep(user.id, "reason");
  await replyConsultationStepPrompt(ctx, parsed.requestedService, "reason");
}

export async function handleConsultationTextInput(
  ctx: Context,
  user: BotUser,
  step: ConsultationRequestStep,
  text: string,
  payload: SessionPayload,
): Promise<void> {
  const value = normalizeWhitespace(text);
  const parsed = parsePayload(payload);

  if (step === "phone") {
    if (value.toLowerCase() === UI_LABELS.writePhoneManually.toLowerCase()) {
      await ctx.reply(SHARED_COPY.phoneFormatPrompt);
      return;
    }

    if (!isValidPhone(value)) {
      await ctx.reply(SHARED_COPY.invalidPhonePrompt);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { phone: normalizePhone(value) },
    });

    if (parsed.presetReason || parsed.reason) {
      await finalizeConsultationRequest(ctx, user, {
        requestedService: parsed.requestedService,
        priority: parsed.priority,
        reason: parsed.reason ?? parsed.presetReason ?? "Cerere generală",
        message: null,
      });
      return;
    }

    await updateSessionStep(user.id, "reason");
    await replyConsultationStepPrompt(ctx, parsed.requestedService, "reason");
    return;
  }

  await updateSessionPayload(user.id, { reason: value });
  await finalizeConsultationRequest(ctx, user, {
    requestedService: parsed.requestedService,
    priority: parsed.priority,
    reason: value,
    message: null,
  });
}
