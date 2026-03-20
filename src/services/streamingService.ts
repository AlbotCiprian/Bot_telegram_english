import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db/client.js";
import { logUserEvent } from "./eventService.js";
import {
  type LessonDay,
  type ServiceStreamKey,
  getAbsoluteWatchUrl,
  getAbsoluteServiceWatchUrl,
  getLessonStreamAsset,
  getServiceStreamAsset,
  getStreamManifestPath,
  getStreamPosterPath,
  getServiceStreamPosterPath,
  getServiceStreamVideoPath,
  isLessonStreamReady,
  isServiceStreamReady,
  listLessonStreamAssets,
  listServiceStreamAssets,
} from "./streamingAssets.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { getRedisClient, getRedisJson, setRedisJson } from "./redis.js";

type LessonWatchTokenPayload = {
  v: 1;
  userId: number;
  dayNumber: LessonDay;
  exp: number;
  iat: number;
};

type ServiceWatchTokenPayload = {
  v: 1;
  userId: number;
  serviceKey: ServiceStreamKey;
  exp: number;
  iat: number;
};

type StreamSessionRecord = {
  sessionId: string;
  userId: number;
  dayNumber: LessonDay;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastPlaybackSecond: number;
  lastPersistedSecond: number;
  platform: string | null;
  userAgent: string | null;
  maxRendition: number;
};

export type ActiveStreamSession = StreamSessionRecord;

type StreamSessionResponse = {
  sessionId: string;
  lessonTitle: string;
  lessonDay: LessonDay;
  streamKey: string;
  manifestUrl: string;
  posterUrl: string;
  maxRendition: number;
  canUseNativeHls: boolean;
};

type ServiceStreamSessionRecord = {
  sessionId: string;
  userId: number;
  serviceKey: ServiceStreamKey;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastPlaybackSecond: number;
  platform: string | null;
  userAgent: string | null;
};

type ServiceStreamSessionResponse = {
  sessionId: string;
  serviceTitle: string;
  serviceKey: ServiceStreamKey;
  streamKey: string;
  videoUrl: string;
  posterUrl: string;
};

const STREAM_SESSION_PREFIX = "stream:session:";
const STREAM_ACTIVE_SESSIONS_KEY = "stream:sessions:active";
const STREAM_ERROR_COUNTER_KEY = "stream:sessions:error-count";
const SERVICE_STREAM_SESSION_PREFIX = "service-stream:session:";
const SERVICE_STREAM_ACTIVE_SESSIONS_KEY = "service-stream:sessions:active";
const SERVICE_STREAM_ERROR_COUNTER_KEY = "service-stream:sessions:error-count";
const STREAM_LAST_BUILD_MANIFEST = path.resolve(path.dirname(config.STREAM_HLS_ROOT), "manifest.json");

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenSegment(payloadSegment: string): string {
  return createHmac("sha256", config.STREAM_SIGNING_SECRET).update(payloadSegment).digest("base64url");
}

function buildStreamSessionKey(sessionId: string): string {
  return `${STREAM_SESSION_PREFIX}${sessionId}`;
}

function buildServiceStreamSessionKey(sessionId: string): string {
  return `${SERVICE_STREAM_SESSION_PREFIX}${sessionId}`;
}

function buildStreamMediaUrl(dayNumber: LessonDay, sessionId: string, fileName: string): string {
  return `/api/stream/media/${dayNumber}/${encodeURIComponent(fileName)}?sessionId=${encodeURIComponent(sessionId)}`;
}

function buildStreamPosterUrl(dayNumber: LessonDay, sessionId: string): string {
  return `/api/stream/poster/${dayNumber}?sessionId=${encodeURIComponent(sessionId)}`;
}

function buildServiceStreamVideoUrl(serviceKey: ServiceStreamKey, sessionId: string): string {
  return `/api/stream/service/media/${serviceKey}?sessionId=${encodeURIComponent(sessionId)}`;
}

function buildServiceStreamPosterUrl(serviceKey: ServiceStreamKey, sessionId: string): string {
  return `/api/stream/service/poster/${serviceKey}?sessionId=${encodeURIComponent(sessionId)}`;
}

function getMaximumRenditionHeight(platform: string | null): number {
  const normalizedPlatform = (platform ?? "").toLowerCase();
  const isMobilePlatform =
    normalizedPlatform.includes("ios") ||
    normalizedPlatform.includes("android") ||
    normalizedPlatform.includes("mobile");

  return isMobilePlatform ? config.STREAM_MOBILE_MAX_RENDITION : config.STREAM_DESKTOP_MAX_RENDITION;
}

function isLessonUnlockedForUser(user: {
  lesson1Unlocked: boolean;
  lesson2Unlocked: boolean;
  lesson3Unlocked: boolean;
}, dayNumber: LessonDay): boolean {
  if (dayNumber === 1) {
    return user.lesson1Unlocked;
  }

  if (dayNumber === 2) {
    return user.lesson2Unlocked;
  }

  return user.lesson3Unlocked;
}

function getManifestBuildMetadata() {
  if (!fs.existsSync(STREAM_LAST_BUILD_MANIFEST)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(STREAM_LAST_BUILD_MANIFEST, "utf8")) as Record<string, unknown>;
  } catch (error) {
    logger.warn({ err: error, path: STREAM_LAST_BUILD_MANIFEST }, "Nu am putut citi manifestul local de stream.");
    return null;
  }
}

export function createLessonWatchToken(userId: number, dayNumber: LessonDay): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: LessonWatchTokenPayload = {
    v: 1,
    userId,
    dayNumber,
    iat: nowSec,
    exp: nowSec + config.STREAM_SESSION_TTL_SEC,
  };

  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenSegment(payloadSegment);
  return `${payloadSegment}.${signature}`;
}

export function verifyLessonWatchToken(token: string): LessonWatchTokenPayload | null {
  const [payloadSegment, signature] = token.split(".");
  if (!payloadSegment || !signature) {
    return null;
  }

  const expectedSignature = signTokenSegment(payloadSegment);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as LessonWatchTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.v !== 1 || payload.exp < nowSec) {
      return null;
    }

    if (![1, 2, 3].includes(payload.dayNumber)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createServiceWatchToken(userId: number, serviceKey: ServiceStreamKey): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: ServiceWatchTokenPayload = {
    v: 1,
    userId,
    serviceKey,
    iat: nowSec,
    exp: nowSec + config.STREAM_SESSION_TTL_SEC,
  };

  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenSegment(payloadSegment);
  return `${payloadSegment}.${signature}`;
}

export function verifyServiceWatchToken(token: string): ServiceWatchTokenPayload | null {
  const [payloadSegment, signature] = token.split(".");
  if (!payloadSegment || !signature) {
    return null;
  }

  const expectedSignature = signTokenSegment(payloadSegment);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadSegment)) as ServiceWatchTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.v !== 1 || payload.exp < nowSec) {
      return null;
    }

    if (payload.serviceKey !== "career-astrology") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildLessonWatchAccess(userId: number, dayNumber: LessonDay) {
  const token = createLessonWatchToken(userId, dayNumber);
  const watchUrl = getAbsoluteWatchUrl(dayNumber, token);

  return {
    token,
    watchUrl,
  };
}

export function buildServiceWatchAccess(userId: number, serviceKey: ServiceStreamKey) {
  const token = createServiceWatchToken(userId, serviceKey);
  const watchUrl = getAbsoluteServiceWatchUrl(serviceKey, token);

  return {
    token,
    watchUrl,
  };
}

export async function getActiveStreamSession(
  sessionId: string,
  expectedDayNumber?: LessonDay,
): Promise<ActiveStreamSession> {
  const session = await getRedisJson<StreamSessionRecord>(buildStreamSessionKey(sessionId));

  if (!session) {
    throw new Error("Sesiunea de streaming nu mai este activă.");
  }

  if (expectedDayNumber && session.dayNumber !== expectedDayNumber) {
    throw new Error("Sesiunea de streaming nu corespunde lecției cerute.");
  }

  return session;
}

export async function createStreamSession(params: {
  token: string;
  platform?: string | null;
  userAgent?: string | null;
  prefersNativeHls?: boolean;
}): Promise<StreamSessionResponse> {
  const payload = verifyLessonWatchToken(params.token);
  if (!payload) {
    throw new Error("Token-ul de streaming este invalid sau expirat.");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      lesson1Unlocked: true,
      lesson2Unlocked: true,
      lesson3Unlocked: true,
    },
  });

  if (!user || !isLessonUnlockedForUser(user, payload.dayNumber)) {
    throw new Error("Lecția nu este disponibilă pentru utilizatorul curent.");
  }

  if (!config.streamingEnabled || config.LESSON_DELIVERY_MODE !== "internal_stream") {
    throw new Error("Streaming-ul intern nu este activ în configurația curentă.");
  }

  if (!isLessonStreamReady(payload.dayNumber)) {
    throw new Error("Asset-ul de streaming pentru această lecție nu este pregătit încă.");
  }

  const asset = getLessonStreamAsset(payload.dayNumber);
  const sessionId = randomUUID();
  const session: StreamSessionRecord = {
    sessionId,
    userId: payload.userId,
    dayNumber: payload.dayNumber,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    lastPlaybackSecond: 0,
    lastPersistedSecond: 0,
    platform: params.platform?.trim() || null,
    userAgent: params.userAgent?.trim() || null,
    maxRendition: getMaximumRenditionHeight(params.platform ?? null),
  };

  await setRedisJson(buildStreamSessionKey(sessionId), session, config.STREAM_SESSION_TTL_SEC);

  const redis = getRedisClient();
  await redis.sadd(STREAM_ACTIVE_SESSIONS_KEY, sessionId);
  await redis.expire(STREAM_ACTIVE_SESSIONS_KEY, config.STREAM_SESSION_TTL_SEC);

  await prisma.lessonProgress.upsert({
    where: {
      userId_dayNumber: {
        userId: payload.userId,
        dayNumber: payload.dayNumber,
      },
    },
    update: {
      openedAt: new Date(),
      streamSessionCreatedAt: new Date(),
    },
    create: {
      userId: payload.userId,
      dayNumber: payload.dayNumber,
      openedAt: new Date(),
      streamSessionCreatedAt: new Date(),
    },
  });

  await logUserEvent({
    userId: payload.userId,
    eventType: "lesson_stream_session_created",
    metadata: {
      dayNumber: payload.dayNumber,
      sessionId,
      platform: session.platform,
      userAgent: session.userAgent,
    },
  });

  return {
    sessionId,
    lessonTitle: asset.title,
    lessonDay: asset.dayNumber,
    streamKey: asset.streamKey,
    manifestUrl: buildStreamMediaUrl(asset.dayNumber, sessionId, "master.m3u8"),
    posterUrl: buildStreamPosterUrl(asset.dayNumber, sessionId),
    maxRendition: session.maxRendition,
    canUseNativeHls: Boolean(params.prefersNativeHls),
  };
}

export async function getActiveServiceStreamSession(
  sessionId: string,
  expectedServiceKey?: ServiceStreamKey,
): Promise<ServiceStreamSessionRecord> {
  const session = await getRedisJson<ServiceStreamSessionRecord>(buildServiceStreamSessionKey(sessionId));

  if (!session) {
    throw new Error("Sesiunea video nu mai este activă.");
  }

  if (expectedServiceKey && session.serviceKey !== expectedServiceKey) {
    throw new Error("Sesiunea video nu corespunde serviciului cerut.");
  }

  return session;
}

export async function createServiceStreamSession(params: {
  token: string;
  platform?: string | null;
  userAgent?: string | null;
}): Promise<ServiceStreamSessionResponse> {
  const payload = verifyServiceWatchToken(params.token);
  if (!payload) {
    throw new Error("Token-ul video pentru serviciu este invalid sau expirat.");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("Utilizatorul pentru acest video nu a fost găsit.");
  }

  if (!config.streamingEnabled) {
    throw new Error("Streaming-ul intern nu este activ în configurația curentă.");
  }

  if (!isServiceStreamReady(payload.serviceKey)) {
    throw new Error("Video-ul pentru acest serviciu nu este pregătit încă pe server.");
  }

  const asset = getServiceStreamAsset(payload.serviceKey);
  const sessionId = randomUUID();
  const session: ServiceStreamSessionRecord = {
    sessionId,
    userId: payload.userId,
    serviceKey: payload.serviceKey,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    lastPlaybackSecond: 0,
    platform: params.platform?.trim() || null,
    userAgent: params.userAgent?.trim() || null,
  };

  await setRedisJson(buildServiceStreamSessionKey(sessionId), session, config.STREAM_SESSION_TTL_SEC);

  const redis = getRedisClient();
  await redis.sadd(SERVICE_STREAM_ACTIVE_SESSIONS_KEY, sessionId);
  await redis.expire(SERVICE_STREAM_ACTIVE_SESSIONS_KEY, config.STREAM_SESSION_TTL_SEC);

  await logUserEvent({
    userId: payload.userId,
    eventType: "service_stream_session_created",
    metadata: {
      serviceKey: payload.serviceKey,
      sessionId,
      platform: session.platform,
      userAgent: session.userAgent,
    },
  });

  return {
    sessionId,
    serviceTitle: asset.title,
    serviceKey: asset.serviceKey,
    streamKey: asset.streamKey,
    videoUrl: buildServiceStreamVideoUrl(asset.serviceKey, sessionId),
    posterUrl: buildServiceStreamPosterUrl(asset.serviceKey, sessionId),
  };
}

export async function recordStreamProgress(params: {
  sessionId: string;
  currentTimeSec: number;
  durationSec?: number | null;
}): Promise<{ quizUnlocked: boolean; completed: boolean }> {
  const sessionKey = buildStreamSessionKey(params.sessionId);
  const session = await getRedisJson<StreamSessionRecord>(sessionKey);

  if (!session) {
    throw new Error("Sesiunea de streaming nu mai este activă.");
  }

  const currentTimeSec = Math.max(0, Math.floor(params.currentTimeSec));
  const now = new Date();
  const shouldPersist =
    currentTimeSec >= session.lastPersistedSecond + 15 ||
    currentTimeSec >= 60 ||
    (params.durationSec ? currentTimeSec >= Math.floor(params.durationSec * 0.9) : false);

  const updates: Record<string, Date | number | null> = {
    lastPlaybackSecond: Math.max(session.lastPlaybackSecond, currentTimeSec),
  };

  let logStarted = false;
  let quizUnlocked = false;

  if (!session.startedAt && currentTimeSec > 0) {
    session.startedAt = now.toISOString();
    updates.streamStartedAt = now;
    logStarted = true;
  }

  if (currentTimeSec >= 60) {
    const progress = await prisma.lessonProgress.findUnique({
      where: {
        userId_dayNumber: {
          userId: session.userId,
          dayNumber: session.dayNumber,
        },
      },
      select: {
        quizAvailableAt: true,
      },
    });

    if (!progress?.quizAvailableAt) {
      updates.quizAvailableAt = now;
      updates.videoSentAt = now;
      quizUnlocked = true;
    }
  }

  if (shouldPersist) {
    session.lastPersistedSecond = currentTimeSec;
    await prisma.lessonProgress.upsert({
      where: {
        userId_dayNumber: {
          userId: session.userId,
          dayNumber: session.dayNumber,
        },
      },
      update: updates,
      create: {
        userId: session.userId,
        dayNumber: session.dayNumber,
        openedAt: now,
        streamSessionCreatedAt: now,
        streamStartedAt: session.startedAt ? new Date(session.startedAt) : now,
        lastPlaybackSecond: currentTimeSec,
        quizAvailableAt: currentTimeSec >= 60 ? now : null,
        videoSentAt: currentTimeSec >= 60 ? now : null,
      },
    });
  }

  session.lastPlaybackSecond = Math.max(session.lastPlaybackSecond, currentTimeSec);
  await setRedisJson(sessionKey, session, config.STREAM_SESSION_TTL_SEC);

  if (logStarted) {
    await logUserEvent({
      userId: session.userId,
      eventType: "lesson_stream_started",
      metadata: {
        dayNumber: session.dayNumber,
        sessionId: session.sessionId,
      },
    });
  }

  if (quizUnlocked) {
    await logUserEvent({
      userId: session.userId,
      eventType: "lesson_stream_quiz_unlocked",
      metadata: {
        dayNumber: session.dayNumber,
        sessionId: session.sessionId,
        playbackSecond: currentTimeSec,
      },
    });
  }

  return {
    quizUnlocked,
    completed: Boolean(session.completedAt),
  };
}

export async function completeStreamSession(params: {
  sessionId: string;
  currentTimeSec?: number | null;
}): Promise<void> {
  const sessionKey = buildStreamSessionKey(params.sessionId);
  const session = await getRedisJson<StreamSessionRecord>(sessionKey);

  if (!session) {
    throw new Error("Sesiunea de streaming nu mai este activă.");
  }

  const now = new Date();
  const currentTimeSec = Math.max(session.lastPlaybackSecond, Math.floor(params.currentTimeSec ?? session.lastPlaybackSecond));
  session.completedAt = now.toISOString();
  session.lastPlaybackSecond = currentTimeSec;
  session.lastPersistedSecond = Math.max(session.lastPersistedSecond, currentTimeSec);

  await prisma.lessonProgress.upsert({
    where: {
      userId_dayNumber: {
        userId: session.userId,
        dayNumber: session.dayNumber,
      },
    },
    update: {
      streamCompletedAt: now,
      lastPlaybackSecond: currentTimeSec,
      quizAvailableAt: currentTimeSec >= 60 ? now : undefined,
      videoSentAt: currentTimeSec >= 60 ? now : undefined,
    },
    create: {
      userId: session.userId,
      dayNumber: session.dayNumber,
      openedAt: now,
      streamSessionCreatedAt: now,
      streamStartedAt: session.startedAt ? new Date(session.startedAt) : now,
      streamCompletedAt: now,
      lastPlaybackSecond: currentTimeSec,
      quizAvailableAt: currentTimeSec >= 60 ? now : null,
      videoSentAt: currentTimeSec >= 60 ? now : null,
    },
  });

  await setRedisJson(sessionKey, session, Math.max(300, Math.floor(config.STREAM_SESSION_TTL_SEC / 4)));

  const redis = getRedisClient();
  await redis.srem(STREAM_ACTIVE_SESSIONS_KEY, session.sessionId);

  await logUserEvent({
    userId: session.userId,
    eventType: "lesson_stream_completed",
    metadata: {
      dayNumber: session.dayNumber,
      sessionId: session.sessionId,
      playbackSecond: currentTimeSec,
    },
  });
}

export async function recordServiceStreamProgress(params: {
  sessionId: string;
  currentTimeSec: number;
}): Promise<void> {
  const sessionKey = buildServiceStreamSessionKey(params.sessionId);
  const session = await getRedisJson<ServiceStreamSessionRecord>(sessionKey);

  if (!session) {
    throw new Error("Sesiunea video nu mai este activă.");
  }

  const currentTimeSec = Math.max(0, Math.floor(params.currentTimeSec));
  const shouldLogStarted = !session.startedAt && currentTimeSec > 0;

  if (shouldLogStarted) {
    session.startedAt = new Date().toISOString();
  }

  session.lastPlaybackSecond = Math.max(session.lastPlaybackSecond, currentTimeSec);
  await setRedisJson(sessionKey, session, config.STREAM_SESSION_TTL_SEC);

  if (shouldLogStarted) {
    await logUserEvent({
      userId: session.userId,
      eventType: "service_stream_started",
      metadata: {
        serviceKey: session.serviceKey,
        sessionId: session.sessionId,
      },
    });
  }
}

export async function completeServiceStreamSession(params: {
  sessionId: string;
  currentTimeSec?: number | null;
}): Promise<void> {
  const sessionKey = buildServiceStreamSessionKey(params.sessionId);
  const session = await getRedisJson<ServiceStreamSessionRecord>(sessionKey);

  if (!session) {
    throw new Error("Sesiunea video nu mai este activă.");
  }

  const currentTimeSec = Math.max(session.lastPlaybackSecond, Math.floor(params.currentTimeSec ?? session.lastPlaybackSecond));
  session.completedAt = new Date().toISOString();
  session.lastPlaybackSecond = currentTimeSec;

  await setRedisJson(sessionKey, session, Math.max(300, Math.floor(config.STREAM_SESSION_TTL_SEC / 4)));

  const redis = getRedisClient();
  await redis.srem(SERVICE_STREAM_ACTIVE_SESSIONS_KEY, session.sessionId);

  await logUserEvent({
    userId: session.userId,
    eventType: "service_stream_completed",
    metadata: {
      serviceKey: session.serviceKey,
      sessionId: session.sessionId,
      playbackSecond: currentTimeSec,
    },
  });
}

export async function markStreamError(params: {
  token?: string | null;
  sessionId?: string | null;
  message: string;
}): Promise<void> {
  const payload = params.token ? verifyLessonWatchToken(params.token) : null;
  const redis = getRedisClient();
  await redis.incr(STREAM_ERROR_COUNTER_KEY);

  await logUserEvent({
    userId: payload?.userId ?? null,
    eventType: "lesson_stream_error",
    metadata: {
      dayNumber: payload?.dayNumber ?? null,
      sessionId: params.sessionId ?? null,
      message: params.message,
    },
  });
}

export async function markServiceStreamError(params: {
  token?: string | null;
  sessionId?: string | null;
  message: string;
}): Promise<void> {
  const payload = params.token ? verifyServiceWatchToken(params.token) : null;
  const redis = getRedisClient();
  await redis.incr(SERVICE_STREAM_ERROR_COUNTER_KEY);

  await logUserEvent({
    userId: payload?.userId ?? null,
    eventType: "service_stream_error",
    metadata: {
      serviceKey: payload?.serviceKey ?? null,
      sessionId: params.sessionId ?? null,
      message: params.message,
    },
  });
}

export async function getStreamStats() {
  const redis = getRedisClient();
  const [activeSessions, errorCount, sessionsCreated, sessionsStarted, sessionsCompleted, serviceActiveSessions, serviceErrorCount] = await Promise.all([
    redis.scard(STREAM_ACTIVE_SESSIONS_KEY),
    redis.get(STREAM_ERROR_COUNTER_KEY),
    prisma.userEvent.count({ where: { eventType: "lesson_stream_session_created" } }),
    prisma.userEvent.count({ where: { eventType: "lesson_stream_started" } }),
    prisma.userEvent.count({ where: { eventType: "lesson_stream_completed" } }),
    redis.scard(SERVICE_STREAM_ACTIVE_SESSIONS_KEY),
    redis.get(SERVICE_STREAM_ERROR_COUNTER_KEY),
  ]);

  const assetSummaries = listLessonStreamAssets().map((asset) => ({
    dayNumber: asset.dayNumber,
    title: asset.title,
    streamKey: asset.streamKey,
    manifestPath: getStreamManifestPath(asset),
    posterPath: getStreamPosterPath(asset),
    ready: fs.existsSync(getStreamManifestPath(asset)) && fs.existsSync(getStreamPosterPath(asset)),
  }));

  const serviceAssetSummaries = listServiceStreamAssets().map((asset) => ({
    serviceKey: asset.serviceKey,
    publicEntryKey: asset.publicEntryKey,
    title: asset.title,
    streamKey: asset.streamKey,
    videoPath: getServiceStreamVideoPath(asset),
    posterPath: getServiceStreamPosterPath(asset),
    ready: fs.existsSync(getServiceStreamVideoPath(asset)) && fs.existsSync(getServiceStreamPosterPath(asset)),
  }));

  return {
    enabled: config.streamingEnabled,
    deliveryMode: config.LESSON_DELIVERY_MODE,
    activeSessions,
    errorCount: Number(errorCount ?? 0),
    serviceActiveSessions,
    serviceErrorCount: Number(serviceErrorCount ?? 0),
    sessionsCreated,
    sessionsStarted,
    sessionsCompleted,
    lastBuildManifest: getManifestBuildMetadata(),
    assets: assetSummaries,
    serviceAssets: serviceAssetSummaries,
  };
}

export function resolveLessonWatchUrl(userId: number, dayNumber: LessonDay): string {
  const access = buildLessonWatchAccess(userId, dayNumber);
  return access.watchUrl;
}

export function getLessonStreamAvailability(dayNumber: LessonDay) {
  const asset = getLessonStreamAsset(dayNumber);
  return {
    ready: isLessonStreamReady(dayNumber),
    manifestPath: getStreamManifestPath(asset),
    posterPath: getStreamPosterPath(asset),
    publicWatchBaseUrl: `${config.STREAM_PUBLIC_BASE_URL.replace(/\/+$/, "")}/watch/lesson/${dayNumber}`,
  };
}

export function resolveServiceWatchUrl(userId: number, serviceKey: ServiceStreamKey): string {
  const access = buildServiceWatchAccess(userId, serviceKey);
  return access.watchUrl;
}

export function getServiceStreamAvailability(serviceKey: ServiceStreamKey) {
  const asset = getServiceStreamAsset(serviceKey);
  return {
    ready: isServiceStreamReady(serviceKey),
    videoPath: getServiceStreamVideoPath(asset),
    posterPath: getServiceStreamPosterPath(asset),
    publicWatchBaseUrl: `${config.STREAM_PUBLIC_BASE_URL.replace(/\/+$/, "")}/watch/service/${serviceKey}`,
  };
}
