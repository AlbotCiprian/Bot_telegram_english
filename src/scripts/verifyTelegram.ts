import { config, isConfigured } from "../utils/config.js";

async function callTelegram(method: string): Promise<unknown> {
  const response = await fetch(`${config.telegramApiRoot}/bot${config.TELEGRAM_BOT_TOKEN}/${method}`);
  const payload = (await response.json()) as {
    ok: boolean;
    result?: unknown;
    description?: string;
  };

  if (!payload.ok) {
    throw new Error(`Telegram ${method} failed: ${payload.description ?? "unknown error"}`);
  }

  return payload.result;
}

async function main(): Promise<void> {
  if (!isConfigured(config.TELEGRAM_BOT_TOKEN)) {
    throw new Error("TELEGRAM_BOT_TOKEN lipseste din .env.local");
  }

  const me = (await callTelegram("getMe")) as {
    id: number;
    username: string;
    first_name: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
  };

  const webhookInfo = (await callTelegram("getWebhookInfo")) as {
    url?: string;
    pending_update_count?: number;
  };

  console.log("Telegram OK");
  console.log(`api_root=${config.telegramApiRoot}`);
  console.log(`bot_id=${me.id}`);
  console.log(`username=@${me.username}`);
  console.log(`name=${me.first_name}`);
  console.log(`can_join_groups=${Boolean(me.can_join_groups)}`);
  console.log(`can_read_all_group_messages=${Boolean(me.can_read_all_group_messages)}`);
  console.log(`webhook_url=${webhookInfo.url ?? ""}`);
  console.log(`pending_updates=${webhookInfo.pending_update_count ?? 0}`);

  if (webhookInfo.url) {
    console.log("");
    console.log("Atentie: proiectul local foloseste polling mode.");
    console.log(`Sterge webhook-ul curent cu: ${config.telegramApiRoot}/bot${config.TELEGRAM_BOT_TOKEN}/deleteWebhook`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
