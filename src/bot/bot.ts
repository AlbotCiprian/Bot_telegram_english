import { Context, Telegraf } from "telegraf";
import { SHARED_COPY } from "../content/copy.js";
import { prisma } from "../db/client.js";
import { STATIC_PAGES } from "../content/staticContent.js";
import { logUserEvent } from "../services/eventService.js";
import { clearSession, getSession } from "../services/sessionService.js";
import { getOrCreateUser } from "../services/userService.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { buildStaticPageMessage, getBackToMenuKeyboard, getMainMenuKeyboard, getPublicMenuKeyboard, getStartFreeLessonsKeyboard, resolveMenuActionFromLabel } from "./menu.js";
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
import { ConsultationRequestStep, LeadCaptureStep, MarathonInterestStep, SessionPayload } from "../types/session.js";
import { resetUserForTesting } from "../services/userService.js";
import { continueRequestedService, isPublicEntryAction } from "./handlers/serviceHandler.js";
import { getTelegramApiClientOptions } from "../services/telegram.js";
import {
  handleConsultationContactInput,
  handleConsultationTextInput,
  resumeConsultationRequest,
} from "./handlers/consultationHandler.js";
import {
  handleMarathonCallback,
  handleMarathonContactInput,
  handleMarathonTextInput,
  resumeMarathonFlow,
} from "./handlers/marathonHandler.js";

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

async function getContextUser(ctx: Context) {
  const cached = (ctx.state as { botUser?: Awaited<ReturnType<typeof getOrCreateUser>> }).botUser;
  if (cached) {
    return cached;
  }

  if (!ctx.from) {
    return null;
  }

  const user = await getOrCreateUser(ctx.from);
  (ctx.state as { botUser?: Awaited<ReturnType<typeof getOrCreateUser>> }).botUser = user;
  return user;
}

async function handleMenuAction(
  ctx: Context,
  user: Awaited<ReturnType<typeof getOrCreateUser>>,
  action: string,
  session: Awaited<ReturnType<typeof getSession>>,
) {
  if (action === "menu") {
    if (!user.leadFormCompleted) {
      if (session?.flowType === "lead_capture") {
        await resumeLeadCapture(ctx, session.step as LeadCaptureStep);
        return;
      }
      if (session?.flowType === "consultation_request") {
        await resumeConsultationRequest(ctx, session.step as ConsultationRequestStep, (session.payload as SessionPayload | null) ?? {});
        return;
      }
      if (session?.flowType === "marathon_interest") {
        await resumeMarathonFlow(ctx, session.step as MarathonInterestStep, (session.payload as SessionPayload | null) ?? {});
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
      await ctx.reply(SHARED_COPY.commercialContactRequired);
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
    (ctx.state as { botUser?: typeof user }).botUser = user;
    await next();
  });

  bot.start(async (ctx) => {
    const user = await getContextUser(ctx);
    if (!user) {
      return;
    }
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
    const user = await getContextUser(ctx);
    if (!user) {
      return;
    }
    if (!user.leadFormCompleted) {
      await handleStart(ctx, user, { showMainMenu: false, showLessons: false });
      return;
    }

    await handleMenu(ctx, { showLessons: showLessonsInMenu(user) });
  });

  bot.command("help", async (ctx) => {
    const user = await getContextUser(ctx);
    await handleHelp(ctx, user?.id, { showLessons: user ? showLessonsInMenu(user) : false });
  });

  bot.command("reset", async (ctx) => {
    const user = await getContextUser(ctx);
    if (!user) {
      return;
    }
    await resetUserForTesting(user.id);
    await ctx.reply(
      "Starea ta locală a fost resetată. Acum poți da din nou /start ca să testezi onboarding-ul de la zero.",
    );
  });

  bot.action(/^menu:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const user = await getContextUser(ctx);
    if (!user) {
      return;
    }
    const action = ctx.match[1];
    const session = await getSession(user.id);
    await handleMenuAction(ctx, user, action, session);
  });

  bot.action(/^marathon:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const user = await getContextUser(ctx);
    if (!user) {
      return;
    }

    await handleMarathonCallback(ctx, user, ctx.match[1]);
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
      await ctx.reply(SHARED_COPY.startMenuActivationRequired, {
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
      await ctx.reply(SHARED_COPY.startMenuActivationRequired, {
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
    if (!isContactMessage(ctx)) {
      return;
    }

    const user = await getContextUser(ctx);
    if (!user) {
      return;
    }
    const session = await getSession(user.id);
    if (session?.flowType !== "lead_capture" || session.step !== "phone") {
      if (session?.flowType === "consultation_request" && session.step === "phone") {
        await handleConsultationContactInput(ctx, user, ctx.message.contact, (session.payload as SessionPayload | null) ?? {});
        return;
      }
      if (session?.flowType === "marathon_interest" && session.step === "phone") {
        await handleMarathonContactInput(ctx, user, ctx.message.contact, (session.payload as SessionPayload | null) ?? {});
      }
      return;
    }

    await handleLeadContactInput(ctx, user, ctx.message.contact);
  });

  bot.on("text", async (ctx) => {
    if (!isTextMessage(ctx)) {
      return;
    }

    const user = await getContextUser(ctx);
    if (!user) {
      return;
    }
    const session = await getSession(user.id);
    const text = ctx.message.text.trim();
    const menuAction = resolveMenuActionFromLabel(text);

    if (session?.flowType === "marathon_interest" && menuAction) {
      await clearSession(user.id);
      await handleMenuAction(ctx, user, menuAction, null);
      return;
    }

    if (!session?.flowType) {
      if (menuAction) {
        await handleMenuAction(ctx, user, menuAction, session);
        return;
      }
    }

    if (!session?.flowType) {
      if (!user.leadFormCompleted) {
        await ctx.reply(SHARED_COPY.onboardingMenuPrompt, {
          reply_markup: getPublicMenuKeyboard().reply_markup,
        });
        return;
      }

      await ctx.reply(SHARED_COPY.useMainMenuPrompt, {
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

    if (session.flowType === "consultation_request") {
      await handleConsultationTextInput(ctx, user, session.step as ConsultationRequestStep, text, payload);
      return;
    }

    if (session.flowType === "marathon_interest") {
      await handleMarathonTextInput(ctx, user, session.step as MarathonInterestStep, text, payload);
      return;
    }

    if (session.flowType === "ai_question") {
      await handleAiQuestionInput(ctx, user, text);
    }
  });

  bot.catch(async (error, ctx) => {
    logger.error({ err: error }, "Eroare neasteptata in bot.");
    const user = await getContextUser(ctx);
    if (user) {
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
