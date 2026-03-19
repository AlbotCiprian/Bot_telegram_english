import { Context, Markup, Telegraf } from "telegraf";
import { TelegramError } from "telegraf";
import { UI_LABELS } from "./content/copy.js";
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

function buildAccessDeniedMessage(ctx: Context): string {
  const userId = getUserId(ctx);
  if (!userId) {
    return "Nu ai acces la acest bot de monitorizare.";
  }

  return [
    "Nu ai acces la acest bot de monitorizare.",
    `ID-ul tău Telegram este \`${userId}\`.`,
    "Administratorul trebuie să te adauge în `MONITOR_ALLOWED_USER_IDS`.",
  ].join("\n");
}

function getOpsMenuKeyboard() {
  return Markup.keyboard([
    [UI_LABELS.opsHelp, "/status"],
    ["/health", "/queues"],
    ["/jobs", "/logs_bot"],
    ["/logs_worker", "/daily_now"],
    ["/restart_express"],
  ]).resize();
}

function buildOpsAuthMessage(): string {
  return [
    "*Autentificare reușită*",
    "",
    "Folosește butoanele de mai jos.",
    "Pentru lista scurtă de comenzi: `/help`",
  ].join("\n");
}

function buildOpsHelpMessage(): string {
  return [
    "*Ops Bot*",
    "",
    "`/status` status complet",
    "`/health` verdict rapid",
    "`/queues` backlog joburi",
    "`/jobs` ultimele joburi",
    "`/logs_bot` log bot",
    "`/logs_worker` log worker",
    "`/restart_express` restart bot + worker",
    "`/daily_now` raport acum",
  ].join("\n");
}

async function safeReply(
  ctx: Context,
  text: string,
  options?: { withMenu?: boolean },
): Promise<void> {
  try {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: options?.withMenu ? getOpsMenuKeyboard().reply_markup : undefined,
    });
  } catch (error) {
    if (error instanceof TelegramError && error.response?.error_code === 400) {
      await ctx.reply(text, {
        reply_markup: options?.withMenu ? getOpsMenuKeyboard().reply_markup : undefined,
      });
      return;
    }

    throw error;
  }
}

async function safePlainReply(
  ctx: Context,
  text: string,
  options?: { withMenu?: boolean },
): Promise<void> {
  await ctx.reply(text, {
    reply_markup: options?.withMenu ? getOpsMenuKeyboard().reply_markup : undefined,
  });
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
  const trimmed = text.trim() || "Nu există output recent.";
  return trimmed.length > 3900 ? trimmed.slice(trimmed.length - 3900) : trimmed;
}

async function bootstrapOpsBot(): Promise<void> {
  if (!isConfigured(config.MONITOR_BOT_TOKEN)) {
    logger.warn("MONITOR_BOT_TOKEN lipsește. Botul de monitoring nu pornește.");
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
      logger.warn(
        {
          telegramUserId: getUserId(ctx),
          telegramUsername: ctx.from?.username ?? null,
          telegramChatId: ctx.chat?.id ?? null,
          configuredAllowedUsers: allowedUserIds.size,
        },
        "Acces refuzat la ops bot pentru utilizator neautorizat.",
      );
      await safeReply(ctx, buildAccessDeniedMessage(ctx));
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
      await ctx.reply("Acces blocat după prea multe încercări greșite.");
      return;
    }

    if (state.authenticated) {
      await next();
      return;
    }

    const text = hasTextMessage(ctx) ? ctx.message.text.trim() : "";

    if (!text || text.startsWith("/")) {
      await ctx.reply(`Introdu parola pentru acces la ops-bot. Ai maximum ${maxLoginAttempts} încercări.`);
      return;
    }

    if (text === monitorPassword) {
      state.authenticated = true;
      state.failedAttempts = 0;
      await safeReply(ctx, buildOpsAuthMessage(), { withMenu: true });
      return;
    }

    state.failedAttempts += 1;
    const attemptsLeft = maxLoginAttempts - state.failedAttempts;
    if (attemptsLeft <= 0) {
      state.locked = true;
      await ctx.reply("Parolă greșită. Acces blocat după prea multe încercări.");
      return;
    }

    await ctx.reply(`Parolă greșită. Mai ai ${attemptsLeft} încercări.`);
    return;
  });

  bot.start(async (ctx) => {
    if (monitorPassword) {
      await ctx.reply(`Ops Bot este protejat cu parolă. Introdu parola. Ai maximum ${maxLoginAttempts} încercări.`);
      return;
    }

    await safeReply(ctx, buildOpsAuthMessage(), { withMenu: true });
  });

  bot.command("help", async (ctx) => {
    await safeReply(ctx, buildOpsHelpMessage(), { withMenu: true });
  });

  bot.hears(UI_LABELS.opsHelp, async (ctx) => {
    await safeReply(ctx, buildOpsHelpMessage(), { withMenu: true });
  });

  bot.command("status", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatOpsStatus(status), { withMenu: true });
  });

  bot.command("health", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatHealthStatus(status), { withMenu: true });
  });

  bot.command("queues", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatQueuesStatus(status), { withMenu: true });
  });

  bot.command("jobs", async (ctx) => {
    const status = await getOpsStatus();
    await safePlainReply(ctx, formatJobsStatus(status), { withMenu: true });
  });

  bot.command("logs_bot", async (ctx) => {
    const logs = await getBotLogTail();
    await safePlainReply(ctx, trimForTelegram(logs), { withMenu: true });
  });

  bot.command("logs_worker", async (ctx) => {
    const logs = await getWorkerLogTail();
    await safePlainReply(ctx, trimForTelegram(logs), { withMenu: true });
  });

  bot.command("restart_express", async (ctx) => {
    await safePlainReply(ctx, "Restart bot + worker în curs...", { withMenu: true });
    await restartExpressRuntime();
    await safePlainReply(ctx, "Restart trimis către containerele Express.", { withMenu: true });
  });

  bot.command("daily_now", async (ctx) => {
    const status = await getOpsStatus();
    await safeReply(ctx, formatOpsStatus(status), { withMenu: true });
  });

  bot.command("reset_state", async (ctx) => {
    const text = "message" in ctx && typeof (ctx.message as { text?: string }).text === "string"
      ? (ctx.message as { text: string }).text
      : "";

    if (!config.monitorDangerousCommands) {
      await safePlainReply(ctx, "Comenzile destructive sunt dezactivate pentru acest mediu.", { withMenu: true });
      return;
    }

    if (!text.includes("CONFIRM")) {
      await safePlainReply(ctx, "Pentru reset complet folosește exact comanda: /reset_state CONFIRM", { withMenu: true });
      return;
    }

    await safePlainReply(ctx, "Reset complet în curs. Șterg utilizatorii, sesiunile și queue-urile...", { withMenu: true });
    await wipeBotState();
    await safePlainReply(ctx, "Reset complet finalizat.", { withMenu: true });
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
      logger.error({ err: error }, "Monitor polling eșuat.");
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
  logger.error({ err: error }, "Pornirea ops bot a eșuat.");
  await closeResetResources();
  process.exit(1);
});
