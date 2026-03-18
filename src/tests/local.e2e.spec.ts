import { describe, expect, it } from "vitest";
import { getDelayMap } from "../utils/schedule.js";
import { embedTextLocally, splitIntoChunks } from "../services/vectorService.js";
import { isValidEmail, isValidPhone, normalizePhone } from "../utils/validators.js";
import { MAIN_MENU, isMarathonVisible } from "../content/staticContent.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";
import { getMainMenuKeyboard, resolveMenuActionFromLabel } from "../bot/menu.js";
import {
  buildMarathonLandingMessage,
  buildMarathonOfferMessage,
  buildMarathonPackageMessage,
  getMarathonOffer,
  getMarathonPackageByKey,
  getMarathonPackageCatalog,
} from "../content/marathonContent.js";

describe("local runtime invariants", () => {
  it("exposes the full main menu", () => {
    expect(MAIN_MENU).toHaveLength(9);
    expect(MAIN_MENU[0]?.key).toBe("lessons");
    expect(MAIN_MENU[1]?.key).toBe("free_lessons");
    expect(MAIN_MENU.some((item) => item.key === "marathon")).toBe(true);
    expect(MAIN_MENU.map((item) => item.key)).not.toContain("about_academy");
  });

  it("builds the compact reply keyboard layout for the main menu", () => {
    const keyboard = getMainMenuKeyboard().reply_markup;
    if (!("keyboard" in keyboard)) {
      throw new Error("Main menu keyboard nu este ReplyKeyboardMarkup.");
    }

    const rows = keyboard.keyboard.map((row) =>
      row.map((button) => (typeof button === "string" ? button : button.text)),
    );

    expect(rows).toEqual([
      ["\uD83C\uDF93 3 zile gratuite"],
      ["\uD83D\uDE80 Maraton Engleza", "\uD83D\uDCDA Lectiile tale"],
      ["\uD83D\uDDE3\uFE0F Webinar: fara frica", "\uD83C\uDFA5 Metoda noastra"],
      ["\uD83D\uDCBC Programe si preturi", "\u26A1 Contact operator"],
      ["\uD83D\uDD2E Consultatie cariera"],
    ]);
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

  it("maps reply keyboard labels back to menu actions", () => {
    expect(resolveMenuActionFromLabel("\uD83C\uDF93 3 zile gratuite")).toBe("free_lessons");
    expect(resolveMenuActionFromLabel("\uD83D\uDCDA Lectiile tale")).toBe("lessons");
    expect(resolveMenuActionFromLabel("\u26A1 Contact operator")).toBe("operator");
  });

  it("builds the marathon package catalog from the configured defaults", () => {
    const catalog = getMarathonPackageCatalog();
    expect(catalog.map((item) => item.key)).toEqual(["basic", "silver", "gold", "premium", "vip"]);
    expect(catalog.find((item) => item.key === "basic")?.availableOffers).toHaveLength(3);
    expect(catalog.find((item) => item.key === "silver")?.availableOffers).toHaveLength(3);
    expect(catalog.find((item) => item.key === "gold")?.availableOffers).toHaveLength(3);
    expect(catalog.find((item) => item.key === "premium")?.availableOffers).toHaveLength(3);
    expect(catalog.find((item) => item.key === "vip")?.availableOffers).toHaveLength(2);
  });

  it("maps marathon offers positionally by cohort", () => {
    expect(getMarathonOffer("basic", 0)).toMatchObject({
      cohortLabel: "29 martie",
      priceLabel: expect.stringMatching(/^89\s*eur$/i),
    });
    expect(getMarathonOffer("premium", 2)).toMatchObject({
      cohortLabel: "10 aprilie",
      priceLabel: expect.stringMatching(/^300\s*eur$/i),
    });
    expect(getMarathonOffer("vip", 2)).toBeNull();
  });

  it("renders short marathon landing and package messages", () => {
    const basicPackage = getMarathonPackageByKey("basic");
    if (!basicPackage) {
      throw new Error("Pachetul Basic nu a fost gasit.");
    }

    const offer = getMarathonOffer("basic", 1);
    if (!offer) {
      throw new Error("Oferta Basic pentru index 1 nu a fost gasita.");
    }

    expect(buildMarathonLandingMessage()).toContain("Alege pachetul potrivit");
    expect(buildMarathonPackageMessage(basicPackage)).toContain("Alege data de start disponibila");
    expect(buildMarathonOfferMessage(basicPackage, offer)).toMatch(/Pret:\s*109\s*eur/i);
  });
});
