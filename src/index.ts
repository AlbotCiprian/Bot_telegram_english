import { createBot } from "./bot/bot.js";
import { buildApp } from "./app.js";
import { prisma } from "./db/client.js";
import { closeRedisClient } from "./services/redis.js";
import { logger } from "./utils/logger.js";
import { config, isConfigured } from "./utils/config.js";

async function bootstrap(): Promise<void> {
  const app = buildApp();

  await app.listen({
    host: config.APP_HOST,
    port: config.APP_PORT,
  });

  logger.info({ port: config.APP_PORT }, "HTTP server pornit.");

  if (isConfigured(config.TELEGRAM_BOT_TOKEN)) {
    const bot = createBot();

    const shutdown = async () => {
      logger.info("Oprire controlata...");
      bot.stop();
      await app.close();
      await closeRedisClient();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    void bot
      .launch(
        {
          dropPendingUpdates: false,
        },
        () => {
          logger.info(
            {
              apiRoot: config.telegramApiRoot,
              localBotApi: config.telegramUseLocalApi,
            },
            "Bot Telegram pornit in polling mode.",
          );
        },
      )
      .catch(async (error) => {
        logger.error({ err: error }, "Pornirea botului Telegram a esuat.");
        await app.close();
        await closeRedisClient();
        await prisma.$disconnect();
        process.exit(1);
      });

    return;
  }

  logger.warn("TELEGRAM_BOT_TOKEN lipseste. HTTP server-ul ruleaza, botul nu porneste.");
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, "Bootstrapping esuat.");
  await closeRedisClient();
  await prisma.$disconnect();
  process.exit(1);
});
