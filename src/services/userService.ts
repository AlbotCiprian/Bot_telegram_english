import { prisma } from "../db/client.js";
import { cancelPendingUserJobs } from "./schedulerService.js";
import { clearSession } from "./sessionService.js";

type TelegramProfile = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export async function getOrCreateUser(from: TelegramProfile) {
  const telegramId = BigInt(from.id);
  return prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      languageCode: from.language_code ?? null,
      lastInteractionAt: new Date(),
    },
    update: {
      username: from.username ?? null,
      languageCode: from.language_code ?? null,
      lastInteractionAt: new Date(),
      ...(from.first_name ? { firstName: from.first_name } : {}),
      ...(from.last_name ? { lastName: from.last_name } : {}),
    },
  });
}

export async function touchUser(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastInteractionAt: new Date() },
  });
}

export async function ensureProfile(userId: number) {
  return prisma.userProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getUserWithProfile(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      session: true,
    },
  });
}

export async function resetUserForTesting(userId: number): Promise<void> {
  await cancelPendingUserJobs(userId);
  await clearSession(userId);

  await prisma.userCampaign.deleteMany({
    where: { userId },
  });

  await prisma.lessonProgress.deleteMany({
    where: { userId },
  });

  await prisma.lessonQuizResult.deleteMany({
    where: { userId },
  });

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      englishLevel: null,
      goal: null,
      occupation: null,
      timeAvailable: null,
      consentPrivacy: false,
      consentMarketing: false,
      consultationWanted: false,
    },
    create: {
      userId,
      consentPrivacy: false,
      consentMarketing: false,
      consultationWanted: false,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      phone: null,
      email: null,
      leadFormCompleted: false,
      onboardingCompletedAt: null,
      currentLessonDay: 0,
      lesson1Unlocked: false,
      lesson2Unlocked: false,
      lesson3Unlocked: false,
      lesson2UnlockTime: null,
      lesson3UnlockTime: null,
      kommoLeadId: null,
      kommoContactId: null,
    },
  });
}
