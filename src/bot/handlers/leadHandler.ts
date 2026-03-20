import { Context, Markup } from "telegraf";
import { SHARED_COPY, UI_LABELS } from "../../content/copy.js";
import { prisma } from "../../db/client.js";
import { PUBLIC_ENTRY_LABELS, PublicEntryKey } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { cancelPendingUserJobs, scheduleCrmJob } from "../../services/schedulerService.js";
import { clearSession, setSession, updateSessionStep } from "../../services/sessionService.js";
import { ensureProfile, getUserWithProfile } from "../../services/userService.js";
import { BotUser } from "../../types/bot.js";
import { LeadCaptureStep, SessionPayload } from "../../types/session.js";
import { isValidPhone, normalizePhone, normalizeWhitespace, parseBooleanChoice } from "../../utils/validators.js";
import {
  getMainMenuKeyboard,
  getPhoneRequestKeyboard,
  getPrivacyChoiceKeyboard,
} from "../menu.js";
import { finalizeLeadAndStartCampaign } from "./lessonHandler.js";
import { startCourseContactFlow } from "./consultationHandler.js";

export async function replyLeadStepPrompt(ctx: Context, step: LeadCaptureStep): Promise<void> {
  if (step === "first_name") {
    await ctx.reply("Cum te pot apela?");
    return;
  }

  if (step === "phone") {
    await ctx.reply("Te rog să-mi trimiți numărul tău de telefon ca să îți putem activa accesul.", {
      reply_markup: getPhoneRequestKeyboard().reply_markup,
    });
    return;
  }

  if (step === "consent_privacy") {
    await ctx.reply(
      "Pentru a continua, te rog să confirmi acordul privind politica de confidențialitate și comunicările despre cursuri și oferte.",
      {
        reply_markup: getPrivacyChoiceKeyboard().reply_markup,
      },
    );
  }
}

export async function startLeadCapture(
  ctx: Context,
  user: BotUser,
  nextAction?: string,
  options?: { silentIntro?: boolean; firstRequestedService?: PublicEntryKey | null },
): Promise<void> {
  await setSession({
    userId: user.id,
    flowType: "lead_capture",
    step: "first_name",
    payload: {
      nextAction: nextAction ?? null,
      firstRequestedService: options?.firstRequestedService ?? null,
    },
  });

  if (!options?.silentIntro) {
    const firstRequestedService =
      options?.firstRequestedService && PUBLIC_ENTRY_LABELS[options.firstRequestedService]
        ? `Mai întâi îți activăm rapid accesul pentru: ${PUBLIC_ENTRY_LABELS[options.firstRequestedService]}.`
        : "Mai întâi îți activăm rapid accesul.";

    await ctx.reply(`${firstRequestedService}\n\nAm nevoie doar de câteva date de bază ca să continuăm.`);
  }

  await replyLeadStepPrompt(ctx, "first_name");
}

export async function resumeLeadCapture(ctx: Context, step: LeadCaptureStep): Promise<void> {
  await ctx.reply(SHARED_COPY.continueFromWhereLeftOff);
  await replyLeadStepPrompt(ctx, step);
}

export async function startCourseInterestFlow(ctx: Context, user: BotUser): Promise<void> {
  await setSession({
    userId: user.id,
    flowType: "course_interest",
    step: "level",
    payload: {},
  });

  await ctx.reply("Ca să îți recomandăm varianta potrivită, am câteva întrebări scurte. Care este nivelul tău actual de engleză?");
}

export async function handleLeadContactInput(
  ctx: Context,
  user: BotUser,
  contact: { phone_number: string },
): Promise<void> {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      phone: normalizePhone(contact.phone_number),
    },
  });

  await updateSessionStep(user.id, "consent_privacy");
  await ctx.reply("Am salvat numărul. Mai am nevoie doar de acordul tău pentru a continua.", {
    reply_markup: Markup.removeKeyboard().reply_markup,
  });
  await replyLeadStepPrompt(ctx, "consent_privacy");
}

export async function handleLeadTextInput(
  ctx: Context,
  user: BotUser,
  step: LeadCaptureStep,
  text: string,
  payload: SessionPayload,
): Promise<void> {
  const value = normalizeWhitespace(text);

  if (step === "first_name") {
    const [firstName, ...rest] = value.split(" ");

    if (!firstName) {
      await ctx.reply("Te rog să-mi scrii numele tău ca să continuăm.");
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName: rest.length ? rest.join(" ") : null,
      },
    });
    await updateSessionStep(user.id, "phone");
    await replyLeadStepPrompt(ctx, "phone");
    return;
  }

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
    await updateSessionStep(user.id, "consent_privacy");
    await replyLeadStepPrompt(ctx, "consent_privacy");
    return;
  }

  if (step === "consent_privacy") {
    const parsed = value === UI_LABELS.acceptPrivacy ? true : parseBooleanChoice(value);
    if (parsed !== true) {
      await ctx.reply(SHARED_COPY.acceptPrivacyRequired);
      return;
    }

    await finalizeLeadAndStartCampaign({
      ctx,
      user,
      consentPrivacy: true,
      consentMarketing: true,
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : undefined,
      firstRequestedService:
        typeof payload.firstRequestedService === "string"
          ? (payload.firstRequestedService as PublicEntryKey)
          : undefined,
    });

    if (payload.nextAction === "wants_course") {
      await startCourseContactFlow(ctx, user);
    }
  }
}

export async function handleCourseInterestTextInput(
  ctx: Context,
  user: BotUser,
  step: "level" | "goal" | "time_available" | "wants_contact",
  text: string,
): Promise<void> {
  const value = normalizeWhitespace(text);
  await ensureProfile(user.id);

  if (step === "level") {
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { englishLevel: value },
    });
    await updateSessionStep(user.id, "goal");
    await ctx.reply("Pentru ce îți este cel mai utilă engleza în această perioadă?");
    return;
  }

  if (step === "goal") {
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { goal: value },
    });
    await updateSessionStep(user.id, "time_available");
    await ctx.reply("Cât timp realist poți aloca săptămânal?");
    return;
  }

  if (step === "time_available") {
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { timeAvailable: value },
    });
    await updateSessionStep(user.id, "wants_contact");
    await ctx.reply("Vrei să fii contactat pentru o recomandare de curs? Răspunde cu Da sau Nu.");
    return;
  }

  if (step === "wants_contact") {
    const parsed = parseBooleanChoice(value);
    if (parsed === null) {
      await ctx.reply("Te rog să răspunzi cu Da sau Nu.");
      return;
    }

    await prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        consultationWanted: parsed,
      },
    });

    await clearSession(user.id);
    await cancelPendingUserJobs(user.id);
    await scheduleCrmJob({ userId: user.id, action: "qualify_lead" });

    await logUserEvent({
      userId: user.id,
      eventType: "course_interest_completed",
      metadata: {
        wantsContact: parsed,
      },
    });

    await ctx.reply("Perfect. Am salvat interesul tău și am trimis datele mai departe.", {
      reply_markup: getMainMenuKeyboard({ showLessons: Boolean(user.lesson1Unlocked || user.currentLessonDay > 0) }).reply_markup,
    });
  }
}

export async function handleConsentCallback(
  ctx: Context,
  user: BotUser,
  type: "privacy" | "marketing",
  value: boolean,
): Promise<void> {
  const session = await getUserWithProfile(user.id);
  const payload = (session?.session?.payload as SessionPayload | null) ?? {};

  if (type === "privacy") {
    if (!value) {
      await ctx.reply(SHARED_COPY.acceptPrivacyRequired);
      return;
    }

    await finalizeLeadAndStartCampaign({
      ctx,
      user,
      consentPrivacy: true,
      consentMarketing: true,
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : undefined,
      firstRequestedService:
        typeof payload.firstRequestedService === "string"
          ? (payload.firstRequestedService as PublicEntryKey)
          : undefined,
    });

    if (payload.nextAction === "wants_course") {
      await startCourseContactFlow(ctx, user);
    }

    return;
  }

  await finalizeLeadAndStartCampaign({
    ctx,
    user,
    consentPrivacy: Boolean(payload.consentPrivacy),
    consentMarketing: value,
    nextAction: typeof payload.nextAction === "string" ? payload.nextAction : undefined,
    firstRequestedService:
      typeof payload.firstRequestedService === "string"
        ? (payload.firstRequestedService as PublicEntryKey)
        : undefined,
  });

  if (payload.nextAction === "wants_course") {
    await startCourseContactFlow(ctx, user);
  }
}
