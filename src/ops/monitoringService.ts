import { listContainers, restartContainer } from "./dockerApi.js";
import { config } from "../utils/config.js";

type HealthPayload = {
  status: string;
  service: string;
  time: string;
};

type StatsPayload = {
  users: number;
  formsCompleted: number;
  lessonsSent: number;
  aiQuestions: number;
  crmSuccess: number;
  crmFailed: number;
  urgentRequests: number;
  consultRequests: number;
  mediaCache: number;
};

const REQUIRED_CONTAINERS = [
  config.MONITOR_EXPRESS_BOT_CONTAINER,
  config.MONITOR_EXPRESS_WORKER_CONTAINER,
  config.MONITOR_EXPRESS_DB_CONTAINER,
  config.MONITOR_EXPRESS_REDIS_CONTAINER,
];

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${config.MONITOR_TARGET_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} a raspuns cu ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeContainerName(name: string): string {
  return name.startsWith("/") ? name.slice(1) : name;
}

export async function getOpsStatus() {
  const [health, stats, containers] = await Promise.all([
    fetchJson<HealthPayload>("/health"),
    fetchJson<StatsPayload>("/admin/stats"),
    listContainers(),
  ]);

  const relevantContainers = containers
    .map((container) => ({
      name: normalizeContainerName(container.Names[0] ?? container.Id),
      state: container.State,
      status: container.Status,
    }))
    .filter((container) => REQUIRED_CONTAINERS.includes(container.name));

  return {
    health,
    stats,
    containers: relevantContainers,
  };
}

export function formatOpsStatus(status: Awaited<ReturnType<typeof getOpsStatus>>): string {
  const containerLines = status.containers
    .map((container) => `- ${container.name}: ${container.state} (${container.status})`)
    .join("\n");

  return [
    "*Express English Academy - status*",
    "",
    `Health: ${status.health.status}`,
    `Time: ${status.health.time}`,
    "",
    "*Containere*",
    containerLines || "- niciun container gasit",
    "",
    "*Metrici*",
    `- users: ${status.stats.users}`,
    `- formsCompleted: ${status.stats.formsCompleted}`,
    `- lessonsSent: ${status.stats.lessonsSent}`,
    `- crmSuccess: ${status.stats.crmSuccess}`,
    `- crmFailed: ${status.stats.crmFailed}`,
    `- urgentRequests: ${status.stats.urgentRequests}`,
    `- consultRequests: ${status.stats.consultRequests}`,
    `- mediaCache: ${status.stats.mediaCache}`,
  ].join("\n");
}

export function hasIncident(status: Awaited<ReturnType<typeof getOpsStatus>>): boolean {
  if (status.health.status !== "ok") {
    return true;
  }

  const runningNames = new Set(status.containers.filter((container) => container.state === "running").map((container) => container.name));
  return REQUIRED_CONTAINERS.some((name) => !runningNames.has(name));
}

export async function restartExpressRuntime(): Promise<void> {
  await restartContainer(config.MONITOR_EXPRESS_WORKER_CONTAINER);
  await restartContainer(config.MONITOR_EXPRESS_BOT_CONTAINER);
}

export function isDailyReportMoment(now: Date): boolean {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.MONITOR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
  });

  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return Number(parts.hour) === config.MONITOR_DAILY_REPORT_HOUR;
}

export function getDailyReportKey(now: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.MONITOR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(now);
}
