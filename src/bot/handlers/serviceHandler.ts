import fs from "node:fs";
import path from "node:path";
import { Context, Input, Markup } from "telegraf";
import { prisma } from "../../db/client.js";
import { BRANDING, PUBLIC_ENTRY_LABELS, PublicEntryKey, SERVICE_VIDEO_FILES, STATIC_PAGES } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { getLessonsMenu, deliverLesson } from "../../services/lessonService.js";
import { scheduleFreeLessonCampaign } from "../../services/schedulerService.js";
import { BotUser } from "../../types/bot.js";
import { config } from "../../utils/config.js";
import { getMainMenuKeyboard } from "../menu.js";

const LOCAL_VIDEO_DIR = path.resolve(process.cwd(), "video");

function resolveLocalVideoPath(fileName: string): string {
  return path.resolve(LOCAL_VIDEO_DIR, fileName);
}

function hasStartedFreeLessons(user: {
  lesson1Unlocked: boolean;
  lesson2Unlocked: boolean;
  lesson3Unlocked: boolean;
  currentLessonDay: number;
}): boolean {
  return user.lesson1Unlocked || user.lesson2Unlocked || user.lesson3Unlocked || user.currentLessonDay > 0;
}

function buildServiceActionButtons(action: PublicEntryKey, showLessons: boolean) {
  if (action === "fear_speaking") {
    return Markup.inlineKeyboard([
      [Markup.button.url("▶️ Deschide webinarul", config.WEBINAR_URL)],
      [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
      [Markup.button.callback(showLessons ? "📚 Lectiile si meniul" : "Meniul principal", "menu:menu")],
    ]);
  }

  if (action === "services") {
    return Markup.inlineKeyboard([
      [Markup.button.url("🌐 Vezi serviciile pe site", BRANDING.websiteUrl)],
      [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
      [Markup.button.callback(showLessons ? "📚 Lectiile si meniul" : "Meniul principal", "menu:menu")],
    ]);
  }

  if (action === "operator") {
    return Markup.inlineKeyboard([
      [Markup.button.url("📲 Contact operator", config.OPERATOR_CONTACT_URL)],
      [Markup.button.callback("📞 Vreau sa fiu contactat", "menu:wants_course")],
      [Markup.button.callback(showLessons ? "📚 Lectiile si meniul" : "Meniul principal", "menu:menu")],
    ]);
  }

  if (action === "career_astrology") {
    return Markup.inlineKeyboard([
      [Markup.button.url("🔮 Deschide consultatia", config.ASTROLOGY_CONSULTATION_URL)],
      [Markup.button.callback("📞 Vorbeste cu operatorul", "menu:operator")],
      [Markup.button.callback(showLessons ? "📚 Lectiile si meniul" : "Meniul principal", "menu:menu")],
    ]);
  }

  return Markup.inlineKeyboard([
    [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
    [Markup.button.callback(showLessons ? "📚 Lectiile si meniul" : "Meniul principal", "menu:menu")],
  ]);
}

async function replyWithSharedVideo(
  ctx: Context,
  params: {
    title: string;
    body: string;
    action: PublicEntryKey;
    showLessons: boolean;
    fileName: string;
  },
): Promise<void> {
  const localVideoPath = resolveLocalVideoPath(params.fileName);
  const caption = `*${params.title}*\n\n${params.body}`;
  const replyMarkup = buildServiceActionButtons(params.action, params.showLessons).reply_markup;

  if (fs.existsSync(localVideoPath)) {
    try {
      await ctx.replyWithVideo(Input.fromLocalFile(localVideoPath), {
        caption,
        parse_mode: "Markdown",
        supports_streaming: true,
        reply_markup: replyMarkup,
      });
      return;
    } catch {
      await ctx.reply(
        `${caption}\n\nVideo-ul final trebuie inlocuit cu un MP4 optimizat pentru redare directa in Telegram.`,
        {
          parse_mode: "Markdown",
          reply_markup: replyMarkup,
        },
      );
      return;
    }
  }

  await ctx.reply(caption, {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  });
}

export async function startFreeLessonsForUser(ctx: Context, userId: number): Promise<void> {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!currentUser) {
    return;
  }

  if (hasStartedFreeLessons(currentUser)) {
    const lessonsMenu = await getLessonsMenu(userId);
    await ctx.reply(lessonsMenu.text, {
      parse_mode: "Markdown",
      reply_markup: lessonsMenu.replyMarkup,
    });
    return;
  }

  const activationTime = new Date();
  const lesson2UnlockTime = new Date(activationTime.getTime() + 24 * 60 * 60 * 1000);
  const lesson3UnlockTime = new Date(activationTime.getTime() + 48 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      lesson1Unlocked: true,
      lesson2Unlocked: false,
      lesson3Unlocked: false,
      lesson2UnlockTime,
      lesson3UnlockTime,
    },
  });

  await ctx.reply(
    "Perfect. Ti-am activat seria gratuita: Lectia 1 este disponibila acum, iar Lectiile 2 si 3 se deblocheaza automat, cate una pe zi.",
    {
      reply_markup: getMainMenuKeyboard({ showLessons: true }).reply_markup,
    },
  );

  await deliverLesson(userId, 1);
  await scheduleFreeLessonCampaign(userId);
}

export async function continueRequestedService(ctx: Context, user: BotUser, action: PublicEntryKey): Promise<void> {
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!currentUser) {
    return;
  }

  const showLessons = hasStartedFreeLessons(currentUser);

  if (action === "free_lessons") {
    await startFreeLessonsForUser(ctx, user.id);
  } else if (action === "fear_speaking") {
    await ctx.reply(buildStaticPageMessage("fear_speaking"), {
      parse_mode: "Markdown",
      reply_markup: buildServiceActionButtons(action, showLessons).reply_markup,
    });
  } else if (action === "teaching_method") {
    await replyWithSharedVideo(ctx, {
      title: STATIC_PAGES.method.title,
      body: STATIC_PAGES.method.body,
      action,
      showLessons,
      fileName: SERVICE_VIDEO_FILES.teachingMethod,
    });
  } else if (action === "about_academy") {
    if (SERVICE_VIDEO_FILES.aboutAcademy) {
      await replyWithSharedVideo(ctx, {
        title: STATIC_PAGES.academy.title,
        body: STATIC_PAGES.academy.body,
        action,
        showLessons,
        fileName: SERVICE_VIDEO_FILES.aboutAcademy,
      });
    } else {
      await ctx.reply(buildStaticPageMessage("academy"), {
        parse_mode: "Markdown",
        reply_markup: buildServiceActionButtons(action, showLessons).reply_markup,
      });
    }
  } else if (action === "services") {
    await ctx.reply(buildStaticPageMessage("programs"), {
      parse_mode: "Markdown",
      reply_markup: buildServiceActionButtons(action, showLessons).reply_markup,
    });
  } else if (action === "operator") {
    await ctx.reply(buildStaticPageMessage("operator"), {
      parse_mode: "Markdown",
      reply_markup: buildServiceActionButtons(action, showLessons).reply_markup,
    });
  } else if (action === "career_astrology") {
    await ctx.reply(buildStaticPageMessage("astrology"), {
      parse_mode: "Markdown",
      reply_markup: buildServiceActionButtons(action, showLessons).reply_markup,
    });
  }

  await logUserEvent({
    userId: user.id,
    eventType: "service_opened",
    metadata: {
      action,
      label: PUBLIC_ENTRY_LABELS[action],
      showLessons,
    },
  });
}

function buildStaticPageMessage(pageKey: keyof typeof STATIC_PAGES): string {
  const page = STATIC_PAGES[pageKey];
  return `*${page.title}*\n\n${page.body}`;
}

export function isPublicEntryAction(action: string): action is PublicEntryKey {
  return action in PUBLIC_ENTRY_LABELS;
}
