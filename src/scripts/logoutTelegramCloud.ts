import { Telegram } from "telegraf";
import { config, isConfigured } from "../utils/config.js";

async function main(): Promise<void> {
  if (!isConfigured(config.TELEGRAM_BOT_TOKEN)) {
    throw new Error("TELEGRAM_BOT_TOKEN nu este configurat.");
  }

  const telegram = new Telegram(config.TELEGRAM_BOT_TOKEN, {
    apiRoot: "https://api.telegram.org",
  });

  await telegram.deleteWebhook({
    drop_pending_updates: false,
  });

  await telegram.logOut();

  console.log("Botul a fost delogat din cloud Bot API. Acum poate fi pornit pe Local Bot API Server.");
}

main().catch((error) => {
  console.error("Nu am putut face logOut din cloud Bot API.", error);
  process.exit(1);
});
