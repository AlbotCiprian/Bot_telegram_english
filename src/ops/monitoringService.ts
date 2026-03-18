import { prisma } from "../db/client.js";
import { campaignQueue, crmQueue } from "../services/queue.js";
import { config } from "../utils/config.js";
import { getContainerLogs, listContainers, restartContainer } from "./dockerApi.js";

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
  marathonRequests: number;
  mediaCache: number;
};

type JobsPayload = {
  jobs: Array<{
    jobId: string;
    queueName: string;
    jobType: string;
    status: string;
    runAt: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
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

function getQueueBacklog(status: Awaited<ReturnType<typeof getOpsStatus>>): number {
  return (
    status.queues.campaigns.waiting +
    status.queues.campaigns.active +
    status.queues.campaigns.delayed +
    status.queues.crm.waiting +
    status.queues.crm.active +
    status.queues.crm.delayed
  );
}

function getIncidentReasons(status: Awaited<ReturnType<typeof getOpsStatus>>): string[] {
  const reasons: string[] = [];

  if (status.health.status !== "ok") {
    reasons.push(`health=${status.health.status}`);
  }

  const runningNames = new Set(status.containers.filter((container) => container.state === "running").map((container) => container.name));
  for (const name of REQUIRED_CONTAINERS) {
    if (!runningNames.has(name)) {
      reasons.push(`container_down=${name}`);
    }
  }

  if (status.recentCrmFailures >= config.MONITOR_CRM_FAILURE_THRESHOLD) {
    reasons.push(`crm_failures=${status.recentCrmFailures}/${config.MONITOR_CRM_FAILURE_WINDOW_MIN}m`);
  }

  const backlog = getQueueBacklog(status);
  if (backlog >= config.MONITOR_QUEUE_BACKLOG_THRESHOLD) {
    reasons.push(`queue_backlog=${backlog}`);
  }

  return reasons;
}

export async function getOpsStatus() {
  const [health, stats, jobsPayload, containers, campaignCounts, crmCounts, recentCrmFailures] = await Promise.all([
    fetchJson<HealthPayload>("/health"),
    fetchJson<StatsPayload>("/admin/stats"),
    fetchJson<JobsPayload>("/admin/jobs"),
    listContainers(),
    campaignQueue.getJobCounts("waiting", "active", "delayed", "failed"),
    crmQueue.getJobCounts("waiting", "active", "delayed", "failed"),
    prisma.crmSyncLog.count({
      where: {
        status: "failed",
        createdAt: {
          gte: new Date(Date.now() - config.MONITOR_CRM_FAILURE_WINDOW_MIN * 60_000),
        },
      },
    }),
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
    queues: {
      campaigns: campaignCounts,
      crm: crmCounts,
    },
    recentJobs: jobsPayload.jobs,
    recentCrmFailures,
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
    `- marathonRequests: ${status.stats.marathonRequests}`,
    `- mediaCache: ${status.stats.mediaCache}`,
    `- recentCrmFailures(${config.MONITOR_CRM_FAILURE_WINDOW_MIN}m): ${status.recentCrmFailures}`,
    "",
    "*Queue backlog*",
    `- campaigns: waiting=${status.queues.campaigns.waiting}, active=${status.queues.campaigns.active}, delayed=${status.queues.campaigns.delayed}, failed=${status.queues.campaigns.failed}`,
    `- crm: waiting=${status.queues.crm.waiting}, active=${status.queues.crm.active}, delayed=${status.queues.crm.delayed}, failed=${status.queues.crm.failed}`,
  ].join("\n");
}

export function formatHealthStatus(status: Awaited<ReturnType<typeof getOpsStatus>>): string {
  const reasons = getIncidentReasons(status);
  return [
    "*Express English Academy - health*",
    "",
    `Health: ${status.health.status}`,
    reasons.length ? `Probleme: ${reasons.join(", ")}` : "Probleme: niciuna",
    `Time: ${status.health.time}`,
  ].join("\n");
}

export function formatQueuesStatus(status: Awaited<ReturnType<typeof getOpsStatus>>): string {
  const backlog = getQueueBacklog(status);
  return [
    "*Express English Academy - queues*",
    "",
    `Campaigns: waiting=${status.queues.campaigns.waiting}, active=${status.queues.campaigns.active}, delayed=${status.queues.campaigns.delayed}, failed=${status.queues.campaigns.failed}`,
    `CRM: waiting=${status.queues.crm.waiting}, active=${status.queues.crm.active}, delayed=${status.queues.crm.delayed}, failed=${status.queues.crm.failed}`,
    `Backlog total: ${backlog}`,
    `Prag alerta: ${config.MONITOR_QUEUE_BACKLOG_THRESHOLD}`,
  ].join("\n");
}

export function formatJobsStatus(status: Awaited<ReturnType<typeof getOpsStatus>>): string {
  const lines = status.recentJobs.slice(0, 10).map((job) =>
    `- [${job.status}] ${job.queueName}/${job.jobType} :: ${job.jobId}${job.errorMessage ? ` :: ${job.errorMessage}` : ""}`,
  );
  return [
    "Express English Academy - jobs",
    "",
    ...(lines.length ? lines : ["- Nicio intrare recenta."]),
  ].join("\n");
}

export async function getBotLogTail(): Promise<string> {
  return getContainerLogs(config.MONITOR_EXPRESS_BOT_CONTAINER, config.MONITOR_LOG_TAIL_LINES);
}

export async function getWorkerLogTail(): Promise<string> {
  return getContainerLogs(config.MONITOR_EXPRESS_WORKER_CONTAINER, config.MONITOR_LOG_TAIL_LINES);
}

export function hasIncident(status: Awaited<ReturnType<typeof getOpsStatus>>): boolean {
  return getIncidentReasons(status).length > 0;
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
