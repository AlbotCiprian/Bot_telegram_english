import { prisma } from "../db/client.js";
import { campaignQueue, crmQueue } from "../services/queue.js";

async function resetLocalState() {
  await prisma.userCampaign.deleteMany();
  await prisma.botSession.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.crmSyncLog.deleteMany();
  await prisma.userEvent.deleteMany();

  await prisma.userProfile.updateMany({
    data: {
      englishLevel: null,
      goal: null,
      occupation: null,
      timeAvailable: null,
      consentPrivacy: false,
      consentMarketing: false,
      consultationWanted: false,
    },
  });

  await prisma.user.updateMany({
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

  try {
    await campaignQueue.obliterate({ force: true });
  } catch {
    await campaignQueue.drain(true);
  }

  try {
    await crmQueue.obliterate({ force: true });
  } catch {
    await crmQueue.drain(true);
  }

  await campaignQueue.close();
  await crmQueue.close();
  await prisma.$disconnect();

  console.log("Local bot state reset complete.");
}

resetLocalState().catch(async (error) => {
  console.error("Failed to reset local bot state.", error);
  await prisma.$disconnect();
  process.exit(1);
});
