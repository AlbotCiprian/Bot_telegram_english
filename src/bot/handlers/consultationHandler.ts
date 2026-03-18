import crypto from "node:crypto";
import { Context } from "telegraf";
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

export type ConsultationRequestType = "operator" | "career_astrology";
export type ConsultationPriority = "urgent_contact" | "consultation";

const CONSULTATION_REASON_OPTIONS: Record<ConsultationRequestType, string[]> = {
  operator: [
    "Vreau sa fiu sunat cat mai curand",
    "Vreau preturile",
    "Vreau sa ma inscriu",
    "Alta intrebare",
  ],
  career_astrology: [
    "Vreau consultatia de cariera",
    "Vreau detalii despre pachete",
    "Vreau sa fiu sunat",
    "Alta intrebare",
  ],
};

function getServiceTitle(service: ConsultationRequestType): string {
  return PUBLIC_ENTRY_LABELS[service] ?? service;
}

async function replyConsultationStepPrompt(
  ctx: Context,
  service: ConsultationRequestType,
  step: ConsultationRequestStep,
): Promise<void> {
  if (step === "phone") {
    await ctx.reply(`Te rog trimite numarul de telefon pentru ${getServiceTitle(service)}.`, {
      reply_markup: getPhoneRequestKeyboard().reply_markup,
    });
    return;
  }

  await ctx.reply("Care este motivul principal pentru care vrei sa fii contactat?", {
    reply_markup: getReasonChoiceKeyboard(CONSULTATION_REASON_OPTIONS[service]).reply_markup,
  });
}

function parsePayload(payload: SessionPayload) {
  return {
    requestedService:
      payload.requestedService === "operator" || payload.requestedService === "career_astrology"
        ? payload.requestedService
        : "operator",
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
    params.priority === "urgent_contact"
      ? "Am trimis cererea ta in CRM cu prioritate mare. Revenim cat mai rapid."
      : "Am trimis cererea ta in CRM. Revenim cu consultatia de cariera cat mai curand.",
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
  await ctx.reply("Continuam cererea exact de unde ai ramas.");
  await replyConsultationStepPrompt(ctx, parsed.requestedService, step);
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
      reason: parsed.reason ?? parsed.presetReason ?? "Cerere generala",
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
    if (value.toLowerCase() === "voi scrie manual") {
      await ctx.reply("Scrie numarul tau in formatul +373XXXXXXXX.");
      return;
    }

    if (!isValidPhone(value)) {
      await ctx.reply("Numarul nu pare valid. Incearca formatul +373XXXXXXXX sau foloseste butonul dedicat.");
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
        reason: parsed.reason ?? parsed.presetReason ?? "Cerere generala",
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
