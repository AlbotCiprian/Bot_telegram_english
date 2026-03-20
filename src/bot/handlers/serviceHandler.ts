import path from "node:path";
import { Context, Markup } from "telegraf";
import { UI_LABELS } from "../../content/copy.js";
import { prisma } from "../../db/client.js";
import { BRANDING, PUBLIC_ENTRY_LABELS, PublicEntryKey, SERVICE_VIDEO_FILES, STATIC_PAGES, isMarathonVisible } from "../../content/staticContent.js";
import { logUserEvent } from "../../services/eventService.js";
import { deliverLesson, getLessonsMenu } from "../../services/lessonService.js";
import { scheduleFreeLessonCampaign } from "../../services/schedulerService.js";
import { buildMediaAssetKey, sendVideoAsset } from "../../services/mediaAssetService.js";
import { BotUser } from "../../types/bot.js";
import { config } from "../../utils/config.js";
import { resolveExistingMediaFile } from "../../utils/mediaAssets.js";
import { getMainMenuKeyboard } from "../menu.js";

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
}) {
  const buttons: InlineActionButton[] = [];

  if (params.primaryCallback && params.primaryLabel) {
    buttons.push(Markup.button.callback(params.primaryLabel, params.primaryCallback));
  } else if (params.primaryUrl && params.primaryLabel) {
    buttons.push(Markup.button.url(params.primaryLabel, params.primaryUrl));
  }

  if (params.includeCourseCta !== false) {
    buttons.push(Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course"));
  }

  buttons.push(Markup.button.callback(UI_LABELS.backToMenu, "menu:menu"));
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
    primaryCallback?: string;
    fallbackMode?: "button" | "preview";
    includeCourseCta?: boolean;
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
      uploadNoticeText: "Pregătesc video-ul. Prima încărcare poate dura câteva secunde.",
      missingFileText: `${caption}\n\nVideo-ul final trebuie înlocuit cu un MP4 optimizat pentru redare directă în Telegram.`,
      options: {
        caption,
        parse_mode: "Markdown",
        supports_streaming: true,
        reply_markup: buildActionButtons({
          showLessons: params.showLessons,
          primaryCallback: params.primaryCallback,
          primaryLabel: params.fallbackLabel,
          includeCourseCta: params.includeCourseCta,
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
        primaryCallback: params.primaryCallback,
        primaryLabel: params.fallbackLabel,
        includeCourseCta: params.includeCourseCta,
      }).reply_markup,
    });
    return;
  }

  await ctx.reply(caption, {
    parse_mode: "Markdown",
    reply_markup: buildActionButtons({
      showLessons: params.showLessons,
      primaryCallback: params.primaryCallback,
      primaryUrl: params.fallbackUrl,
      primaryLabel: params.fallbackLabel,
      includeCourseCta: params.includeCourseCta,
    }).reply_markup,
  });
}

function resolveAstrologyVideoAsset() {
  const optimizedPath = path.resolve(config.STREAM_MP4_ROOT, "career-astrology.mp4");
  const optimizedVideoPath = resolveExistingMediaFile(optimizedPath);

  if (optimizedVideoPath) {
    return {
      assetKey: buildMediaAssetKey("service", "career-astrology.mp4"),
      sourceFileName: "career-astrology.mp4",
      localFilePath: optimizedVideoPath,
    };
  }

  return {
    assetKey: buildMediaAssetKey("service", SERVICE_VIDEO_FILES.astrologyConsultation),
    sourceFileName: SERVICE_VIDEO_FILES.astrologyConsultation,
    localFilePath: resolveExistingMediaFile(SERVICE_VIDEO_FILES.astrologyConsultation),
  };
}

async function replyWithAstrologyVideo(ctx: Context, params: { title: string; body: string }) {
  const caption = `*${params.title}*\n\n${params.body}`;
  const videoAsset = resolveAstrologyVideoAsset();

  if (ctx.chat?.id) {
    const result = await sendVideoAsset({
      chatId: ctx.chat.id.toString(),
      assetKey: videoAsset.assetKey,
      localFilePath: videoAsset.localFilePath,
      sourceFileName: videoAsset.sourceFileName,
      uploadNoticeText: "Pregătesc video-ul. Prima încărcare poate dura câteva secunde.",
      missingFileText: `${caption}\n\nVideo-ul pentru această secțiune nu este disponibil încă pe server.`,
      options: {
        caption,
        parse_mode: "Markdown",
        supports_streaming: true,
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback(UI_LABELS.wantsAstrologyConsultation, "menu:astrology_request")],
          [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
        ]).reply_markup,
      },
    });

    if (result !== "missing") {
      return;
    }
  }

  await ctx.reply(caption, {
    parse_mode: "Markdown",
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(UI_LABELS.wantsAstrologyConsultation, "menu:astrology_request")],
      [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
    ]).reply_markup,
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
    "Perfect. Ți-am activat cele 3 lecții gratuite.\n\nÎn fiecare zi vei primi câte o lecție nouă, ca să construiești pas cu pas o bază sigură în engleză.",
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
    if (!isMarathonVisible()) {
      await ctx.reply("Maratonul de engleză nu este activ în această perioadă. Revino puțin mai târziu.");
      return;
    }

    await ctx.reply(`*${STATIC_PAGES.marathon.title}*\n\n${STATIC_PAGES.marathon.body}`, {
      parse_mode: "Markdown",
      reply_markup: buildActionButtons({
        showLessons,
        primaryUrl: `${BRANDING.websiteUrl}#marathon`,
        primaryLabel: "🚀 Vezi maratonul",
        includeCourseCta: false,
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
  } else if (action === "website") {
    await ctx.reply(buildStaticPageMessage("website"), {
      parse_mode: "Markdown",
      reply_markup: buildActionButtons({
        showLessons,
        primaryUrl: BRANDING.websiteUrl,
        primaryLabel: UI_LABELS.viewServices,
        includeCourseCta: false,
      }).reply_markup,
    });
  } else if (action === "career_astrology") {
    await replyWithAstrologyVideo(ctx, {
      title: STATIC_PAGES.astrology.title,
      body: STATIC_PAGES.astrology.body,
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
