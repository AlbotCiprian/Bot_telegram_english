import { Redis as RedisClient } from "ioredis";
import { randomUUID } from "node:crypto";
import { config } from "../utils/config.js";

let redisClient: RedisClient | null = null;

function buildRedisClient(): RedisClient {
  return new RedisClient(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}

export function getRedisClient(): RedisClient {
  redisClient ??= buildRedisClient();
  return redisClient;
}

async function ensureConnected(): Promise<RedisClient> {
  const client = getRedisClient();
  if (client.status === "wait") {
    await client.connect();
  }
  return client;
}

export async function tryAcquireRedisLock(key: string, ttlMs: number): Promise<string | null> {
  const client = await ensureConnected();
  const token = randomUUID();
  const result = await client.set(key, token, "PX", ttlMs, "NX");
  return result === "OK" ? token : null;
}

export async function releaseRedisLock(key: string, token: string): Promise<void> {
  const client = await ensureConnected();
  const currentToken = await client.get(key);
  if (currentToken === token) {
    await client.del(key);
  }
}

export async function debounceRedisAction(key: string, ttlMs: number): Promise<boolean> {
  const client = await ensureConnected();
  const result = await client.set(key, "1", "PX", ttlMs, "NX");
  return result === "OK";
}

export async function tryAcquireRedisPermit(key: string, maxConcurrency: number, ttlSec: number): Promise<boolean> {
  const client = await ensureConnected();
  const next = await client.incr(key);

  if (next === 1) {
    await client.expire(key, ttlSec);
  }

  if (next > maxConcurrency) {
    await client.decr(key);
    return false;
  }

  return true;
}

export async function releaseRedisPermit(key: string): Promise<void> {
  const client = await ensureConnected();
  const current = await client.decr(key);
  if (current <= 0) {
    await client.del(key);
  }
}

export async function getRedisJson<T>(key: string): Promise<T | null> {
  const client = await ensureConnected();
  const rawValue = await client.get(key);
  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue) as T;
}

export async function setRedisJson(key: string, value: unknown, ttlSec: number): Promise<void> {
  const client = await ensureConnected();
  await client.set(key, JSON.stringify(value), "EX", ttlSec);
}

export async function deleteRedisKey(key: string): Promise<void> {
  const client = await ensureConnected();
  await client.del(key);
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) {
    return;
  }

  await redisClient.quit();
  redisClient = null;
}
