import { describe, expect, it } from "vitest";
import { getDelayMap } from "../utils/schedule.js";
import { embedTextLocally, splitIntoChunks } from "../services/vectorService.js";
import { isValidEmail, isValidPhone, normalizePhone } from "../utils/validators.js";
import { MAIN_MENU } from "../content/staticContent.js";

describe("local runtime invariants", () => {
  it("exposes the full main menu", () => {
    expect(MAIN_MENU).toHaveLength(9);
    expect(MAIN_MENU[0]?.key).toBe("lessons");
    expect(MAIN_MENU[1]?.key).toBe("free_lessons");
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
});
