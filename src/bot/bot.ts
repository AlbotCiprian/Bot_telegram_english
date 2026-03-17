import { Context, Telegraf } from "telegraf";
import { prisma } from "../db/client.js";
import { STATIC_PAGES } from "../content/staticContent.js";
import { logUserEvent } from "../services/eventService.js";
import { getSession } from "../services/sessionService.js";
import { getOrCreateUser, touchUser } from "../services/userService.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { buildStaticPageMessage, getBackToMenuKeyboard, getMainMenuKeyboard, getPublicMenuKeyboard, getStartFreeLessonsKeyboard } from "./menu.js";
import { handleAiQuestionInput, startAiQuestionFlow } from "./handlers/aiHandler.js";
import { deliverLesson, getLessonsMenu, getLockedLessonMessage, handleLessonQuiz } from "../services/lessonService.js";
import {
  handleConsentCallback,
  handleCourseInterestTextInput,
  handleLeadContactInput,
  handleLeadTextInput,
  resumeLeadCapture,
  startCourseInterestFlow,
  startLeadCapture,
} from "./handlers/leadHandler.js";
import { handleHelp, handleMenu, handleStart } from "./handlers/startHandler.js";
import { LeadCaptureStep, SessionPayload } from "../types/session.js";
import { resetUserForTesting } from "../services/userService.js";
import { continueRequestedService, isPublicEntryAction } from "./handlers/serviceHandler.js";
import { getTelegramApiClientOptions } from "../services/telegram.js";

function isTextMessage(ctx: Context): ctx is Context & { message: { text: string } } {
  return "message" in ctx && typeof (ctx.message as { text?: string })?.text === "string";
}

function isContactMessage(ctx: Context): ctx is Context & { message: { contact: { phone_number: string } } } {
  return "message" in ctx && Boolean((ctx.message as { contact?: unknown })?.contact);
}

function showLessonsInMenu(user: {
  lesson1Unlocked?: boolean;
  lesson2Unlocked?: boolean;
  lesson3Unlocked?: boolean;
  currentLessonDay?: number;
}): boolean {
  return Boolean(user.lesson1Unlocked || user.lesson2Unlocked || user.lesson3Unlocked || (user.currentLessonDay ?? 0) > 0);
}

export function createBot(): Telegraf<Context> {
  const bot = new Telegraf<Context>(config.TELEGRAM_BOT_TOKEN, {
    telegram: getTelegramApiClientOptions(),
  });

  bot.use(async (ctx, next) => {
    if (!ctx.from) {
      return next();
    }

    const user = await getOrCreateUser(ctx.from);
    await touchUser(user.id);
    await next();
  });

  bot.start(async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    if (user.leadFormCompleted) {
      await handleStart(ctx, user, {
        showMainMenu: true,
        showLessons: showLessonsInMenu(user),
      });
      return;
    }

    await handleStart(ctx, user, {
      showMainMenu: false,
      showLessons: false,
    });
  });

  bot.command("menu", async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    if (!user.leadFormCompleted) {
      await handleStart(ctx, user, { showMainMenu: false, showLessons: false });
      return;
    }

    await handleMenu(ctx, { showLessons: showLessonsInMenu(user) });
  });

  bot.command("help", async (ctx) => {
    const user = ctx.from ? await getOrCreateUser(ctx.from) : null;
    await handleHelp(ctx, user?.id, { showLessons: user ? showLessonsInMenu(user) : false });
  });

  bot.command("reset", async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    await resetUserForTesting(user.id);
    await ctx.reply(
      "Starea ta locala a fost resetata. Acum poti da din nou /start ca sa testezi onboarding-ul de la zero.",
    );
  });

  bot.action(/^menu:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.from) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const action = ctx.match[1];
    const session = await getSession(user.id);

    if (action === "menu") {
      if (!user.leadFormCompleted) {
        if (session?.flowType === "lead_capture") {
          await resumeLeadCapture(ctx, session.step as LeadCaptureStep);
          return;
        }
        await handleStart(ctx, user, { showMainMenu: false, showLessons: false });
        return;
      }

      await handleMenu(ctx, { showLessons: showLessonsInMenu(user) });
      return;
    }

    if (!user.leadFormCompleted && (isPublicEntryAction(action) || action === "lessons" || action === "wants_course" || action === "ask_ai")) {
      if (session?.flowType === "lead_capture") {
        await resumeLeadCapture(ctx, session.step as LeadCaptureStep);
        return;
      }

      await startLeadCapture(ctx, user, action, {
        firstRequestedService: isPublicEntryAction(action) ? action : null,
      });
      return;
    }

    if (isPublicEntryAction(action)) {
      await continueRequestedService(ctx, user, action);
      return;
    }

    if (action === "lessons") {
      const lessonsMenu = await getLessonsMenu(user.id);
      await ctx.reply(lessonsMenu.text, {
        parse_mode: "Markdown",
        reply_markup: lessonsMenu.replyMarkup,
      });
      return;
    }

    if (action === "wants_course") {
      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!currentUser?.leadFormCompleted) {
        await ctx.reply("Inainte de flow-ul comercial, am nevoie de datele de contact de baza.");
        await startLeadCapture(ctx, user, "wants_course");
        return;
      }

      await startCourseInterestFlow(ctx, user);
      return;
    }

    if (action === "ask_ai") {
      await startAiQuestionFlow(ctx, user);
      return;
    }

    if (action === "website") {
      await ctx.reply(STATIC_PAGES.website.body, {
        reply_markup: getBackToMenuKeyboard(showLessonsInMenu(user)).reply_markup,
      });
      return;
    }

    const staticPageKeys = ["programs", "method", "mistakes", "career", "busy_people"] as const;
    if (staticPageKeys.includes(action as (typeof staticPageKeys)[number])) {
      await ctx.reply(buildStaticPageMessage(action as keyof typeof STATIC_PAGES), {
        parse_mode: "Markdown",
        reply_markup: getBackToMenuKeyboard(showLessonsInMenu(user)).reply_markup,
      });
    }
  });

  bot.action(/^consent:(privacy|marketing):(yes|no)$/, async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.from) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const [, type, rawValue] = ctx.match;
    await handleConsentCallback(ctx, user, type as "privacy" | "marketing", rawValue === "yes");
  });

  bot.action(/^lesson:open:(1|2|3)$/, async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.from) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    if (!user.leadFormCompleted) {
      await ctx.reply("Mai intai activeaza accesul din meniul de start.", {
        reply_markup: getPublicMenuKeyboard().reply_markup,
      });
      return;
    }

    const dayNumber = Number(ctx.match[1]) as 1 | 2 | 3;
    const lockedMessage = await getLockedLessonMessage(user.id, dayNumber);

    if (lockedMessage) {
      await ctx.reply(lockedMessage);
      return;
    }

    await deliverLesson(user.id, dayNumber);
  });

  bot.action(/^lesson:quiz:(1|2|3)$/, async (ctx) => {
    await ctx.answerCbQuery();

    if (!ctx.from) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    if (!user.leadFormCompleted) {
      await ctx.reply("Mai intai activeaza accesul din meniul de start.", {
        reply_markup: getPublicMenuKeyboard().reply_markup,
      });
      return;
    }

    const dayNumber = Number(ctx.match[1]) as 1 | 2 | 3;
    const result = await handleLessonQuiz(user.id, dayNumber);

    if (result.message) {
      await ctx.reply(result.message);
    }
  });

  bot.on("contact", async (ctx) => {
    if (!ctx.from || !isContactMessage(ctx)) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const session = await getSession(user.id);
    if (session?.flowType !== "lead_capture" || session.step !== "phone") {
      return;
    }

    await handleLeadContactInput(ctx, user, ctx.message.contact);
  });

  bot.on("text", async (ctx) => {
    if (!ctx.from || !isTextMessage(ctx)) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const session = await getSession(user.id);
    const text = ctx.message.text.trim();

    if (!session?.flowType) {
      if (!user.leadFormCompleted) {
        await ctx.reply("Alege un serviciu din meniul de mai jos ca sa pornim onboardingul rapid.", {
          reply_markup: getPublicMenuKeyboard().reply_markup,
        });
        return;
      }

      await ctx.reply("Foloseste meniul principal pentru a continua.", {
        reply_markup: getMainMenuKeyboard({ showLessons: showLessonsInMenu(user) }).reply_markup,
      });
      return;
    }

    const payload = (session.payload as SessionPayload | null) ?? {};

    if (session.flowType === "lead_capture") {
      await handleLeadTextInput(ctx, user, session.step as LeadCaptureStep, text, payload);
      return;
    }

    if (session.flowType === "course_interest") {
      await handleCourseInterestTextInput(
        ctx,
        user,
        session.step as "level" | "goal" | "time_available" | "wants_contact",
        text,
      );
      return;
    }

    if (session.flowType === "ai_question") {
      await handleAiQuestionInput(ctx, user, text);
    }
  });

  bot.catch(async (error, ctx) => {
    logger.error({ err: error }, "Eroare neasteptata in bot.");
    if (ctx.from) {
      const user = await getOrCreateUser(ctx.from);
      await logUserEvent({
        userId: user.id,
        eventType: "bot_error",
        metadata: {
          message: error instanceof Error ? error.message : "unknown",
        },
      });
    }
  });

  return bot;
}
