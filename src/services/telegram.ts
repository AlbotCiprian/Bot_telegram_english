import { Telegram } from "telegraf";
import { config, isConfigured } from "../utils/config.js";

let telegramClient: Telegram | null = null;

export function getTelegramClient(): Telegram {
  if (!isConfigured(config.TELEGRAM_BOT_TOKEN)) {
    throw new Error("TELEGRAM_BOT_TOKEN nu este configurat.");
  }

  telegramClient ??= new Telegram(config.TELEGRAM_BOT_TOKEN);
  return telegramClient;
}
