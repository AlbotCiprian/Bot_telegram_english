import { prisma } from "../db/client.js";
import { campaignQueue, crmQueue } from "./queue.js";

export async function wipeBotState(): Promise<void> {
  await prisma.userCampaign.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.lessonQuizResult.deleteMany();
  await prisma.botSession.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.crmSyncLog.deleteMany();
  await prisma.userEvent.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.telegramMediaAsset.deleteMany();

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
}

export async function closeResetResources(): Promise<void> {
  await campaignQueue.close();
  await crmQueue.close();
  await prisma.$disconnect();
}
