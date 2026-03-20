import { Context } from "telegraf";
import { answerQuestion } from "../../services/aiService.js";
import { deleteRedisKey, debounceRedisAction, releaseRedisPermit, tryAcquireRedisPermit } from "../../services/redis.js";
import { logUserEvent } from "../../services/eventService.js";
import { clearSession, setSession } from "../../services/sessionService.js";
import { BotUser } from "../../types/bot.js";
import { config } from "../../utils/config.js";
import { getMainMenuKeyboard } from "../menu.js";

const AI_GLOBAL_PERMIT_KEY = "ai:global:permits";

function showLessonsInMenu(user: BotUser): boolean {
  return Boolean(user.lesson1Unlocked || user.lesson2Unlocked || user.lesson3Unlocked || user.currentLessonDay > 0);
}

export async function startAiQuestionFlow(ctx: Context, user: BotUser): Promise<void> {
  await setSession({
    userId: user.id,
    flowType: "ai_question",
    step: "awaiting_question",
    payload: {},
  });

  await ctx.reply(
    "🤖 Salut! Sunt colegul AI Express English Academy.\n\nScrie-mi o întrebare despre cursuri, prețuri, niveluri sau program și îți răspund doar pe baza informațiilor disponibile.",
  );
}

export async function handleAiQuestionInput(ctx: Context, user: BotUser, question: string): Promise<void> {
  const cooldownKey = `ai:user:${user.id}:cooldown`;
  const acceptedByCooldown = await debounceRedisAction(cooldownKey, config.AI_USER_COOLDOWN_SEC * 1000);

  if (!acceptedByCooldown) {
    await ctx.reply(
      `Așteaptă ${config.AI_USER_COOLDOWN_SEC} secunde înainte de următoarea întrebare, ca să evităm supraîncărcarea AI-ului.`,
      {
        reply_markup: getMainMenuKeyboard({ showLessons: showLessonsInMenu(user) }).reply_markup,
      },
    );
    return;
  }

  const acquiredPermit = await tryAcquireRedisPermit(AI_GLOBAL_PERMIT_KEY, config.AI_MAX_CONCURRENCY, 60);
  if (!acquiredPermit) {
    await deleteRedisKey(cooldownKey);
    await ctx.reply(
      "AI-ul procesează deja mai multe cereri în paralel. Încearcă din nou în câteva secunde.",
      {
        reply_markup: getMainMenuKeyboard({ showLessons: showLessonsInMenu(user) }).reply_markup,
      },
    );
    return;
  }

  try {
    const response = await answerQuestion(question);
    await clearSession(user.id);

    await ctx.reply(response.answer, {
      reply_markup: getMainMenuKeyboard({ showLessons: showLessonsInMenu(user) }).reply_markup,
    });

    await logUserEvent({
      userId: user.id,
      eventType: "ai_question_answered",
      metadata: {
        usedFallback: response.usedFallback,
        sources: response.sources,
      },
    });
  } finally {
    await releaseRedisPermit(AI_GLOBAL_PERMIT_KEY);
  }
}
