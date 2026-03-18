import { User } from "@prisma/client";
import { Markup } from "telegraf";
import { prisma } from "../db/client.js";
import { LESSON_ONE_QUIZ } from "../content/staticContent.js";
import { logUserEvent } from "./eventService.js";
import { getTelegramClient } from "./telegram.js";
import { scheduleCampaignJob } from "./schedulerService.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";
import { buildMediaAssetKey, sendVideoAsset } from "./mediaAssetService.js";

type LessonDay = 1 | 2 | 3;
type UnlockDay = 2 | 3;

type LessonAvailability = {
  dayNumber: LessonDay;
  unlocked: boolean;
  completed: boolean;
  unlockAt: Date | null;
  remainingLabel: string | null;
};

const QUIZ_UNLOCK_DELAY_MS = 60 * 1000;
const LESSON_NUDGE_DELAYS = {
  12: 12 * 60 * 60 * 1000,
  24: 24 * 60 * 60 * 1000,
} as const;

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
  const lines = ["*Progresul tau in seria gratuita:*", ""];

  for (const lesson of lessonAvailability) {
    if (lesson.completed) {
      lines.push(`✅ Lectia ${lesson.dayNumber}`);
      continue;
    }

    if (lesson.unlocked) {
      lines.push(`🎓 Lectia ${lesson.dayNumber} - disponibila acum`);
      continue;
    }

    lines.push(`🔒 Lectia ${lesson.dayNumber} - se deschide in ${lesson.remainingLabel ?? "00h 00m"}`);
  }

  return lines.join("\n");
}

function buildLessonsMenuKeyboard(user: User) {
  if (!hasStartedFreeLessons(user)) {
    return Markup.inlineKeyboard([
      [Markup.button.callback("🎓 Porneste 3 zile gratuite", "menu:free_lessons")],
      [Markup.button.callback("⬅️ Meniul principal", "menu:menu")],
    ]);
  }

  const rows = ([1, 2, 3] as const).map((dayNumber) => {
    const unlocked = isLessonUnlocked(user, dayNumber);
    return [
      Markup.button.callback(
        unlocked ? `▶️ Lectia ${dayNumber}` : `🔒 Lectia ${dayNumber}`,
        `lesson:open:${dayNumber}`,
      ),
    ];
  });

  rows.push([Markup.button.callback("📞 Vreau la curs", "menu:wants_course")]);
  rows.push([Markup.button.callback("⬅️ Meniul principal", "menu:menu")]);
  return Markup.inlineKeyboard(rows);
}

function buildUnlockNotificationKeyboard(dayNumber: UnlockDay) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("▶️ Deschide lectia", `lesson:open:${dayNumber}`)],
    [Markup.button.callback("📚 Lectiile tale", "menu:lessons")],
  ]);
}

function buildDeliveredLessonKeyboard(dayNumber: LessonDay) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📝 Testeaza-te", `lesson:quiz:${dayNumber}`)],
    [Markup.button.callback("📚 Lectiile tale", "menu:lessons")],
    [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
  ]);
}

function buildCourseCtaKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("📞 Vreau sa aflu despre curs", "menu:wants_course")]]);
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
      videoSentAt: now,
      quizAvailableAt: new Date(now.getTime() + QUIZ_UNLOCK_DELAY_MS),
      openedAt: now,
    },
  });
}

async function sendLessonBody(params: {
  chatId: string;
  dayNumber: LessonDay;
  title: string;
  messageText: string;
  mediaUrl: string | null;
}) {
  const telegram = getTelegramClient();
  const caption = [`*${params.title}*`, "", params.messageText].join("\n");
  const localVideoPath = params.mediaUrl ? resolveExistingMediaFile(params.mediaUrl) : null;

  if (params.mediaUrl) {
    const status = await sendVideoAsset({
      chatId: params.chatId,
      assetKey: buildMediaAssetKey("lesson", params.mediaUrl),
      localFilePath: localVideoPath,
      sourceFileName: params.mediaUrl,
      uploadNoticeText: "Pregatesc lectia video. Prima incarcare poate dura cateva secunde.",
      missingFileText: `${caption}\n\nVideo-ul pentru aceasta lectie trebuie copiat in folderul video/ pe server.`,
      uploadFailedText:
        "Nu am putut livra video-ul acestei lectii in configuratia curenta. Pentru fisierele mari, activeaza Local Bot API Server si incearca din nou.",
      options: {
        caption,
        parse_mode: "Markdown",
        supports_streaming: true,
        reply_markup: buildDeliveredLessonKeyboard(params.dayNumber).reply_markup,
      },
    });

    if (status !== "missing" && status !== "failed") {
      return;
    }

    if (status === "failed") {
      return;
    }
  }

  await telegram.sendMessage(
    params.chatId,
    `${caption}\n\nVideo-ul pentru aceasta lectie trebuie copiat in folderul video/ pe server.`,
    {
      parse_mode: "Markdown",
      reply_markup: buildDeliveredLessonKeyboard(params.dayNumber).reply_markup,
    },
  );
}

async function sendCourseFollowUp(chatId: string): Promise<void> {
  const telegram = getTelegramClient();
  await telegram.sendMessage(
    chatId,
    "Felicitari! Ai terminat cele 3 lectii gratuite.\n\nVrei sa vezi ce program ti se potriveste?",
    {
      reply_markup: buildCourseCtaKeyboard().reply_markup,
    },
  );
}

async function markLessonCompletion(userId: number, dayNumber: LessonDay, lessonKey: string) {
  await logUserEvent({
    userId,
    eventType: "lesson_delivered",
    metadata: {
      dayNumber,
      lessonKey,
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
  await prisma.lessonProgress.upsert({
    where: {
      userId_dayNumber: {
        userId,
        dayNumber,
      },
    },
    update: {
      openedAt: new Date(),
    },
    create: {
      userId,
      dayNumber,
      openedAt: new Date(),
      videoSentAt: new Date(),
      quizAvailableAt: new Date(Date.now() + QUIZ_UNLOCK_DELAY_MS),
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
  await sendLessonBody({
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
    follow_up: "Cum ti s-au parut primele lectii? Daca vrei continuarea potrivita, apasa pe Vreau la curs.",
    inactive: "Ai deja urmatoarea lectie disponibila. Deschide botul si continua in cateva minute.",
    long_reminder: "Daca vrei sa revii la engleza intr-un ritm clar si sustenabil, iti reactivam imediat traseul potrivit.",
  };

  const telegram = getTelegramClient();
  await telegram.sendMessage(user.telegramId.toString(), reminderMap[kind], {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
      [Markup.button.callback("📚 Lectiile tale", "menu:lessons")],
      [Markup.button.callback("⬅️ Meniul principal", "menu:menu")],
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

async function sendLessonOneQuiz(chatId: string): Promise<void> {
  const telegram = getTelegramClient();
  await telegram.sendMessage(
    chatId,
    "📝 Tema 1 - Present Simple\n\nRaspunde la intrebarile de mai jos direct in Telegram.",
  );

  for (const item of LESSON_ONE_QUIZ) {
    await telegram.sendQuiz(chatId, item.question, [...item.options], {
      correct_option_id: item.correctOptionIndex,
      is_anonymous: false,
      explanation: "Verifica regula de Present Simple si continua testul.",
    });
  }

  await telegram.sendMessage(
    chatId,
    "Perfect. Ai terminat testul pentru Lectia 1. In meniul Lectiile tale vezi cand se deschide urmatoarea lectie.",
    {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📚 Lectiile tale", "menu:lessons")],
        [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
      ]).reply_markup,
    },
  );
}

export async function syncLessonUnlockState(userId: number): Promise<User> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error(`User ${userId} nu exista.`);
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
        "*Lectiile tale*",
        "",
        "Nu ai activat inca seria gratuita de 3 zile.",
        "",
        "Apasa pe butonul de mai jos si iti deschidem imediat Lectia 1.",
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
    return "Nu ai activat inca seria gratuita. Apasa pe «Porneste 3 zile gratuite» din meniu.";
  }

  if (isLessonUnlocked(user, dayNumber)) {
    return null;
  }

  const unlockTime = getLessonUnlockTime(user, dayNumber);
  return [
    "🔒 Aceasta lectie nu este inca disponibila.",
    "",
    "Se va debloca in:",
    "",
    `⏳ ${formatRemainingTime(unlockTime) ?? "00h 00m"}`,
  ].join("\n");
}

export async function unlockLesson(userId: number, dayNumber: UnlockDay): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || isLessonUnlocked(user, dayNumber)) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: getUnlockUpdate(dayNumber),
  });

  const telegram = getTelegramClient();
  await telegram.sendMessage(
    user.telegramId.toString(),
    `🎓 Lectia ${dayNumber} este acum disponibila!\n\nContinua seria ta gratuita de engleza.`,
    {
      reply_markup: buildUnlockNotificationKeyboard(dayNumber).reply_markup,
    },
  );

  await scheduleCampaignJob({ userId, type: "lesson_nudge", dayNumber, afterHours: 12 }, LESSON_NUDGE_DELAYS[12]);
  await scheduleCampaignJob({ userId, type: "lesson_nudge", dayNumber, afterHours: 24 }, LESSON_NUDGE_DELAYS[24]);

  await logUserEvent({
    userId,
    eventType: "lesson_unlocked",
    metadata: {
      dayNumber,
    },
  });
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
    throw new Error(`Lectia ${dayNumber} nu este inca deblocata pentru userul ${userId}.`);
  }

  const campaign = await prisma.campaign.findUnique({
    where: { key: "free-lessons" },
  });

  if (!campaign) {
    throw new Error("Campania free-lessons nu exista.");
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
    throw new Error(`Lectia pentru ziua ${dayNumber} nu exista.`);
  }

  await sendLessonBody({
    chatId: user.telegramId.toString(),
    dayNumber,
    title: lesson.title,
    messageText: lesson.messageText,
    mediaUrl: lesson.mediaUrl,
  });

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

  await markLessonVideoSent(userId, dayNumber);
  await markLessonCompletion(userId, dayNumber, lesson.key);

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

  if (!progress?.videoSentAt) {
    return {
      status: "missing",
      message: "Deschide mai intai lectia video si apoi revino la test.",
    };
  }

  if (progress.quizAvailableAt && progress.quizAvailableAt > new Date()) {
    return {
      status: "locked",
      message: `Mai asteapta putin si apoi incepe testul.\n\n⏳ ${formatRemainingTime(progress.quizAvailableAt) ?? "00h 00m"}`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      status: "missing",
      message: "Nu am putut gasi utilizatorul pentru acest test.",
    };
  }

  if (dayNumber !== 1) {
    return {
      status: "coming_soon",
      message: "Testul pentru aceasta lectie vine imediat ce adaugam continutul final.",
    };
  }

  await sendLessonOneQuiz(user.telegramId.toString());

  await prisma.lessonProgress.update({
    where: {
      userId_dayNumber: {
        userId,
        dayNumber,
      },
    },
    data: {
      quizCompletedAt: progress.quizCompletedAt ?? new Date(),
    },
  });

  await logUserEvent({
    userId,
    eventType: "lesson_quiz_sent",
    metadata: {
      dayNumber,
      quiz: "present_simple",
    },
  });

  return { status: "sent" };
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

  const progress = user.lessonProgress[0];
  if (progress?.openedAt || user.currentLessonDay >= dayNumber) {
    return;
  }

  const message =
    afterHours === 12
      ? `Lectia ${dayNumber} este deja disponibila si te asteapta. Dureaza doar cateva minute.`
      : `Lectia ${dayNumber} este inca disponibila. Deschide-o acum ca sa continui seria gratuita fara pauza.`;

  const telegram = getTelegramClient();
  await telegram.sendMessage(user.telegramId.toString(), message, {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback(`▶️ Deschide lectia ${dayNumber}`, `lesson:open:${dayNumber}`)],
      [Markup.button.callback("📚 Lectiile tale", "menu:lessons")],
      [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
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
