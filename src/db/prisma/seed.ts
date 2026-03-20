import { PrismaClient } from "@prisma/client";
import { LESSON_SEED_CONTENT } from "../../content/staticContent.js";
import { logger } from "../../utils/logger.js";
import "../../utils/config.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const campaign = await prisma.campaign.upsert({
    where: { key: "free-lessons" },
    update: {
      name: "Express English Academy - 3 lecții gratuite",
      type: "drip",
      isActive: true,
    },
    create: {
      key: "free-lessons",
      name: "Express English Academy - 3 lecții gratuite",
      type: "drip",
      isActive: true,
    },
  });

  for (const lesson of LESSON_SEED_CONTENT) {
    await prisma.lesson.upsert({
      where: { key: lesson.key },
      update: {
        campaignId: campaign.id,
        dayNumber: lesson.dayNumber,
        title: lesson.title,
        messageText: lesson.messageText,
        mediaType: lesson.mediaType,
        mediaUrl: lesson.mediaUrl,
        cta: lesson.cta,
        isActive: true,
      },
      create: {
        campaignId: campaign.id,
        key: lesson.key,
        dayNumber: lesson.dayNumber,
        title: lesson.title,
        messageText: lesson.messageText,
        mediaType: lesson.mediaType,
        mediaUrl: lesson.mediaUrl,
        cta: lesson.cta,
        isActive: true,
      },
    });
  }

  logger.info("Seed finalizat cu succes.");
}

main()
  .catch((error) => {
    logger.error({ err: error }, "Seed esuat.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
