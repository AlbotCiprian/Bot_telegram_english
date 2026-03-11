import { config, isConfigured } from "../utils/config.js";

async function main(): Promise<void> {
  if (!isConfigured(config.DEEPSEEK_API_KEY)) {
    throw new Error("DEEPSEEK_API_KEY lipseste din .env.local");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      temperature: 0,
      stream: false,
      messages: [
        {
          role: "system",
          content: "Reply in exactly one word: OK",
        },
        {
          role: "user",
          content: "Test connection",
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`DeepSeek verification failed (${response.status}): ${raw}`);
  }

  const payload = JSON.parse(raw) as {
    id?: string;
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Record<string, unknown>;
  };

  console.log("DeepSeek OK");
  console.log(`model=${payload.model ?? "unknown"}`);
  console.log(`reply=${payload.choices?.[0]?.message?.content?.trim() ?? ""}`);
  console.log(`request_id=${payload.id ?? "unknown"}`);
  if (payload.usage) {
    console.log(`usage=${JSON.stringify(payload.usage)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
