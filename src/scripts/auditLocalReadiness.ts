import { config, isConfigured } from "../utils/config.js";
import { STATIC_PAGES, isMarathonVisible } from "../content/staticContent.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";

type AuditCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(`http://localhost:${config.APP_PORT}${path}`);
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}`);
  }

  return response.json();
}

function toCheck(label: string, ok: boolean, detail: string): AuditCheck {
  return { label, ok, detail };
}

async function main(): Promise<void> {
  const checks: AuditCheck[] = [];

  checks.push(
    toCheck("TELEGRAM_BOT_TOKEN", isConfigured(config.TELEGRAM_BOT_TOKEN), "bot token configurat"),
    toCheck("GROQ_API_KEY", isConfigured(config.GROQ_API_KEY), "AI provider configurat"),
    toCheck("KOMMO_TOKEN", isConfigured(config.KOMMO_TOKEN), "Kommo token configurat"),
    toCheck(
      "Local Bot API",
      config.telegramUseLocalApi && config.telegramApiRoot === "http://telegram-bot-api:8081",
      `apiRoot=${config.telegramApiRoot}`,
    ),
    toCheck(
      "ops-bot auth",
      isConfigured(config.MONITOR_BOT_TOKEN)
        && isConfigured(config.MONITOR_ALLOWED_USER_IDS)
        && isConfigured(config.MONITOR_ALERT_CHAT_ID)
        && isConfigured(config.MONITOR_ACCESS_PASSWORD),
      "MONITOR_BOT_TOKEN / ALLOWED / ALERT / PASSWORD",
    ),
  );

  const mediaChecks = [
    { label: "Welcome image", fileName: config.WELCOME_IMAGE_PATH },
    { label: "Lesson 1", fileName: "lesson-1-v2-landscape.mp4" },
    { label: "Lesson 2", fileName: "lesson-2-v2-landscape.mp4" },
    { label: "Lesson 3", fileName: "lesson-3-v2-landscape.mp4" },
    { label: "Method", fileName: "Metoda_noastra_optimized.mp4" },
  ];

  for (const item of mediaChecks) {
    const resolved = resolveExistingMediaFile(item.fileName);
    checks.push(
      toCheck(item.label, Boolean(resolved), resolved ?? `Lipseste assetul: ${item.fileName}`),
    );
  }

  const marathonSummary = [
    `visible=${isMarathonVisible()}`,
    `start=${config.MARATHON_START_DATE || "unset"}`,
    `end=${config.MARATHON_END_DATE || "unset"}`,
    `title=${STATIC_PAGES.marathon.title}`,
  ].join(", ");
  checks.push(toCheck("Marathon config", true, marathonSummary));

  try {
    const health = await fetchJson("/health");
    checks.push(toCheck("HTTP /health", true, JSON.stringify(health)));
  } catch (error) {
    checks.push(toCheck("HTTP /health", false, error instanceof Error ? error.message : "unknown"));
  }

  try {
    const stats = await fetchJson("/admin/stats");
    checks.push(toCheck("HTTP /admin/stats", true, JSON.stringify(stats)));
  } catch (error) {
    checks.push(toCheck("HTTP /admin/stats", false, error instanceof Error ? error.message : "unknown"));
  }

  try {
    const jobs = await fetchJson("/admin/jobs");
    checks.push(toCheck("HTTP /admin/jobs", true, JSON.stringify(jobs)));
  } catch (error) {
    checks.push(toCheck("HTTP /admin/jobs", false, error instanceof Error ? error.message : "unknown"));
  }

  let hasFailures = false;
  console.log("Local readiness audit");
  console.log("");
  for (const check of checks) {
    console.log(`${check.ok ? "OK " : "FAIL"} ${check.label}: ${check.detail}`);
    if (!check.ok) {
      hasFailures = true;
    }
  }

  if (hasFailures) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
