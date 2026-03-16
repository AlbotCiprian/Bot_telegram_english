import { Markup } from "telegraf";
import { MAIN_MENU, PUBLIC_ENTRY_MENU, STATIC_PAGES } from "../content/staticContent.js";

function getMenuItem(key: (typeof MAIN_MENU)[number]["key"]) {
  const item = MAIN_MENU.find((entry) => entry.key === key);
  if (!item) {
    throw new Error(`Menu item lipseste pentru cheia ${key}.`);
  }
  return item;
}

function buildSingleColumnKeyboard(labels: Array<{ label: string; action: string }>) {
  return Markup.inlineKeyboard(labels.map((item) => [Markup.button.callback(item.label, `menu:${item.action}`)]));
}

export function getPublicMenuKeyboard() {
  return buildSingleColumnKeyboard(PUBLIC_ENTRY_MENU.map((item) => ({ label: item.label, action: item.key })));
}

export function getMainMenuKeyboard(options?: { showLessons?: boolean; showAi?: boolean }) {
  const rows: Array<Array<ReturnType<typeof Markup.button.callback>>> = [];

  if (options?.showLessons) {
    rows.push([Markup.button.callback(getMenuItem("lessons").label, "menu:lessons")]);
  }

  rows.push([Markup.button.callback(getMenuItem("free_lessons").label, "menu:free_lessons")]);

  for (const item of PUBLIC_ENTRY_MENU.filter((entry) => entry.key !== "free_lessons")) {
    rows.push([Markup.button.callback(item.label, `menu:${item.key}`)]);
  }

  if (options?.showAi) {
    rows.push([Markup.button.callback(getMenuItem("ask_ai").label, "menu:ask_ai")]);
  }

  return Markup.inlineKeyboard(rows);
}

export function getStartFreeLessonsKeyboard() {
  return getPublicMenuKeyboard();
}

export function getBackToMenuKeyboard(_showLessons = false) {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Meniul principal", "menu:menu")]]);
}

export function getPrivacyChoiceKeyboard() {
  return Markup.keyboard([["✔ Accept"]]).oneTime().resize();
}

export function getYesNoKeyboard(prefix: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Da", `${prefix}:yes`), Markup.button.callback("Nu", `${prefix}:no`)],
  ]);
}

export function getPhoneRequestKeyboard() {
  return Markup.keyboard([
    [Markup.button.contactRequest("📱 Trimite numarul")],
    ["Voi scrie manual"],
  ])
    .resize()
    .oneTime();
}

export function buildStaticPageMessage(pageKey: keyof typeof STATIC_PAGES): string {
  const page = STATIC_PAGES[pageKey];
  return `*${page.title}*\n\n${page.body}`;
}

export function buildHelpMessage(): string {
  return [
    "*Ajutor*",
    "",
    "Botul te poate ghida prin serviciile principale si prin seria de 3 zile gratuite.",
    "",
    "Daca esti utilizator nou, primul pas important este onboardingul scurt pentru salvarea lead-ului in CRM.",
    "",
    "Comenzi disponibile:",
    "/start",
    "/menu",
    "/help",
    "/reset",
  ].join("\n");
}
