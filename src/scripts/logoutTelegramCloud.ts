import { Telegram } from "telegraf";
import { config, isConfigured } from "../utils/config.js";

function isAlreadyLoggedOut(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("400: Logged out") || error.message.includes("Logged out");
}

async function main(): Promise<void> {
  if (!isConfigured(config.TELEGRAM_BOT_TOKEN)) {
    throw new Error("TELEGRAM_BOT_TOKEN nu este configurat.");
  }

  const telegram = new Telegram(config.TELEGRAM_BOT_TOKEN, {
    apiRoot: "https://api.telegram.org",
  });

  try {
    await telegram.deleteWebhook({
      drop_pending_updates: false,
    });
  } catch (error) {
    if (!isAlreadyLoggedOut(error)) {
      throw error;
    }
  }

  try {
    await telegram.logOut();
  } catch (error) {
    if (!isAlreadyLoggedOut(error)) {
      throw error;
    }
  }

  console.log("Botul a fost delogat din cloud Bot API. Acum poate fi pornit pe Local Bot API Server.");
}

main().catch((error) => {
  console.error("Nu am putut face logOut din cloud Bot API.", error);
  process.exit(1);
});
