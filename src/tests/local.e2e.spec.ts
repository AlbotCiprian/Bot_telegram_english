import { describe, expect, it } from "vitest";
import { getDelayMap } from "../utils/schedule.js";
import { BOT_PROFILE_COPY } from "../content/botProfile.js";
import { buildLessonDeliveryText, buildLessonQuizPrompt } from "../content/lessonCopy.js";
import { embedTextLocally, splitIntoChunks } from "../services/vectorService.js";
import { isValidEmail, isValidPhone, normalizePhone } from "../utils/validators.js";
import { BRANDING, LESSON_SEED_CONTENT, MAIN_MENU, isMarathonVisible } from "../content/staticContent.js";
import { resolveExistingMediaFile } from "../utils/mediaAssets.js";
import { getMainMenuKeyboard, resolveMenuActionFromLabel } from "../bot/menu.js";
import { getLessonStreamAsset } from "../services/streamingAssets.js";
import { hasLessonQuiz } from "../services/lessonQuizService.js";
import { buildMarathonMessagePayload } from "../bot/handlers/serviceHandler.js";
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
    expect(MAIN_MENU).toHaveLength(6);
    expect(MAIN_MENU[0]?.key).toBe("free_lessons");
    expect(MAIN_MENU.some((item) => item.key === "marathon")).toBe(true);
    expect(MAIN_MENU.map((item) => item.key)).not.toContain("lessons");
    expect(MAIN_MENU.map((item) => item.key)).not.toContain("services");
    expect(MAIN_MENU.map((item) => item.key)).not.toContain("operator");
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
      ["🎓 3 lecții gratuite"],
      ["🚀 Maraton de engleză", "🗣️ Cum scapi de frica de a vorbi"],
      ["🎥 Metoda noastră", "🌐 Website"],
      ["🔮 Consultație astrologică în carieră"],
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

  it("renders the marathon message without inline preview and with the dedicated CTA link", () => {
    const payload = buildMarathonMessagePayload(false);

    expect(payload.text).not.toContain(BRANDING.marathonUrl);
    expect(payload.text).not.toContain(`${BRANDING.websiteUrl}#marathon`);
    expect(payload.options).not.toHaveProperty("link_preview_options");

    const keyboard = payload.options.reply_markup;
    if (!("inline_keyboard" in keyboard)) {
      throw new Error("Marathon keyboard nu este InlineKeyboardMarkup.");
    }

    expect(keyboard.inline_keyboard[0]?.[0]).toMatchObject({
      text: "🚀 Vezi maratonul",
      url: BRANDING.marathonUrl,
    });
    expect(
      keyboard.inline_keyboard
        .flat()
        .some((button) => "url" in button && button.url === `${BRANDING.websiteUrl}#marathon`),
    ).toBe(false);
  });

  it("keeps the public bot profile copy aligned with the requested wording", () => {
    expect(BOT_PROFILE_COPY.description).toBe(
      "Salutare! Bine ai venit la Academia Express English — unica școală de limba engleză care te ajută să începi să vorbești fluent în doar 7 săptămâni! ❤️",
    );
    expect(BOT_PROFILE_COPY.shortDescription).toBe(
      "Academia Express English te ajută să începi să vorbești fluent în 7 săptămâni. ❤️",
    );
    expect(BOT_PROFILE_COPY.shortDescription.length).toBeLessThanOrEqual(120);
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

  it("resolves versioned lesson and promo assets through aliases", () => {
    expect(resolveExistingMediaFile("lesson-1-v2-landscape.mp4")).toBeTruthy();
    expect(resolveExistingMediaFile("Metoda_noastra_optimized_new_format.mp4")).toBeTruthy();
  });

  it("maps reply keyboard labels back to menu actions", () => {
    expect(resolveMenuActionFromLabel("🎓 3 lecții gratuite")).toBe("free_lessons");
    expect(resolveMenuActionFromLabel("🌐 Website")).toBe("website");
    expect(resolveMenuActionFromLabel("🔮 Consultație astrologică în carieră")).toBe("career_astrology");
  });

  it("defines the internal stream manifest for all lesson days", () => {
    expect(getLessonStreamAsset(1)).toMatchObject({
      streamKey: "lesson-1",
      posterFileName: "lesson-1.jpg",
    });
    expect(getLessonStreamAsset(2).renditions.map((item) => item.height)).toEqual([480, 720]);
    expect(getLessonStreamAsset(3).sourceFileName).toBe("lesson-3-v2-landscape.mp4");
  });

  it("exposes quizzes for all three free lessons", () => {
    expect(hasLessonQuiz(1)).toBe(true);
    expect(hasLessonQuiz(2)).toBe(true);
    expect(hasLessonQuiz(3)).toBe(true);
  });

  it("stores lesson intro copy as title-only for all free lessons", () => {
    expect(LESSON_SEED_CONTENT.map((lesson) => lesson.messageText)).toEqual(["", "", ""]);
  });

  it("renders lesson delivery text without an empty paragraph", () => {
    expect(buildLessonDeliveryText("Lecția 1 · Test", "")).toBe("*Lecția 1 · Test*");
    expect(buildLessonDeliveryText("Lecția 1 · Test", "Text scurt")).toBe("*Lecția 1 · Test*\n\nText scurt");
  });

  it("personalizes the quiz prompt for the opened lesson", () => {
    expect(buildLessonQuizPrompt(2, false)).toContain("Lecția 2");
    expect(buildLessonQuizPrompt(3, true)).toContain("Lecția 3");
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
      throw new Error("Pachetul Basic nu a fost găsit.");
    }

    const offer = getMarathonOffer("basic", 1);
    if (!offer) {
      throw new Error("Oferta Basic pentru index 1 nu a fost găsită.");
    }

    expect(buildMarathonLandingMessage()).toContain("Alege pachetul potrivit");
    expect(buildMarathonPackageMessage(basicPackage)).toContain("Alege data de start disponibilă");
    expect(buildMarathonOfferMessage(basicPackage, offer)).toMatch(/Preț:\s*109\s*eur/i);
  });
});
