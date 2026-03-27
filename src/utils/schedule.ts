import { config } from "./config.js";

export type DelayMap = {
  lesson2Ms: number;
  lesson3Ms: number;
  followUpMs: number;
  inactiveMs: number;
  longReminderMs: number;
};

const delayMapByMode: Record<"dev" | "prod", DelayMap> = {
  dev: {
    lesson2Ms: 2 * 60 * 1000,
    lesson3Ms: 4 * 60 * 1000,
    followUpMs: 8 * 60 * 1000,
    inactiveMs: 12 * 60 * 1000,
    longReminderMs: 20 * 60 * 1000,
  },
  prod: {
    lesson2Ms: 24 * 60 * 60 * 1000,
    lesson3Ms: 48 * 60 * 60 * 1000,
    followUpMs: 4 * 24 * 60 * 60 * 1000,
    inactiveMs: 7 * 24 * 60 * 60 * 1000,
    longReminderMs: 14 * 24 * 60 * 60 * 1000,
  },
};

export function getDelayMapForMode(mode: "dev" | "prod"): DelayMap {
  return delayMapByMode[mode];
}

export function getDelayMap(): DelayMap {
  return getDelayMapForMode(config.LESSON_DELAY_MODE);
}

export function getLessonUnlockTimes(
  activationTime: Date,
  delayMap: Pick<DelayMap, "lesson2Ms" | "lesson3Ms"> = getDelayMap(),
): { lesson2UnlockTime: Date; lesson3UnlockTime: Date } {
  return {
    lesson2UnlockTime: new Date(activationTime.getTime() + delayMap.lesson2Ms),
    lesson3UnlockTime: new Date(activationTime.getTime() + delayMap.lesson3Ms),
  };
}

export function getRunAt(delayMs: number): Date {
  return new Date(Date.now() + delayMs);
}
