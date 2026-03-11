import { config } from "./config.js";

type DelayMap = {
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

export function getDelayMap(): DelayMap {
  return delayMapByMode[config.LESSON_DELAY_MODE];
}

export function getRunAt(delayMs: number): Date {
  return new Date(Date.now() + delayMs);
}
