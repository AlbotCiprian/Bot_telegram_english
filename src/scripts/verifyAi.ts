import { resolveAiApiConfig } from "../services/aiProvider.js";

async function main(): Promise<void> {
  const aiConfig = resolveAiApiConfig();

  if (!aiConfig) {
    throw new Error(
      "Nu este configurat niciun provider AI. Pune AI_PROVIDER=groq si GROQ_API_KEY=... sau foloseste DeepSeek/OpenRouter.",
    );
  }

  const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiConfig.apiKey}`,
      ...aiConfig.headers,
    },
    body: JSON.stringify({
      model: aiConfig.model,
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
    throw new Error(`${aiConfig.provider} verification failed (${response.status}): ${raw}`);
  }

  const payload = JSON.parse(raw) as {
    id?: string;
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Record<string, unknown>;
  };

  console.log("AI provider OK");
  console.log(`provider=${aiConfig.provider}`);
  console.log(`model=${payload.model ?? aiConfig.model}`);
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
