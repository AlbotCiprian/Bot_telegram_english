import { Context } from "telegraf";
import { SHARED_COPY } from "../../content/copy.js";
import { prisma } from "../../db/client.js";
import { scheduleCrmJob } from "../../services/schedulerService.js";
import { clearSession } from "../../services/sessionService.js";
import { logUserEvent } from "../../services/eventService.js";
import { BotUser } from "../../types/bot.js";
import { logger } from "../../utils/logger.js";
import { getMainMenuKeyboard } from "../menu.js";
import { continueRequestedService } from "./serviceHandler.js";
import { PublicEntryKey } from "../../content/staticContent.js";

export async function finalizeLeadAndStartCampaign(params: {
  ctx: Context;
  user: BotUser;
  consentPrivacy: boolean;
  consentMarketing: boolean;
  nextAction?: string;
  firstRequestedService?: PublicEntryKey;
}): Promise<void> {
  const onboardingCompletedAt = new Date();

  await prisma.user.update({
    where: { id: params.user.id },
    data: {
      leadFormCompleted: true,
      onboardingCompletedAt,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: params.user.id },
    update: {
      consentPrivacy: params.consentPrivacy,
      consentMarketing: params.consentMarketing,
    },
    create: {
      userId: params.user.id,
      consentPrivacy: params.consentPrivacy,
      consentMarketing: params.consentMarketing,
    },
  });

  await clearSession(params.user.id);

  try {
    await scheduleCrmJob({
      userId: params.user.id,
      action: "create_lead",
      firstRequestedService: params.firstRequestedService ?? null,
    });
  } catch (error) {
    logger.error(
      { err: error, userId: params.user.id },
      "Nu am putut programa sync-ul Kommo, continui flow-ul ales de utilizator.",
    );
  }

  const targetAction =
    params.firstRequestedService ??
    (params.nextAction === "wants_course" ? undefined : (params.nextAction as PublicEntryKey | undefined));

  if (targetAction) {
    await continueRequestedService(params.ctx, params.user, targetAction);
  } else {
    await params.ctx.reply(SHARED_COPY.chooseHowToContinue, {
      reply_markup: getMainMenuKeyboard().reply_markup,
    });
  }

  await logUserEvent({
    userId: params.user.id,
    eventType: "lead_form_completed",
    metadata: {
      nextAction: params.nextAction ?? null,
      firstRequestedService: params.firstRequestedService ?? null,
    },
  });
}

export async function handleFreeLessonEntry(ctx: Context, user: BotUser): Promise<void> {
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (currentUser?.leadFormCompleted) {
    await ctx.reply(
      "Ai deja acces la cele 3 lecții gratuite. Apasă pe butonul din meniu și vezi ce este disponibil acum.",
      {
        reply_markup: getMainMenuKeyboard().reply_markup,
      },
    );
    return;
  }

  await ctx.reply(SHARED_COPY.leadNamePrompt);
}
