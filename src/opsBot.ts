import { Context, Telegraf } from "telegraf";
import { closeResetResources, wipeBotState } from "./services/resetService.js";
import { config, isConfigured } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import {
  formatOpsStatus,
  getDailyReportKey,
  getOpsStatus,
  hasIncident,
  isDailyReportMoment,
  restartExpressRuntime,
} from "./ops/monitoringService.js";

function parseAllowedUserIds(): Set<number> {
  return new Set(
    config.MONITOR_ALLOWED_USER_IDS
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
}

function isAuthorized(ctx: Context, allowedUserIds: Set<number>): boolean {
  if (allowedUserIds.size === 0) {
    return true;
  }

  return Boolean(ctx.from?.id && allowedUserIds.has(ctx.from.id));
}

async function safeReply(ctx: Context, text: string): Promise<void> {
  await ctx.reply(text, {
    parse_mode: "Markdown",
  });
}

async function bootstrapOpsBot(): Promise<void> {
  if (!isConfigured(config.MONITOR_BOT_TOKEN)) {
    logger.warn("MONITOR_BOT_TOKEN lipseste. Botul de monitoring nu porneste.");
    return;
  }

  const bot = new Telegraf<Context>(config.MONITOR_BOT_TOKEN);
  const allowedUserIds = parseAllowedUserIds();
  let incidentOpen = false;
  let lastDailyReportKey = "";

  bot.use(async (ctx, next) => {
    if (!isAuthorized(ctx, allowedUserIds)) {
      await ctx.reply("Nu ai acces la acest bot de monitoring.");
      return;
    }
    await next();
  });

  bot.start(async (ctx) => {
    await safeReply(
      ctx,
      [
        "*Ops Bot*",
        "",
        "Comenzi disponibile:",
        "/status",
        "/restart_express",
        "/reset_state CONFIRM",
      ].join("\n"),
    );
  });

  bot.command("status", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatOpsStatus(status));
  });

  bot.command("restart_express", async (ctx) => {
    await ctx.reply("Restart bot + worker in curs...");
    await restartExpressRuntime();
    await ctx.reply("Restart trimis catre containerele Express.");
  });

  bot.command("reset_state", async (ctx) => {
    const text = "message" in ctx && typeof (ctx.message as { text?: string }).text === "string"
      ? (ctx.message as { text: string }).text
      : "";

    if (!config.monitorDangerousCommands) {
      await ctx.reply("Comenzile destructive sunt dezactivate pentru acest mediu.");
      return;
    }

    if (!text.includes("CONFIRM")) {
      await ctx.reply("Pentru reset complet foloseste exact comanda: /reset_state CONFIRM");
      return;
    }

    await ctx.reply("Reset complet in curs. Sterg utilizatorii, sesiunile si queue-urile...");
    await wipeBotState();
    await ctx.reply("Reset complet finalizat.");
  });

  const maybeSendMonitoringReport = async () => {
    if (!isConfigured(config.MONITOR_ALERT_CHAT_ID)) {
      return;
    }

    const targetChatId = config.MONITOR_ALERT_CHAT_ID;
    const status = await getOpsStatus();
    const incidentNow = hasIncident(status);

    if (incidentNow && !incidentOpen) {
      incidentOpen = true;
      await bot.telegram.sendMessage(targetChatId, `ALERTA\n\n${formatOpsStatus(status)}`, {
        parse_mode: "Markdown",
      });
      return;
    }

    if (!incidentNow && incidentOpen) {
      incidentOpen = false;
      await bot.telegram.sendMessage(targetChatId, `RECOVERED\n\n${formatOpsStatus(status)}`, {
        parse_mode: "Markdown",
      });
      return;
    }

    const now = new Date();
    const reportKey = getDailyReportKey(now);
    if (isDailyReportMoment(now) && reportKey !== lastDailyReportKey) {
      lastDailyReportKey = reportKey;
      await bot.telegram.sendMessage(targetChatId, formatOpsStatus(status), {
        parse_mode: "Markdown",
      });
    }
  };

  const interval = setInterval(() => {
    void maybeSendMonitoringReport().catch((error) => {
      logger.error({ err: error }, "Monitor polling esuat.");
    });
  }, Math.max(config.MONITOR_POLL_INTERVAL_SEC, 30) * 1000);

  const shutdown = async () => {
    clearInterval(interval);
    bot.stop();
    await closeResetResources();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await bot.launch(
    {
      dropPendingUpdates: false,
    },
    () => {
      logger.info("Ops monitoring bot pornit.");
    },
  );
}

bootstrapOpsBot().catch(async (error) => {
  logger.error({ err: error }, "Pornirea ops bot a esuat.");
  await closeResetResources();
  process.exit(1);
});
