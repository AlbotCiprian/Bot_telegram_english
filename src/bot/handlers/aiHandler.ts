import { Context } from "telegraf";
import { answerQuestion } from "../../services/aiService.js";
import { logUserEvent } from "../../services/eventService.js";
import { clearSession, setSession } from "../../services/sessionService.js";
import { BotUser } from "../../types/bot.js";
import { getMainMenuKeyboard } from "../menu.js";

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
}
