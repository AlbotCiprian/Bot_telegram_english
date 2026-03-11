import { Context } from "telegraf";
import { answerQuestion } from "../../services/aiService.js";
import { logUserEvent } from "../../services/eventService.js";
import { clearSession, setSession } from "../../services/sessionService.js";
import { BotUser } from "../../types/bot.js";
import { getMainMenuKeyboard } from "../menu.js";

export async function startAiQuestionFlow(ctx: Context, user: BotUser): Promise<void> {
  await setSession({
    userId: user.id,
    flowType: "ai_question",
    step: "awaiting_question",
    payload: {},
  });

  await ctx.reply(
    "🤖 Salut! Sunt colegul AI English Express.\n\nScrie-mi o intrebare despre cursuri, preturi, niveluri sau program si iti raspund doar pe baza informatiilor disponibile.",
  );
}

export async function handleAiQuestionInput(ctx: Context, user: BotUser, question: string): Promise<void> {
  const response = await answerQuestion(question);
  await clearSession(user.id);

  await ctx.reply(response.answer, {
    reply_markup: getMainMenuKeyboard().reply_markup,
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
