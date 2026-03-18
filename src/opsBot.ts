import { Context, Telegraf } from "telegraf";
import { TelegramError } from "telegraf";
import { closeResetResources, wipeBotState } from "./services/resetService.js";
import { config, isConfigured } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import {
  formatHealthStatus,
  formatJobsStatus,
  formatOpsStatus,
  formatQueuesStatus,
  getBotLogTail,
  getDailyReportKey,
  getOpsStatus,
  getWorkerLogTail,
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

type AuthState = {
  authenticated: boolean;
  failedAttempts: number;
  locked: boolean;
};

function getUserId(ctx: Context): number | null {
  return typeof ctx.from?.id === "number" ? ctx.from.id : null;
}

function hasTextMessage(ctx: Context): ctx is Context & { message: { text: string } } {
  return "message" in ctx && typeof (ctx.message as { text?: unknown })?.text === "string";
}

async function safeReply(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    if (error instanceof TelegramError && error.response?.error_code === 400) {
      await ctx.reply(text);
      return;
    }

    throw error;
  }
}

async function safePlainReply(ctx: Context, text: string): Promise<void> {
  await ctx.reply(text);
}

async function safeAlertMessage(bot: Telegraf<Context>, chatId: string, text: string): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, text, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    if (error instanceof TelegramError && error.response?.error_code === 400) {
      await bot.telegram.sendMessage(chatId, text);
      return;
    }

    throw error;
  }
}

function trimForTelegram(text: string): string {
  const trimmed = text.trim() || "Nu exista output recent.";
  return trimmed.length > 3900 ? trimmed.slice(trimmed.length - 3900) : trimmed;
}

async function bootstrapOpsBot(): Promise<void> {
  if (!isConfigured(config.MONITOR_BOT_TOKEN)) {
    logger.warn("MONITOR_BOT_TOKEN lipseste. Botul de monitoring nu porneste.");
    return;
  }

  const bot = new Telegraf<Context>(config.MONITOR_BOT_TOKEN);
  const allowedUserIds = parseAllowedUserIds();
  const authStates = new Map<number, AuthState>();
  const monitorPassword = config.MONITOR_ACCESS_PASSWORD.trim();
  const maxLoginAttempts = Math.max(config.MONITOR_MAX_LOGIN_ATTEMPTS, 1);
  let incidentOpen = false;
  let lastDailyReportKey = "";

  bot.use(async (ctx, next) => {
    if (!isAuthorized(ctx, allowedUserIds)) {
      await ctx.reply("Nu ai acces la acest bot de monitoring.");
      return;
    }

    if (!monitorPassword) {
      await next();
      return;
    }

    const userId = getUserId(ctx);
    if (!userId) {
      await ctx.reply("Nu am putut determina utilizatorul Telegram.");
      return;
    }

    const state = authStates.get(userId) ?? {
      authenticated: false,
      failedAttempts: 0,
      locked: false,
    };
    authStates.set(userId, state);

    if (state.locked) {
      await ctx.reply("Acces blocat dupa prea multe incercari gresite.");
      return;
    }

    if (state.authenticated) {
      await next();
      return;
    }

    const text = hasTextMessage(ctx) ? ctx.message.text.trim() : "";

    if (!text || text.startsWith("/")) {
      await ctx.reply(`Introdu parola pentru access la ops-bot. Ai maxim ${maxLoginAttempts} incercari.`);
      return;
    }

    if (text === monitorPassword) {
      state.authenticated = true;
      state.failedAttempts = 0;
      await safeReply(
        ctx,
        [
          "*Autentificare reusita*",
          "",
          "Comenzi disponibile:",
          "/status",
          "/health",
          "/queues",
          "/jobs",
          "/logs_bot",
          "/logs_worker",
          "/restart_express",
          "/daily_now",
          "/reset_state CONFIRM",
        ].join("\n"),
      );
      return;
    }

    state.failedAttempts += 1;
    const attemptsLeft = maxLoginAttempts - state.failedAttempts;
    if (attemptsLeft <= 0) {
      state.locked = true;
      await ctx.reply("Parola gresita. Acces blocat dupa prea multe incercari.");
      return;
    }

    await ctx.reply(`Parola gresita. Mai ai ${attemptsLeft} incercari.`);
    return;
  });

  bot.start(async (ctx) => {
    if (monitorPassword) {
      await ctx.reply(`Ops Bot este protejat cu parola. Introdu parola. Ai maxim ${maxLoginAttempts} incercari.`);
      return;
    }

    await safeReply(
      ctx,
      [
        "*Ops Bot*",
        "",
        "Comenzi disponibile:",
        "/status",
        "/health",
        "/queues",
        "/jobs",
        "/logs_bot",
        "/logs_worker",
        "/restart_express",
        "/daily_now",
        "/reset_state CONFIRM",
      ].join("\n"),
    );
  });

  bot.command("status", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatOpsStatus(status));
  });

  bot.command("health", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatHealthStatus(status));
  });

  bot.command("queues", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatQueuesStatus(status));
  });

  bot.command("jobs", async (ctx) => {
    const status = await getOpsStatus();
    await safePlainReply(ctx, formatJobsStatus(status));
  });

  bot.command("logs_bot", async (ctx) => {
    const logs = await getBotLogTail();
    await safePlainReply(ctx, trimForTelegram(logs));
  });

  bot.command("logs_worker", async (ctx) => {
    const logs = await getWorkerLogTail();
    await safePlainReply(ctx, trimForTelegram(logs));
  });

  bot.command("restart_express", async (ctx) => {
    await ctx.reply("Restart bot + worker in curs...");
    await restartExpressRuntime();
    await ctx.reply("Restart trimis catre containerele Express.");
  });

  bot.command("daily_now", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatOpsStatus(status));
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
      await safeAlertMessage(bot, targetChatId, `ALERTA\n\n${formatOpsStatus(status)}`);
      return;
    }

    if (!incidentNow && incidentOpen) {
      incidentOpen = false;
      await safeAlertMessage(bot, targetChatId, `RECOVERED\n\n${formatOpsStatus(status)}`);
      return;
    }

    const now = new Date();
    const reportKey = getDailyReportKey(now);
    if (isDailyReportMoment(now) && reportKey !== lastDailyReportKey) {
      lastDailyReportKey = reportKey;
      await safeAlertMessage(bot, targetChatId, formatOpsStatus(status));
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
