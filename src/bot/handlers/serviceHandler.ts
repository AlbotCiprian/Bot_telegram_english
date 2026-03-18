import { Context, Markup } from "telegraf";
import { prisma } from "../../db/client.js";
import { BRANDING, PUBLIC_ENTRY_LABELS, PublicEntryKey, SERVICE_VIDEO_FILES, STATIC_PAGES } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { deliverLesson, getLessonsMenu } from "../../services/lessonService.js";
import { scheduleFreeLessonCampaign } from "../../services/schedulerService.js";
import { buildMediaAssetKey, sendVideoAsset } from "../../services/mediaAssetService.js";
import { BotUser } from "../../types/bot.js";
import { config } from "../../utils/config.js";
import { resolveExistingMediaFile } from "../../utils/mediaAssets.js";
import { getMainMenuKeyboard } from "../menu.js";
import { startConsultationRequestFlow } from "./consultationHandler.js";

type InlineActionButton = ReturnType<typeof Markup.button.url> | ReturnType<typeof Markup.button.callback>;

function hasStartedFreeLessons(user: {
  lesson1Unlocked: boolean;
  lesson2Unlocked: boolean;
  lesson3Unlocked: boolean;
  currentLessonDay: number;
}): boolean {
  return user.lesson1Unlocked || user.lesson2Unlocked || user.lesson3Unlocked || user.currentLessonDay > 0;
}

function buildActionButtons(params: {
  showLessons: boolean;
  primaryUrl?: string;
  primaryLabel?: string;
  primaryCallback?: string;
  includeCourseCta?: boolean;
  operatorShortcut?: boolean;
}) {
  const buttons: InlineActionButton[] = [];

  if (params.primaryCallback && params.primaryLabel) {
    buttons.push(Markup.button.callback(params.primaryLabel, params.primaryCallback));
  } else if (params.primaryUrl && params.primaryLabel) {
    buttons.push(Markup.button.url(params.primaryLabel, params.primaryUrl));
  }

  if (params.includeCourseCta !== false) {
    buttons.push(Markup.button.callback("📞 Vreau la curs", "menu:wants_course"));
  }

  if (params.operatorShortcut) {
    buttons.push(Markup.button.callback("📞 Contact operator", "menu:operator"));
  }

  if (params.showLessons) {
    buttons.push(Markup.button.callback("📚 Lectiile tale", "menu:lessons"));
  }

  buttons.push(Markup.button.callback("⬅️ Meniul principal", "menu:menu"));
  return Markup.inlineKeyboard(buttons, { columns: 1 });
}

async function replyWithSharedVideo(
  ctx: Context,
  params: {
    title: string;
    body: string;
    showLessons: boolean;
    fileName: string;
    fallbackUrl?: string;
    fallbackLabel?: string;
    fallbackMode?: "button" | "preview";
    includeCourseCta?: boolean;
    operatorShortcut?: boolean;
  },
): Promise<void> {
  const localVideoPath = params.fileName ? resolveExistingMediaFile(params.fileName) : null;
  const caption = `*${params.title}*\n\n${params.body}`;

  if (ctx.chat?.id && params.fileName) {
    const result = await sendVideoAsset({
      chatId: ctx.chat.id.toString(),
      assetKey: buildMediaAssetKey("service", params.fileName),
      localFilePath: localVideoPath,
      sourceFileName: params.fileName,
      uploadNoticeText: "Pregatesc video-ul. Prima incarcare poate dura cateva secunde.",
      missingFileText: `${caption}\n\nVideo-ul final trebuie inlocuit cu un MP4 optimizat pentru redare directa in Telegram.`,
      options: {
        caption,
        parse_mode: "Markdown",
        supports_streaming: true,
        reply_markup: buildActionButtons({
          showLessons: params.showLessons,
          includeCourseCta: params.includeCourseCta,
          operatorShortcut: params.operatorShortcut,
        }).reply_markup,
      },
    });

    if (result !== "missing") {
      return;
    }
  }

  if (params.fallbackUrl && params.fallbackMode === "preview") {
    await ctx.reply(`${caption}\n\n${params.fallbackUrl}`, {
      parse_mode: "Markdown",
      link_preview_options: {
        is_disabled: false,
      },
      reply_markup: buildActionButtons({
        showLessons: params.showLessons,
        includeCourseCta: params.includeCourseCta,
        operatorShortcut: params.operatorShortcut,
      }).reply_markup,
    });
    return;
  }

  await ctx.reply(caption, {
    parse_mode: "Markdown",
    reply_markup: buildActionButtons({
      showLessons: params.showLessons,
      primaryUrl: params.fallbackUrl,
      primaryLabel: params.fallbackLabel,
      includeCourseCta: params.includeCourseCta,
      operatorShortcut: params.operatorShortcut,
    }).reply_markup,
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
    "Perfect. Ti-am activat seria gratuita. Lectia 1 este disponibila acum, iar Lectiile 2 si 3 se deblocheaza automat, cate una pe zi.",
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
  } else if (action === "marathon") {
    await ctx.reply(buildStaticPageMessage("marathon"), {
      parse_mode: "Markdown",
      reply_markup: buildActionButtons({
        showLessons,
        primaryCallback: "menu:marathon_price",
        primaryLabel: "💬 Cere PRET",
        operatorShortcut: true,
      }).reply_markup,
    });
  } else if (action === "fear_speaking") {
    await replyWithSharedVideo(ctx, {
      title: STATIC_PAGES.fear_speaking.title,
      body: STATIC_PAGES.fear_speaking.body,
      showLessons,
      fileName: SERVICE_VIDEO_FILES.fearSpeaking,
      fallbackUrl: config.WEBINAR_URL,
      fallbackMode: "preview",
    });
  } else if (action === "teaching_method") {
    await replyWithSharedVideo(ctx, {
      title: STATIC_PAGES.method.title,
      body: STATIC_PAGES.method.body,
      showLessons,
      fileName: SERVICE_VIDEO_FILES.teachingMethod,
    });
  } else if (action === "services") {
    await ctx.reply(buildStaticPageMessage("programs"), {
      parse_mode: "Markdown",
      reply_markup: buildActionButtons({
        showLessons,
        primaryUrl: BRANDING.websiteUrl,
        primaryLabel: "🌐 Vezi serviciile",
      }).reply_markup,
    });
  } else if (action === "operator") {
    await ctx.reply(buildStaticPageMessage("operator"), {
      parse_mode: "Markdown",
      reply_markup: buildActionButtons({
        showLessons,
      }).reply_markup,
    });
    await startConsultationRequestFlow(ctx, user, {
      requestedService: "operator",
      priority: "urgent_contact",
    });
  } else if (action === "career_astrology") {
    await ctx.reply(buildStaticPageMessage("astrology"), {
      parse_mode: "Markdown",
      reply_markup: buildActionButtons({
        showLessons,
      }).reply_markup,
    });
    await startConsultationRequestFlow(ctx, user, {
      requestedService: "career_astrology",
      priority: "consultation",
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
