import { Context } from "telegraf";
import { prisma } from "../../db/client.js";
import { deliverLesson } from "../../services/lessonService.js";
import { scheduleCrmJob, scheduleFreeLessonCampaign } from "../../services/schedulerService.js";
import { clearSession } from "../../services/sessionService.js";
import { logUserEvent } from "../../services/eventService.js";
import { BotUser } from "../../types/bot.js";
import { getDelayMap, getRunAt } from "../../utils/schedule.js";
import { logger } from "../../utils/logger.js";
import { getMainMenuKeyboard } from "../menu.js";

export async function finalizeLeadAndStartCampaign(params: {
  ctx: Context;
  user: BotUser;
  consentPrivacy: boolean;
  consentMarketing: boolean;
  nextAction?: string;
}): Promise<void> {
  const delayMap = getDelayMap();
  const onboardingCompletedAt = new Date();

  await prisma.user.update({
    where: { id: params.user.id },
    data: {
      leadFormCompleted: true,
      onboardingCompletedAt,
      lesson1Unlocked: true,
      lesson2Unlocked: false,
      lesson3Unlocked: false,
      lesson2UnlockTime: getRunAt(delayMap.lesson2Ms),
      lesson3UnlockTime: getRunAt(delayMap.lesson3Ms),
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
    await scheduleCrmJob({ userId: params.user.id, action: "create_lead" });
  } catch (error) {
    logger.error({ err: error, userId: params.user.id }, "Nu am putut programa sync-ul Kommo, continui flow-ul lectiilor.");
  }

  await params.ctx.reply(
    "Perfect. Datele tale au fost salvate. Ti-am activat seria gratuita: Lectia 1 este disponibila acum, iar Lectiile 2 si 3 se deblocheaza automat, cate una pe zi.",
    {
      reply_markup: getMainMenuKeyboard().reply_markup,
    },
  );

  await deliverLesson(params.user.id, 1);
  await scheduleFreeLessonCampaign(params.user.id);

  await logUserEvent({
    userId: params.user.id,
    eventType: "lead_form_completed",
    metadata: {
      nextAction: params.nextAction ?? null,
    },
  });
}

export async function handleFreeLessonEntry(ctx: Context, user: BotUser): Promise<void> {
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (currentUser?.leadFormCompleted) {
    await ctx.reply(
      `Ai deja acces la seria gratuita. Deschide sectiunea Lectiile tale ca sa vezi ce este disponibil acum.`,
      {
        reply_markup: getMainMenuKeyboard().reply_markup,
      },
    );
    return;
  }

  await ctx.reply(
    "Pornim cu un onboarding scurt. Incepem simplu: cum te numesti?",
  );
}
