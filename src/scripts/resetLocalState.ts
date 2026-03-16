import { prisma } from "../db/client.js";
import { campaignQueue, crmQueue } from "../services/queue.js";

async function resetLocalState() {
  await prisma.userCampaign.deleteMany();
  await prisma.botSession.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.crmSyncLog.deleteMany();
  await prisma.userEvent.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

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

  console.log("Bot state reset complete.");
}

resetLocalState().catch(async (error) => {
  console.error("Failed to reset local bot state.", error);
  await prisma.$disconnect();
  process.exit(1);
});
