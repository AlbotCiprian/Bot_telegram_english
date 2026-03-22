import { createBot } from "./bot/bot.js";
import { buildApp } from "./app.js";
import { prisma } from "./db/client.js";
import { closeRedisClient } from "./services/redis.js";
import { logger } from "./utils/logger.js";
import { config, isConfigured } from "./utils/config.js";

async function configureTelegramProfile(bot: ReturnType<typeof createBot>): Promise<void> {
  const botCommands = [
    { command: "start", description: "Pornește botul și onboarding-ul" },
    { command: "menu", description: "Deschide meniul principal" },
    { command: "help", description: "Ajutor și explicații" },
  ];

  const operations: Array<Promise<unknown>> = [
    bot.telegram.setMyCommands(botCommands),
    bot.telegram.setChatMenuButton({
      menuButton: {
        type: "commands",
      },
    }),
    bot.telegram.setMyDescription(
      "3 lecții gratuite de engleză, cursuri de engleză pentru fluență și programe pentru profesii diferite. 💫",
    ),
    bot.telegram.setMyShortDescription("Trimite /start și începem. 💫"),
  ];

  const results = await Promise.allSettled(operations);
  for (const result of results) {
    if (result.status === "rejected") {
      logger.warn({ err: result.reason }, "Nu am putut actualiza complet profilul botului în Telegram.");
    }
  }
}

async function bootstrap(): Promise<void> {
  const app = buildApp();

  await app.listen({
    host: config.APP_HOST,
    port: config.APP_PORT,
  });

  logger.info({ port: config.APP_PORT }, "HTTP server pornit.");

  if (isConfigured(config.TELEGRAM_BOT_TOKEN)) {
    const bot = createBot();
    await configureTelegramProfile(bot);

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
