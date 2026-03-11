import fs from "node:fs";
import path from "node:path";
import { User } from "@prisma/client";
import { Input, Markup } from "telegraf";
import { prisma } from "../db/client.js";
import { logUserEvent } from "./eventService.js";
import { getTelegramClient } from "./telegram.js";
import { getDelayMap } from "../utils/schedule.js";

type LessonCta = {
  label: string;
  action: string;
};

type LessonAvailability = {
  dayNumber: 1 | 2 | 3;
  unlocked: boolean;
  completed: boolean;
  unlockAt: Date | null;
  remainingLabel: string | null;
};

const LOCAL_VIDEO_DIR = path.resolve(process.cwd(), "video");

function buildCtaKeyboard(cta: LessonCta[] | null | undefined) {
  if (!cta || cta.length === 0) {
    return undefined;
  }

  return Markup.inlineKeyboard(
    cta.map((item) => [Markup.button.callback(item.label, `menu:${item.action}`)]),
  );
}

function buildLessonActionKeyboard(dayNumber: 1 | 2 | 3) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("▶️ Deschide lectia", `lesson:open:${dayNumber}`)],
    [Markup.button.callback("📚 Lectiile tale", "menu:lessons")],
  ]);
}

function buildCourseCtaKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("📞 Vreau sa aflu despre curs", "menu:wants_course")]]);
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

function isLessonUnlocked(user: User, dayNumber: 1 | 2 | 3): boolean {
  if (dayNumber === 1) {
    return user.lesson1Unlocked;
  }

  if (dayNumber === 2) {
    return user.lesson2Unlocked;
  }

  return user.lesson3Unlocked;
}

function getLessonUnlockTime(user: User, dayNumber: 1 | 2 | 3): Date | null {
  if (dayNumber === 1) {
    return user.onboardingCompletedAt;
  }

  if (dayNumber === 2) {
    return user.lesson2UnlockTime;
  }

  return user.lesson3UnlockTime;
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
  rows.push([Markup.button.callback("Meniul principal", "menu:menu")]);
  return Markup.inlineKeyboard(rows);
}

function getUnlockUpdate(dayNumber: 2 | 3): Record<string, boolean> {
  if (dayNumber === 2) {
    return { lesson2Unlocked: true };
  }

  return { lesson3Unlocked: true };
}

function resolveLocalMediaPath(mediaUrl: string): string {
  if (path.isAbsolute(mediaUrl)) {
    return mediaUrl;
  }

  return path.resolve(LOCAL_VIDEO_DIR, mediaUrl);
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

  if (user.leadFormCompleted && user.onboardingCompletedAt && !user.lesson1Unlocked) {
    updateData.lesson1Unlocked = true;
  }

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
  return {
    text: buildLessonsMenuText(user),
    replyMarkup: buildLessonsMenuKeyboard(user).reply_markup,
  };
}

export async function getLockedLessonMessage(userId: number, dayNumber: 1 | 2 | 3): Promise<string | null> {
  const user = await syncLessonUnlockState(userId);

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

export async function unlockLesson(userId: number, dayNumber: 2 | 3): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return;
  }

  if (isLessonUnlocked(user, dayNumber)) {
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
      reply_markup: buildLessonActionKeyboard(dayNumber).reply_markup,
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

async function sendLessonBody(params: {
  chatId: string;
  title: string;
  messageText: string;
  mediaType: string;
  mediaUrl: string | null;
  cta: LessonCta[] | null | undefined;
}) {
  const telegram = getTelegramClient();
  const caption = [`*${params.title}*`, "", params.messageText].join("\n");
  const replyMarkup = buildCtaKeyboard(params.cta)?.reply_markup;

  if (params.mediaType === "video_file" && params.mediaUrl) {
    const localVideoPath = resolveLocalMediaPath(params.mediaUrl);

    if (fs.existsSync(localVideoPath)) {
      await telegram.sendVideo(params.chatId, Input.fromLocalFile(localVideoPath), {
        caption,
        parse_mode: "Markdown",
        supports_streaming: true,
        reply_markup: replyMarkup,
      });
      return;
    }
  }

  const lines = [`*${params.title}*`, "", params.messageText];
  if (params.mediaType === "video_link" && params.mediaUrl) {
    lines.push("", `Video: ${params.mediaUrl}`);
  }

  await telegram.sendMessage(params.chatId, lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: replyMarkup,
  });
}

export async function deliverLesson(userId: number, dayNumber: 1 | 2 | 3): Promise<void> {
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
    title: lesson.title,
    messageText: lesson.messageText,
    mediaType: lesson.mediaType,
    mediaUrl: lesson.mediaUrl,
    cta: (lesson.cta as LessonCta[] | null) ?? undefined,
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

  await logUserEvent({
    userId,
    eventType: "lesson_delivered",
    metadata: {
      dayNumber,
      lessonKey: lesson.key,
    },
  });

  if (dayNumber === 3) {
    const telegram = getTelegramClient();
    await telegram.sendMessage(
      user.telegramId.toString(),
      "Felicitari! Ai terminat cele 3 lectii gratuite.\n\nVrei sa vezi ce program ti se potriveste?",
      {
        reply_markup: buildCourseCtaKeyboard().reply_markup,
      },
    );
  }
}

export async function sendReminder(userId: number, kind: "follow_up" | "inactive" | "long_reminder"): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    return;
  }

  if (user.profile && !user.profile.consentMarketing && kind !== "follow_up") {
    return;
  }

  const delayMap = getDelayMap();
  const elapsed = Date.now() - user.lastInteractionAt.getTime();
  const minElapsedByKind = {
    follow_up: 0,
    inactive: Math.floor(delayMap.inactiveMs * 0.75),
    long_reminder: Math.floor(delayMap.longReminderMs * 0.75),
  };

  if (elapsed < minElapsedByKind[kind]) {
    return;
  }

  const reminderMap = {
    follow_up:
      "Cum ti s-au parut lectiile gratuite? Daca vrei continuarea potrivita pentru obiectivul tau, apasa pe Vreau la curs.",
    inactive:
      "Nu ai mai intrat de ceva timp. Daca ti-au placut lectiile, putem continua cu un plan mai clar pentru tine.",
    long_reminder:
      "Mai vrei sa continui cu engleza intr-un ritm sustenabil? Apasa pe Vreau la curs si continuam de aici.",
  };

  const telegram = getTelegramClient();
  await telegram.sendMessage(user.telegramId.toString(), reminderMap[kind], {
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback("📞 Vreau la curs", "menu:wants_course")],
      [Markup.button.callback("📚 Lectiile tale", "menu:lessons")],
      [Markup.button.callback("Meniul principal", "menu:menu")],
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
