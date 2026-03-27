import { prisma } from "../db/client.js";
import {
  LESSON_NUDGE_AFTER_HOURS,
  LESSON_NUDGE_DELAYS,
  ensureLessonUnlockedFlag,
  sendLessonNudge,
  unlockLesson,
  type LessonNudgeAfterHours,
} from "./lessonService.js";
import { campaignQueue } from "./queue.js";
import { buildCampaignJobId, ensureCampaignJobScheduled, type CampaignJobPayload } from "./schedulerService.js";

type LessonRecoveryDay = 2 | 3;
export type LessonRecoveryBackfill = "unlock" | "nudge";
export type LessonRecoveryMode = "dry-run" | "apply";

export type LessonRecoveryCandidate = {
  userId: number;
  dayNumber: LessonRecoveryDay;
  unlockAt: Date | null;
  unlocked: boolean;
  opened: boolean;
  unlockEventAt: Date | null;
  unlockJobHealthy: boolean;
  nudgeEventAt: Partial<Record<LessonNudgeAfterHours, Date>>;
  nudgeJobHealthy: Partial<Record<LessonNudgeAfterHours, boolean>>;
};

export type LessonRecoveryAction =
  | { kind: "ensure_unlock_job"; userId: number; dayNumber: LessonRecoveryDay; delayMs: number }
  | { kind: "send_unlock"; userId: number; dayNumber: LessonRecoveryDay }
  | { kind: "ensure_nudge_job"; userId: number; dayNumber: LessonRecoveryDay; afterHours: LessonNudgeAfterHours; delayMs: number }
  | { kind: "send_nudge"; userId: number; dayNumber: LessonRecoveryDay; afterHours: LessonNudgeAfterHours };

type ReconcileOptions = {
  mode: LessonRecoveryMode;
  backfill: Set<LessonRecoveryBackfill>;
};

type ReconcileActionResult = LessonRecoveryAction & {
  status: "planned" | "existing" | "recreated" | "scheduled" | "sent" | "skipped";
};

type ReconcileSummary = {
  usersScanned: number;
  candidatesScanned: number;
  actionsPlanned: number;
  actionsApplied: number;
  countsByKind: Record<LessonRecoveryAction["kind"], number>;
};

export type LessonRecoveryReport = {
  mode: LessonRecoveryMode;
  backfill: LessonRecoveryBackfill[];
  summary: ReconcileSummary;
  actions: ReconcileActionResult[];
};

const PENDING_BULL_JOB_STATES = new Set(["waiting", "delayed", "prioritized", "active"]);

function buildLessonDayKey(userId: number, dayNumber: LessonRecoveryDay): string {
  return `${userId}:${dayNumber}`;
}

function buildLessonNudgeKey(userId: number, dayNumber: LessonRecoveryDay, afterHours: LessonNudgeAfterHours): string {
  return `${userId}:${dayNumber}:${afterHours}`;
}

function readMetadataNumber(metadata: unknown, key: string): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function isLessonOpened(user: {
  currentLessonDay: number;
  lessonProgress: Array<{ dayNumber: number; openedAt: Date | null }>;
}, dayNumber: LessonRecoveryDay): boolean {
  return user.currentLessonDay >= dayNumber || user.lessonProgress.some((progress) => progress.dayNumber === dayNumber && Boolean(progress.openedAt));
}

async function hasHealthyPendingCampaignJob(
  payload: CampaignJobPayload,
  trackedStatus: string | null,
): Promise<boolean> {
  const bullJob = await campaignQueue.getJob(buildCampaignJobId(payload));
  if (!bullJob) {
    return false;
  }

  const bullState = await bullJob.getState();
  return PENDING_BULL_JOB_STATES.has(bullState) && (trackedStatus === "scheduled" || trackedStatus === "processing");
}

function buildLessonRecoveryActionCounts(): Record<LessonRecoveryAction["kind"], number> {
  return {
    ensure_unlock_job: 0,
    send_unlock: 0,
    ensure_nudge_job: 0,
    send_nudge: 0,
  };
}

export function parseLessonRecoveryBackfill(rawValue?: string): Set<LessonRecoveryBackfill> {
  const normalized = (rawValue ?? "unlock,nudge")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const values = normalized.length > 0 ? normalized : ["unlock", "nudge"];
  const backfill = new Set<LessonRecoveryBackfill>();

  for (const value of values) {
    if (value !== "unlock" && value !== "nudge") {
      throw new Error(`Backfill invalid: ${value}. Foloseste unlock, nudge sau unlock,nudge.`);
    }

    backfill.add(value);
  }

  return backfill;
}

export function buildLessonRecoveryActions(
  candidate: LessonRecoveryCandidate,
  now: Date,
  backfill: Set<LessonRecoveryBackfill>,
): LessonRecoveryAction[] {
  const actions: LessonRecoveryAction[] = [];
  const canBackfillUnlock = backfill.has("unlock");
  const canBackfillNudge = backfill.has("nudge");
  const unlockIsDue = candidate.unlocked || Boolean(candidate.unlockAt && candidate.unlockAt <= now);

  if (!unlockIsDue) {
    if (canBackfillUnlock && candidate.unlockAt && !candidate.unlockJobHealthy) {
      actions.push({
        kind: "ensure_unlock_job",
        userId: candidate.userId,
        dayNumber: candidate.dayNumber,
        delayMs: Math.max(candidate.unlockAt.getTime() - now.getTime(), 0),
      });
    }

    return actions;
  }

  if (candidate.opened) {
    return actions;
  }

  if (canBackfillUnlock && !candidate.unlockEventAt) {
    actions.push({
      kind: "send_unlock",
      userId: candidate.userId,
      dayNumber: candidate.dayNumber,
    });

    return actions;
  }

  if (!canBackfillNudge || !candidate.unlockEventAt) {
    return actions;
  }

  for (const afterHours of LESSON_NUDGE_AFTER_HOURS) {
    if (candidate.nudgeEventAt[afterHours]) {
      continue;
    }

    const targetAt = new Date(candidate.unlockEventAt.getTime() + LESSON_NUDGE_DELAYS[afterHours]);
    if (targetAt <= now) {
      if (!candidate.nudgeJobHealthy[afterHours]) {
        actions.push({
          kind: "send_nudge",
          userId: candidate.userId,
          dayNumber: candidate.dayNumber,
          afterHours,
        });
      }
      continue;
    }

    if (!candidate.nudgeJobHealthy[afterHours]) {
      actions.push({
        kind: "ensure_nudge_job",
        userId: candidate.userId,
        dayNumber: candidate.dayNumber,
        afterHours,
        delayMs: Math.max(targetAt.getTime() - now.getTime(), 0),
      });
    }
  }

  return actions;
}

async function loadLessonRecoveryCandidates(): Promise<LessonRecoveryCandidate[]> {
  const campaignLinks = await prisma.userCampaign.findMany({
    where: {
      campaign: { key: "free-lessons" },
      status: { in: ["active", "completed"] },
    },
    include: {
      user: {
        select: {
          id: true,
          currentLessonDay: true,
          lesson2Unlocked: true,
          lesson3Unlocked: true,
          lesson2UnlockTime: true,
          lesson3UnlockTime: true,
          lessonProgress: {
            where: {
              dayNumber: { in: [2, 3] },
            },
            select: {
              dayNumber: true,
              openedAt: true,
            },
          },
        },
      },
    },
  });

  const userIds = campaignLinks.map((link) => link.user.id);
  if (userIds.length === 0) {
    return [];
  }

  const [events, trackedJobs] = await Promise.all([
    prisma.userEvent.findMany({
      where: {
        userId: { in: userIds },
        eventType: { in: ["lesson_unlocked", "lesson_nudge_sent"] },
      },
      select: {
        userId: true,
        eventType: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.scheduledJob.findMany({
      where: {
        userId: { in: userIds },
        queueName: "campaigns",
      },
      select: {
        jobId: true,
        status: true,
      },
    }),
  ]);

  const unlockEvents = new Map<string, Date>();
  const nudgeEvents = new Map<string, Date>();
  for (const event of events) {
    if (!event.userId) {
      continue;
    }

    const dayNumber = readMetadataNumber(event.metadata, "dayNumber");
    if (dayNumber !== 2 && dayNumber !== 3) {
      continue;
    }

    if (event.eventType === "lesson_unlocked") {
      const eventKey = buildLessonDayKey(event.userId, dayNumber);
      const currentValue = unlockEvents.get(eventKey);
      if (!currentValue || currentValue < event.createdAt) {
        unlockEvents.set(eventKey, event.createdAt);
      }
      continue;
    }

    const afterHours = readMetadataNumber(event.metadata, "afterHours");
    if (afterHours !== 12 && afterHours !== 24) {
      continue;
    }

    const eventKey = buildLessonNudgeKey(event.userId, dayNumber, afterHours);
    const currentValue = nudgeEvents.get(eventKey);
    if (!currentValue || currentValue < event.createdAt) {
      nudgeEvents.set(eventKey, event.createdAt);
    }
  }

  const trackedJobStatus = new Map<string, string>();
  for (const job of trackedJobs) {
    trackedJobStatus.set(job.jobId, job.status);
  }

  const candidates: LessonRecoveryCandidate[] = [];
  for (const link of campaignLinks) {
    for (const dayNumber of [2, 3] as const) {
      const unlockAt = dayNumber === 2 ? link.user.lesson2UnlockTime : link.user.lesson3UnlockTime;
      const unlocked = dayNumber === 2 ? link.user.lesson2Unlocked : link.user.lesson3Unlocked;

      if (!unlockAt && !unlocked) {
        continue;
      }

      const unlockPayload: CampaignJobPayload = {
        userId: link.user.id,
        type: "lesson_unlock",
        dayNumber,
      };
      const unlockJobHealthy = unlockAt
        ? await hasHealthyPendingCampaignJob(unlockPayload, trackedJobStatus.get(buildCampaignJobId(unlockPayload)) ?? null)
        : false;

      const nudgeJobHealthy: Partial<Record<LessonNudgeAfterHours, boolean>> = {};
      const nudgeEventAt: Partial<Record<LessonNudgeAfterHours, Date>> = {};
      for (const afterHours of LESSON_NUDGE_AFTER_HOURS) {
        const nudgePayload: CampaignJobPayload = {
          userId: link.user.id,
          type: "lesson_nudge",
          dayNumber,
          afterHours,
        };
        nudgeJobHealthy[afterHours] = await hasHealthyPendingCampaignJob(
          nudgePayload,
          trackedJobStatus.get(buildCampaignJobId(nudgePayload)) ?? null,
        );

        const existingEventAt = nudgeEvents.get(buildLessonNudgeKey(link.user.id, dayNumber, afterHours));
        if (existingEventAt) {
          nudgeEventAt[afterHours] = existingEventAt;
        }
      }

      candidates.push({
        userId: link.user.id,
        dayNumber,
        unlockAt,
        unlocked,
        opened: isLessonOpened(link.user, dayNumber),
        unlockEventAt: unlockEvents.get(buildLessonDayKey(link.user.id, dayNumber)) ?? null,
        unlockJobHealthy,
        nudgeEventAt,
        nudgeJobHealthy,
      });
    }
  }

  return candidates;
}

async function applyLessonRecoveryAction(action: LessonRecoveryAction): Promise<ReconcileActionResult> {
  if (action.kind === "ensure_unlock_job") {
    const status = await ensureCampaignJobScheduled(
      { userId: action.userId, type: "lesson_unlock", dayNumber: action.dayNumber },
      action.delayMs,
    );
    return { ...action, status };
  }

  if (action.kind === "send_unlock") {
    await unlockLesson(action.userId, action.dayNumber);
    return { ...action, status: "sent" };
  }

  await ensureLessonUnlockedFlag(action.userId, action.dayNumber);

  if (action.kind === "ensure_nudge_job") {
    const status = await ensureCampaignJobScheduled(
      {
        userId: action.userId,
        type: "lesson_nudge",
        dayNumber: action.dayNumber,
        afterHours: action.afterHours,
      },
      action.delayMs,
    );
    return { ...action, status };
  }

  await sendLessonNudge(action.userId, action.dayNumber, action.afterHours);
  return { ...action, status: "sent" };
}

export async function reconcileFreeLessonNotifications(options: ReconcileOptions): Promise<LessonRecoveryReport> {
  const now = new Date();
  const candidates = await loadLessonRecoveryCandidates();
  const actions = candidates.flatMap((candidate) => buildLessonRecoveryActions(candidate, now, options.backfill));
  const countsByKind = buildLessonRecoveryActionCounts();
  const actionResults: ReconcileActionResult[] = [];

  for (const action of actions) {
    countsByKind[action.kind] += 1;

    if (options.mode === "dry-run") {
      actionResults.push({ ...action, status: "planned" });
      continue;
    }

    actionResults.push(await applyLessonRecoveryAction(action));
  }

  return {
    mode: options.mode,
    backfill: Array.from(options.backfill),
    summary: {
      usersScanned: new Set(candidates.map((candidate) => candidate.userId)).size,
      candidatesScanned: candidates.length,
      actionsPlanned: actions.length,
      actionsApplied: options.mode === "apply" ? actionResults.length : 0,
      countsByKind,
    },
    actions: actionResults,
  };
}
