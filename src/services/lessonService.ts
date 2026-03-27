import { User } from "@prisma/client";
import { Markup } from "telegraf";
import { UI_LABELS } from "../content/copy.js";
import { buildLessonDeliveryText, buildLessonQuizPrompt } from "../content/lessonCopy.js";
import { prisma } from "../db/client.js";
import { config } from "../utils/config.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";
import { logUserEvent } from "./eventService.js";
import { buildLessonQuizUrl, hasLessonQuiz } from "./lessonQuizService.js";
import { buildMediaAssetKey, sendVideoAsset } from "./mediaAssetService.js";
import { ensureCampaignJobScheduled } from "./schedulerService.js";
import { buildLessonWatchAccess } from "./streamingService.js";
import { isLessonStreamReady, supportsTelegramWebAppStreaming } from "./streamingAssets.js";
import { getTelegramClient } from "./telegram.js";

export type LessonDay = 1 | 2 | 3;
type UnlockDay = 2 | 3;
export type LessonNudgeAfterHours = 12 | 24;

type LessonAvailability = {
  dayNumber: LessonDay;
  unlocked: boolean;
  completed: boolean;
  unlockAt: Date | null;
  remainingLabel: string | null;
};

const QUIZ_UNLOCK_DELAY_MS = 60 * 1000;
export const LESSON_NUDGE_AFTER_HOURS = [12, 24] as const;
export const LESSON_NUDGE_DELAYS: Record<LessonNudgeAfterHours, number> = {
  12: 12 * 60 * 60 * 1000,
  24: 24 * 60 * 60 * 1000,
};

function isLessonOpened(params: {
  currentLessonDay: number;
  lessonProgress?: Array<{ dayNumber: number; openedAt: Date | null }>;
}, dayNumber: LessonDay): boolean {
  return params.currentLessonDay >= dayNumber || Boolean(params.lessonProgress?.some((progress) => progress.openedAt));
}

export async function getLessonUnlockEvent(userId: number, dayNumber: UnlockDay) {
  return prisma.userEvent.findFirst({
    where: {
      userId,
      eventType: "lesson_unlocked",
      metadata: {
        path: ["dayNumber"],
        equals: dayNumber,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasLessonUnlockEvent(userId: number, dayNumber: UnlockDay): Promise<boolean> {
  return Boolean(await getLessonUnlockEvent(userId, dayNumber));
}

export async function hasLessonNudgeEvent(
  userId: number,
  dayNumber: UnlockDay,
  afterHours: LessonNudgeAfterHours,
): Promise<boolean> {
  const event = await prisma.userEvent.findFirst({
    where: {
      userId,
      eventType: "lesson_nudge_sent",
      AND: [
        {
          metadata: {
            path: ["dayNumber"],
            equals: dayNumber,
          },
        },
        {
          metadata: {
            path: ["afterHours"],
            equals: afterHours,
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return Boolean(event);
}

export async function ensureLessonUnlockedFlag(userId: number, dayNumber: UnlockDay): Promise<void> {
  const updateData = getUnlockUpdate(dayNumber);
  const fieldName = dayNumber === 2 ? "lesson2Unlocked" : "lesson3Unlocked";

  await prisma.user.updateMany({
    where: {
      id: userId,
      [fieldName]: false,
    },
    data: updateData,
  });
}

export async function ensureLessonNudgeJobs(
  userId: number,
  dayNumber: UnlockDay,
): Promise<Array<{ afterHours: LessonNudgeAfterHours; status: "existing" | "recreated" | "scheduled" }>> {
  const results: Array<{ afterHours: LessonNudgeAfterHours; status: "existing" | "recreated" | "scheduled" }> = [];

  for (const afterHours of LESSON_NUDGE_AFTER_HOURS) {
    const status = await ensureCampaignJobScheduled(
      { userId, type: "lesson_nudge", dayNumber, afterHours },
      LESSON_NUDGE_DELAYS[afterHours],
    );
    results.push({ afterHours, status });
  }

  return results;
}

function formatRemainingTime(target: Date | null): string | null {
  if (!target) {
    return null;
  }

  const remainingMs = Math.max(target.getTime() - Date.now(), 0);
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
}

function isLessonUnlocked(user: User, dayNumber: LessonDay): boolean {
  if (dayNumber === 1) {
    return user.lesson1Unlocked;
  }

  if (dayNumber === 2) {
    return user.lesson2Unlocked;
  }

  return user.lesson3Unlocked;
}

function getLessonUnlockTime(user: User, dayNumber: LessonDay): Date | null {
  if (dayNumber === 1) {
    return null;
  }

  if (dayNumber === 2) {
    return user.lesson2UnlockTime;
  }

  return user.lesson3UnlockTime;
}

function hasStartedFreeLessons(user: User): boolean {
  return user.lesson1Unlocked || user.lesson2Unlocked || user.lesson3Unlocked || user.currentLessonDay > 0;
}

function shouldUseInternalLessonStream(dayNumber: LessonDay): boolean {
  return config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream" && isLessonStreamReady(dayNumber);
}

function getLessonAvailability(user: User): LessonAvailability[] {
  return ([1, 2, 3] as const).map((dayNumber) => {
    const unlocked = isLessonUnlocked(user, dayNumber);
    const completed = user.currentLessonDay >= dayNumber;
    const unlockAt = getLessonUnlockTime(user, dayNumber);

    return {
      dayNumber,
      unlocked,
      completed,
      unlockAt,
      remainingLabel: unlocked ? null : formatRemainingTime(unlockAt),
    };
  });
}

function buildLessonsMenuText(user: User): string {
  const lessonAvailability = getLessonAvailability(user);
  const lines = [
    "Perfect. Timp de 3 zile vei primi câte o lecție gratuită de engleză, ca să pui o bază solidă.",
    "",
  ];

  for (const lesson of lessonAvailability) {
    if (lesson.completed) {
      lines.push(`✅ Lecția ${lesson.dayNumber}`);
      continue;
    }

    if (lesson.unlocked) {
      lines.push(`🎓 Lecția ${lesson.dayNumber} - disponibilă acum`);
      continue;
    }

    lines.push(`🔒 Lecția ${lesson.dayNumber} - se deschide în ${lesson.remainingLabel ?? "00h 00m"}`);
  }

  return lines.join("\n");
}

function buildLessonsMenuKeyboard(user: User) {
  if (!hasStartedFreeLessons(user)) {
    return Markup.inlineKeyboard([
      [Markup.button.callback("🎓 Începe cele 3 lecții gratuite", "menu:free_lessons")],
      [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
    ]);
  }

  const rows = ([1, 2, 3] as const).map((dayNumber) => {
    const unlocked = isLessonUnlocked(user, dayNumber);
    return [
      Markup.button.callback(unlocked ? `▶️ Lecția ${dayNumber}` : `🔒 Lecția ${dayNumber}`, `lesson:open:${dayNumber}`),
    ];
  });

  rows.push([Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course")]);
  rows.push([Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")]);
  return Markup.inlineKeyboard(rows);
}

function buildUnlockNotificationKeyboard(dayNumber: UnlockDay) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(UI_LABELS.openLesson, `lesson:open:${dayNumber}`)],
    [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
  ]);
}

function buildDeliveredLessonKeyboard(dayNumber: LessonDay) {
  const rows = [];

  if (hasLessonQuiz(dayNumber)) {
    rows.push([Markup.button.callback(UI_LABELS.testYourself, `lesson:quiz:${dayNumber}`)]);
  }

  rows.push([Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course")]);
  rows.push([Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")]);

  return Markup.inlineKeyboard(rows);
}

function buildStreamLessonKeyboard(dayNumber: LessonDay, watchUrl: string) {
  const rows = [];

  if (supportsTelegramWebAppStreaming()) {
    rows.push([Markup.button.webApp(UI_LABELS.streamLesson, watchUrl)]);
    rows.push([Markup.button.url(UI_LABELS.openLessonInBrowser, watchUrl)]);
  } else {
    rows.push([Markup.button.url(UI_LABELS.streamLesson, watchUrl)]);
  }

  if (hasLessonQuiz(dayNumber)) {
    rows.push([Markup.button.url(UI_LABELS.testYourself, buildLessonQuizUrl(watchUrl))]);
  }

  rows.push([Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course")]);
  rows.push([Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")]);

  return Markup.inlineKeyboard(rows);
}

function buildCourseCtaKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course")],
    [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
  ]);
}

function getUnlockUpdate(dayNumber: UnlockDay): Record<string, boolean> {
  if (dayNumber === 2) {
    return { lesson2Unlocked: true };
  }

  return { lesson3Unlocked: true };
}

async function ensureLessonProgress(userId: number, dayNumber: LessonDay) {
  const existingProgress = await prisma.lessonProgress.findUnique({
    where: {
      userId_dayNumber: {
        userId,
        dayNumber,
      },
    },
  });

  if (existingProgress) {
    return existingProgress;
  }

  const now = new Date();
  return prisma.lessonProgress.create({
    data: {
      userId,
      dayNumber,
      openedAt: now,
      streamSessionCreatedAt:
        config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream" ? now : null,
      videoSentAt:
        config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream" ? null : now,
      quizAvailableAt:
        config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream"
          ? null
          : new Date(now.getTime() + QUIZ_UNLOCK_DELAY_MS),
    },
  });
}

async function sendLessonTelegramVideo(params: {
  chatId: string;
  dayNumber: LessonDay;
  title: string;
  messageText: string;
  mediaUrl: string | null;
}) {
  const telegram = getTelegramClient();
  const caption = buildLessonDeliveryText(params.title, params.messageText);
  const localVideoPath = params.mediaUrl ? resolveExistingMediaFile(params.mediaUrl) : null;

  if (params.mediaUrl) {
    const status = await sendVideoAsset({
      chatId: params.chatId,
      assetKey: buildMediaAssetKey("lesson", params.mediaUrl),
      localFilePath: localVideoPath,
      sourceFileName: params.mediaUrl,
      uploadNoticeText: "Pregătesc lecția video. Prima încărcare poate dura câteva secunde.",
      missingFileText: `${caption}\n\nVideo-ul pentru această lecție trebuie copiat în folderul video/ de pe server.`,
      uploadFailedText:
        "Nu am putut livra video-ul acestei lecții în configurația curentă. Pentru fișierele mari, activează Local Bot API Server și încearcă din nou.",
      options: {
        caption,
        parse_mode: "Markdown",
        supports_streaming: true,
        reply_markup: buildDeliveredLessonKeyboard(params.dayNumber).reply_markup,
      },
    });

    if (status !== "missing" && status !== "failed") {
      return "video";
    }

    if (status === "failed") {
      return "failed";
    }
  }

  await telegram.sendMessage(
    params.chatId,
    `${caption}\n\nVideo-ul pentru această lecție trebuie copiat în folderul video/ de pe server.`,
    {
      parse_mode: "Markdown",
      reply_markup: buildDeliveredLessonKeyboard(params.dayNumber).reply_markup,
    },
  );

  return "missing";
}

async function sendLessonStreamAccess(params: {
  userId: number;
  chatId: string;
  dayNumber: LessonDay;
  title: string;
  messageText: string;
}) {
  const telegram = getTelegramClient();
  const access = buildLessonWatchAccess(params.userId, params.dayNumber);
  const text = buildLessonDeliveryText(params.title, params.messageText);

  await telegram.sendMessage(params.chatId, text, {
    parse_mode: "Markdown",
    reply_markup: buildStreamLessonKeyboard(params.dayNumber, access.watchUrl).reply_markup,
  });
}

async function sendCourseFollowUp(chatId: string): Promise<void> {
  const telegram = getTelegramClient();
  await telegram.sendMessage(
    chatId,
    [
      "Noi suntem profesorii care te susținem 🪄😍",
      "",
      "Pentru noi e important succesul și progresul tău ❤️",
      "",
      "Cu mare grijă și dedicare îți pregătim un program personalizat după ritmul tău de învățare și engleza reală de care ai nevoie 😊",
      "",
      "Alege să înveți azi engleza cu noi și primești 10% reducere la orice curs ✅",
    ].join("\n"),
    {
      reply_markup: buildCourseCtaKeyboard().reply_markup,
    },
  );
}

async function markLessonCompletion(userId: number, dayNumber: LessonDay, lessonKey: string, deliveryMode: string) {
  await logUserEvent({
    userId,
    eventType: "lesson_delivered",
    metadata: {
      dayNumber,
      lessonKey,
      deliveryMode,
    },
  });
}

export async function getLessonVideoCacheStats() {
  return prisma.telegramMediaAsset.count({
    where: {
      assetKey: {
        startsWith: "lesson:",
      },
    },
  });
}

export async function getTotalMediaCacheStats() {
  return prisma.telegramMediaAsset.count();
}

export async function markLessonOpened(userId: number, dayNumber: LessonDay): Promise<void> {
  const now = new Date();
  await prisma.lessonProgress.upsert({
    where: {
      userId_dayNumber: {
        userId,
        dayNumber,
      },
    },
    update: {
      openedAt: now,
      streamSessionCreatedAt:
        config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream" ? now : undefined,
    },
    create: {
      userId,
      dayNumber,
      openedAt: now,
      streamSessionCreatedAt:
        config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream" ? now : null,
      videoSentAt:
        config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream" ? null : now,
      quizAvailableAt:
        config.streamingEnabled && config.LESSON_DELIVERY_MODE === "internal_stream"
          ? null
          : new Date(now.getTime() + QUIZ_UNLOCK_DELAY_MS),
    },
  });
}

export async function markLessonVideoSent(userId: number, dayNumber: LessonDay): Promise<void> {
  const now = new Date();
  await prisma.lessonProgress.upsert({
    where: {
      userId_dayNumber: {
        userId,
        dayNumber,
      },
    },
    update: {
      videoSentAt: now,
      openedAt: now,
      quizAvailableAt: new Date(now.getTime() + QUIZ_UNLOCK_DELAY_MS),
    },
    create: {
      userId,
      dayNumber,
      videoSentAt: now,
      openedAt: now,
      quizAvailableAt: new Date(now.getTime() + QUIZ_UNLOCK_DELAY_MS),
    },
  });
}

export async function sendLessonMedia(
  chatId: string,
  dayNumber: LessonDay,
  title: string,
  messageText: string,
  mediaUrl: string | null,
) {
  await sendLessonTelegramVideo({
    chatId,
    dayNumber,
    title,
    messageText,
    mediaUrl,
  });
}

export async function sendReminder(userId: number, kind: "follow_up" | "inactive" | "long_reminder"): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    return;
  }

  if (user.profile?.consultationWanted) {
    return;
  }

  if (user.profile && !user.profile.consentMarketing && kind !== "follow_up") {
    return;
  }

  const reminderMap = {
    follow_up: "Sper că ți-au plăcut primele lecții. Dacă vrei să continui, apasă pe Vreau la curs și te ghidăm mai departe.",
    inactive: "Ai deja următoarea lecție disponibilă. Când ai câteva minute libere, o poți deschide direct din bot.",
    long_reminder: "Dacă vrei să continui engleza într-un ritm clar și ușor de urmat, noi te ajutăm cu plăcere mai departe.",
  };

  const telegram = getTelegramClient();
  await telegram.sendMessage(user.telegramId.toString(), reminderMap[kind], {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course")],
      [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
    ]).reply_markup,
  });

  await logUserEvent({
    userId,
    eventType: "reminder_sent",
    metadata: {
      kind,
    },
  });
}

export async function syncLessonUnlockState(userId: number): Promise<User> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User ${userId} nu există.`);
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {};

  if (!user.lesson2Unlocked && user.lesson2UnlockTime && user.lesson2UnlockTime <= now) {
    updateData.lesson2Unlocked = true;
  }

  if (!user.lesson3Unlocked && user.lesson3UnlockTime && user.lesson3UnlockTime <= now) {
    updateData.lesson3Unlocked = true;
  }

  if (Object.keys(updateData).length === 0) {
    return user;
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

export async function getLessonsMenu(
  userId: number,
): Promise<{ text: string; replyMarkup: ReturnType<typeof buildLessonsMenuKeyboard>["reply_markup"] }> {
  const user = await syncLessonUnlockState(userId);

  if (!hasStartedFreeLessons(user)) {
    return {
      text: [
        "*3 lecții gratuite*",
        "",
        "Nu ai activat încă cele 3 lecții gratuite.",
        "",
        "Apasă pe butonul de mai jos și îți deschidem imediat prima lecție.",
      ].join("\n"),
      replyMarkup: buildLessonsMenuKeyboard(user).reply_markup,
    };
  }

  return {
    text: buildLessonsMenuText(user),
    replyMarkup: buildLessonsMenuKeyboard(user).reply_markup,
  };
}

export async function getLockedLessonMessage(userId: number, dayNumber: LessonDay): Promise<string | null> {
  const user = await syncLessonUnlockState(userId);

  if (!hasStartedFreeLessons(user)) {
    return "Nu ai activat încă seria gratuită. Apasă pe «Începe cele 3 lecții gratuite» din meniu.";
  }

  if (isLessonUnlocked(user, dayNumber)) {
    return null;
  }

  const unlockTime = getLessonUnlockTime(user, dayNumber);
  return [
    "🔒 Această lecție nu este încă disponibilă.",
    "",
    "Se va debloca în:",
    "",
    `⏳ ${formatRemainingTime(unlockTime) ?? "00h 00m"}`,
  ].join("\n");
}

export async function unlockLesson(userId: number, dayNumber: UnlockDay): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      lessonProgress: {
        where: { dayNumber },
        select: {
          dayNumber: true,
          openedAt: true,
        },
      },
    },
  });

  if (!user) {
    return;
  }

  const alreadyOpened = isLessonOpened(user, dayNumber);
  const alreadyNotified = await hasLessonUnlockEvent(userId, dayNumber);

  if (alreadyOpened) {
    await ensureLessonUnlockedFlag(userId, dayNumber);
    return;
  }

  if (!alreadyNotified) {
    const telegram = getTelegramClient();
    await telegram.sendMessage(
    user.telegramId.toString(),
    `🎓 Lecția ${dayNumber} este acum disponibilă.\n\nCând ai câteva minute libere, o poți deschide direct din bot.`,
    {
      reply_markup: buildUnlockNotificationKeyboard(dayNumber).reply_markup,
    },
  );

    await logUserEvent({
      userId,
      eventType: "lesson_unlocked",
      metadata: {
        dayNumber,
      },
    });
  }

  await ensureLessonUnlockedFlag(userId, dayNumber);
  await ensureLessonNudgeJobs(userId, dayNumber);
}

export async function deliverLesson(userId: number, dayNumber: LessonDay): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    return;
  }

  const user = await syncLessonUnlockState(userId);

  if (!isLessonUnlocked(user, dayNumber)) {
    throw new Error(`Lecția ${dayNumber} nu este încă deblocată pentru userul ${userId}.`);
  }

  const campaign = await prisma.campaign.findUnique({
    where: { key: "free-lessons" },
  });

  if (!campaign) {
    throw new Error("Campania free-lessons nu există.");
  }

  const lesson = await prisma.lesson.findUnique({
    where: {
      campaignId_dayNumber: {
        campaignId: campaign.id,
        dayNumber,
      },
    },
  });

  if (!lesson) {
    throw new Error(`Lecția pentru ziua ${dayNumber} nu există.`);
  }

  await ensureLessonProgress(userId, dayNumber);

  let deliveryMode = "telegram_video";

  if (shouldUseInternalLessonStream(dayNumber)) {
    await sendLessonStreamAccess({
      userId,
      chatId: user.telegramId.toString(),
      dayNumber,
      title: lesson.title,
      messageText: lesson.messageText,
    });
    await markLessonOpened(userId, dayNumber);
    deliveryMode = "internal_stream";
  } else if (config.lessonTelegramFallback || config.LESSON_DELIVERY_MODE !== "internal_stream") {
    const telegramResult = await sendLessonTelegramVideo({
      chatId: user.telegramId.toString(),
      dayNumber,
      title: lesson.title,
      messageText: lesson.messageText,
      mediaUrl: lesson.mediaUrl,
    });
    if (telegramResult === "video") {
      await markLessonVideoSent(userId, dayNumber);
      deliveryMode = "telegram_video";
    } else {
      await markLessonOpened(userId, dayNumber);
      deliveryMode = telegramResult === "missing" ? "telegram_missing" : "telegram_failed";
    }
  } else {
    const telegram = getTelegramClient();
    await telegram.sendMessage(
      user.telegramId.toString(),
      "Lecția este deblocată, dar stream-ul intern nu este pregătit încă pe server. Revino în câteva minute.",
      {
        reply_markup: buildDeliveredLessonKeyboard(dayNumber).reply_markup,
      },
    );
    await markLessonOpened(userId, dayNumber);
    deliveryMode = "stream_not_ready";
  }

  const lastOpenedLesson = Math.max(user.currentLessonDay, dayNumber);
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentLessonDay: lastOpenedLesson,
    },
  });

  await prisma.userCampaign.updateMany({
    where: {
      userId,
      campaignId: campaign.id,
    },
    data: {
      lastLessonDay: lastOpenedLesson,
      status: lastOpenedLesson >= 3 ? "completed" : "active",
      completedAt: lastOpenedLesson >= 3 ? new Date() : null,
    },
  });

  await markLessonCompletion(userId, dayNumber, lesson.key, deliveryMode);

  if (dayNumber === 3) {
    await sendCourseFollowUp(user.telegramId.toString());
  }
}

export async function handleLessonQuiz(
  userId: number,
  dayNumber: LessonDay,
): Promise<{ status: "sent" | "locked" | "coming_soon" | "missing"; message?: string }> {
  const progress = await prisma.lessonProgress.findUnique({
    where: {
      userId_dayNumber: {
        userId,
        dayNumber,
      },
    },
  });

  if (!progress) {
    return {
      status: "missing",
      message: "Deschide mai întâi lecția și apoi revino la test.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      status: "missing",
      message: "Nu am putut găsi utilizatorul pentru acest test.",
    };
  }

  if (!hasLessonQuiz(dayNumber)) {
    return {
      status: "coming_soon",
      message: "Testul pentru această lecție apare imediat ce adăugăm conținutul final.",
    };
  }

  const telegram = getTelegramClient();
  const access = buildLessonWatchAccess(userId, dayNumber);
  const quizUrl = buildLessonQuizUrl(access.watchUrl);
  const unlocked = Boolean(progress.quizAvailableAt && progress.quizAvailableAt <= new Date());
  const promptMessage = buildLessonQuizPrompt(dayNumber, unlocked);

  await telegram.sendMessage(
    user.telegramId.toString(),
    promptMessage,
    {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url(UI_LABELS.testYourself, quizUrl)],
        [Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course")],
        [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
      ]).reply_markup,
    },
  );

  await logUserEvent({
    userId,
    eventType: "lesson_quiz_redirected",
    metadata: {
      dayNumber,
      quizUrl,
      unlocked,
    },
  });

  return { status: unlocked ? "sent" : "locked" };
}

export async function sendLessonNudge(userId: number, dayNumber: UnlockDay, afterHours: 12 | 24): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      lessonProgress: {
        where: { dayNumber },
      },
    },
  });

  if (!user || !isLessonUnlocked(user, dayNumber)) {
    return;
  }

  if (isLessonOpened(user, dayNumber)) {
    return;
  }

  if (await hasLessonNudgeEvent(userId, dayNumber, afterHours)) {
    return;
  }

  const message =
    afterHours === 12
      ? `Lecția ${dayNumber} te așteaptă. Când ai puțin timp, o poți deschide și continua seria gratuită.`
      : `Lecția ${dayNumber} este în continuare disponibilă. Dacă vrei să păstrezi ritmul, îți recomand să o deschizi astăzi.`;

  const telegram = getTelegramClient();
  await telegram.sendMessage(user.telegramId.toString(), message, {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(`▶️ Deschide lecția ${dayNumber}`, `lesson:open:${dayNumber}`)],
      [Markup.button.callback(UI_LABELS.wantsCourse, "menu:wants_course")],
      [Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")],
    ]).reply_markup,
  });

  await logUserEvent({
    userId,
    eventType: "lesson_nudge_sent",
    metadata: {
      dayNumber,
      afterHours,
    },
  });
}
