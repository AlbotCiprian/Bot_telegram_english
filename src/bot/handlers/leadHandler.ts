import { Context, Markup } from "telegraf";
import { prisma } from "../../db/client.js";
import { LEAD_GOAL_OPTIONS, LEAD_LEVEL_OPTIONS } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { cancelPendingUserJobs, scheduleCrmJob } from "../../services/schedulerService.js";
import { clearSession, setSession, updateSessionStep } from "../../services/sessionService.js";
import { ensureProfile, getUserWithProfile } from "../../services/userService.js";
import { BotUser } from "../../types/bot.js";
import { LeadCaptureStep, SessionPayload } from "../../types/session.js";
import { isValidEmail, isValidPhone, normalizePhone, normalizeWhitespace, parseBooleanChoice } from "../../utils/validators.js";
import {
  getLeadGoalKeyboard,
  getLeadLevelKeyboard,
  getMainMenuKeyboard,
  getPhoneRequestKeyboard,
  getPrivacyChoiceKeyboard,
} from "../menu.js";
import { finalizeLeadAndStartCampaign } from "./lessonHandler.js";

function normalizeLeadLevel(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === "a0" || normalized === "a1") {
    return "Incepator";
  }

  if (normalized === "a2") {
    return "Elementar";
  }

  if (normalized === "b1" || normalized === "b2" || normalized === "intermediar") {
    return "Intermediar";
  }

  const matched = LEAD_LEVEL_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return matched ?? value;
}

function normalizeLeadGoal(value: string): string {
  const normalized = value.trim().toLowerCase();
  const matched = LEAD_GOAL_OPTIONS.find((option) => option.toLowerCase() === normalized);
  return matched ?? value;
}

export async function replyLeadStepPrompt(ctx: Context, step: LeadCaptureStep): Promise<void> {
  if (step === "first_name") {
    await ctx.reply("Cum te numesti?");
    return;
  }

  if (step === "last_name") {
    await ctx.reply("Perfect. Acum scrie numele de familie.");
    return;
  }

  if (step === "phone") {
    await ctx.reply("Te rog trimite numarul tau de telefon.", {
      reply_markup: getPhoneRequestKeyboard().reply_markup,
    });
    return;
  }

  if (step === "email") {
    await ctx.reply("Care este emailul tau?", {
      reply_markup: Markup.removeKeyboard().reply_markup,
    });
    return;
  }

  if (step === "level") {
    await ctx.reply("Care este nivelul tau de engleza?", {
      reply_markup: getLeadLevelKeyboard().reply_markup,
    });
    return;
  }

  if (step === "goal") {
    await ctx.reply("Pentru ce vrei sa inveti engleza?", {
      reply_markup: getLeadGoalKeyboard().reply_markup,
    });
    return;
  }

  if (step === "consent_privacy") {
    await ctx.reply(
      "Accept politica de confidentialitate si sunt de acord sa primesc notificari despre cursuri si oferte.",
      {
      reply_markup: getPrivacyChoiceKeyboard().reply_markup,
      },
    );
    return;
  }
}

export async function startLeadCapture(
  ctx: Context,
  user: BotUser,
  nextAction?: string,
  options?: { silentIntro?: boolean },
): Promise<void> {
  await setSession({
    userId: user.id,
    flowType: "lead_capture",
    step: "first_name",
    payload: {
      nextAction: nextAction ?? null,
    },
  });

  if (!options?.silentIntro) {
    await ctx.reply("Perfect. Incepem rapid.");
  }

  await replyLeadStepPrompt(ctx, "first_name");
}

export async function resumeLeadCapture(ctx: Context, step: LeadCaptureStep): Promise<void> {
  await ctx.reply("Continuam exact de unde ai ramas.");
  await replyLeadStepPrompt(ctx, step);
}

export async function startCourseInterestFlow(ctx: Context, user: BotUser): Promise<void> {
  await setSession({
    userId: user.id,
    flowType: "course_interest",
    step: "level",
    payload: {},
  });

  await ctx.reply("Hai sa te calific rapid pentru curs. Care este nivelul tau actual de engleza?");
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

  await updateSessionStep(user.id, "email");
  await ctx.reply("Am salvat numarul. Acum scrie adresa de email.", {
    reply_markup: Markup.removeKeyboard().reply_markup,
  });
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
      await ctx.reply("Scrie numele tau ca sa continuam.");
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

  if (step === "last_name") {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastName: value },
    });
    await updateSessionStep(user.id, "phone");
    await replyLeadStepPrompt(ctx, "phone");
    return;
  }

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
    await updateSessionStep(user.id, "email");
    await replyLeadStepPrompt(ctx, "email");
    return;
  }

  if (step === "email") {
    if (!isValidEmail(value)) {
      await ctx.reply("Emailul nu pare valid. Incearca din nou.");
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { email: value.toLowerCase() },
    });
    await updateSessionStep(user.id, "level");
    await replyLeadStepPrompt(ctx, "level");
    return;
  }

  if (step === "level") {
    await ensureProfile(user.id);
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { englishLevel: normalizeLeadLevel(value) },
    });
    await updateSessionStep(user.id, "goal");
    await replyLeadStepPrompt(ctx, "goal");
    return;
  }

  if (step === "goal") {
    await ensureProfile(user.id);
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { goal: normalizeLeadGoal(value) },
    });
    await updateSessionStep(user.id, "consent_privacy");
    await replyLeadStepPrompt(ctx, "consent_privacy");
    return;
  }

  if (step === "consent_privacy") {
    const parsed = value === "✔ Accept" ? true : parseBooleanChoice(value);
    if (parsed !== true) {
      await ctx.reply("Pentru a continua cu seria gratuita, apasa butonul ✔ Accept.");
      return;
    }

    await finalizeLeadAndStartCampaign({
      ctx,
      user,
      consentPrivacy: true,
      consentMarketing: true,
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : undefined,
    });

    if (payload.nextAction === "wants_course") {
      await startCourseInterestFlow(ctx, user);
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
    await ctx.reply("Pentru ce iti trebuie cel mai mult engleza acum?");
    return;
  }

  if (step === "goal") {
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { goal: value },
    });
    await updateSessionStep(user.id, "time_available");
    await ctx.reply("Cat timp realist poti aloca saptamanal?");
    return;
  }

  if (step === "time_available") {
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { timeAvailable: value },
    });
    await updateSessionStep(user.id, "wants_contact");
    await ctx.reply("Vrei sa fii contactat pentru o recomandare de curs? Raspunde cu Da sau Nu.");
    return;
  }

  if (step === "wants_contact") {
    const parsed = parseBooleanChoice(value);
    if (parsed === null) {
      await ctx.reply("Te rog raspunde cu Da sau Nu.");
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

    await ctx.reply("Perfect. Am salvat interesul tau pentru curs si am trimis datele mai departe.", {
      reply_markup: getMainMenuKeyboard().reply_markup,
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
      await ctx.reply("Pentru a continua cu seria gratuita, apasa butonul ✔ Accept.");
      return;
    }

    await finalizeLeadAndStartCampaign({
      ctx,
      user,
      consentPrivacy: true,
      consentMarketing: true,
      nextAction: typeof payload.nextAction === "string" ? payload.nextAction : undefined,
    });

    if (payload.nextAction === "wants_course") {
      await startCourseInterestFlow(ctx, user);
    }

    return;
  }

  await finalizeLeadAndStartCampaign({
    ctx,
    user,
    consentPrivacy: Boolean(payload.consentPrivacy),
    consentMarketing: value,
    nextAction: typeof payload.nextAction === "string" ? payload.nextAction : undefined,
  });

  if (payload.nextAction === "wants_course") {
    await startCourseInterestFlow(ctx, user);
  }
}
