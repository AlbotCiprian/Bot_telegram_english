import { describe, expect, it } from "vitest";
import { getDelayMap } from "../utils/schedule.js";
import { embedTextLocally, splitIntoChunks } from "../services/vectorService.js";
import { isValidEmail, isValidPhone, normalizePhone } from "../utils/validators.js";
import { MAIN_MENU, isMarathonVisible } from "../content/staticContent.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";

describe("local runtime invariants", () => {
  it("exposes the full main menu", () => {
    expect(MAIN_MENU).toHaveLength(9);
    expect(MAIN_MENU[0]?.key).toBe("lessons");
    expect(MAIN_MENU[1]?.key).toBe("free_lessons");
    expect(MAIN_MENU.some((item) => item.key === "marathon")).toBe(true);
    expect(MAIN_MENU.map((item) => item.key)).not.toContain("about_academy");
  });

  it("normalizes and validates phone numbers", () => {
    expect(normalizePhone("00373 69123456")).toBe("+37369123456");
    expect(isValidPhone("+37369123456")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
  });

  it("validates emails", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("splits content into reusable chunks", () => {
    const text = Array.from({ length: 1300 }, (_, index) => `word-${index}`).join(" ");
    const chunks = splitIntoChunks(text, 500, 50);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].split(" ").length).toBeLessThanOrEqual(500);
  });

  it("creates deterministic local embeddings", () => {
    const first = embedTextLocally("english for career");
    const second = embedTextLocally("english for career");
    expect(first).toHaveLength(384);
    expect(first).toEqual(second);
  });

  it("returns the dev schedule map", () => {
    const delays = getDelayMap();
    expect(delays.lesson2Ms).toBeGreaterThan(0);
    expect(delays.longReminderMs).toBeGreaterThan(delays.lesson3Ms);
  });

  it("shows marathon by default when no visibility window is set", () => {
    expect(isMarathonVisible()).toBe(true);
  });

  it("treats marathon start and end dates as inclusive Chisinau calendar days", () => {
    const window = {
      startDate: "2026-04-10",
      endDate: "2026-04-30",
    };
    expect(isMarathonVisible(new Date("2026-04-10T00:01:00+03:00"), window)).toBe(true);
    expect(isMarathonVisible(new Date("2026-04-30T23:59:00+03:00"), window)).toBe(true);
    expect(isMarathonVisible(new Date("2026-05-01T00:00:00+03:00"), window)).toBe(false);
  });

  it("resolves the local welcome image asset", () => {
    expect(resolveExistingMediaFile("Image_welcome.JPG")).toBeTruthy();
  });
});
