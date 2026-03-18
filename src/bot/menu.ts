import { Markup } from "telegraf";
import { MAIN_MENU, MainMenuKey, PUBLIC_ENTRY_MENU, STATIC_PAGES, isMarathonVisible } from "../content/staticContent.js";

function getMenuItem(key: MainMenuKey) {
  const item = MAIN_MENU.find((entry) => entry.key === key);
  if (!item) {
    throw new Error(`Menu item lipseste pentru cheia ${key}.`);
  }
  return item;
}

function buildMainMenuRows(options?: { showAi?: boolean }) {
  const rows: string[][] = [[getMenuItem("free_lessons").label]];
  const remainingKeys: MainMenuKey[] = [];

  if (isMarathonVisible()) {
    remainingKeys.push("marathon");
  }

  remainingKeys.push("lessons");

  for (const item of PUBLIC_ENTRY_MENU.filter((entry) => entry.key !== "free_lessons" && entry.key !== "marathon")) {
    remainingKeys.push(item.key);
  }

  if (options?.showAi) {
    remainingKeys.push("ask_ai");
  }

  for (let index = 0; index < remainingKeys.length; index += 2) {
    rows.push(remainingKeys.slice(index, index + 2).map((key) => getMenuItem(key).label));
  }

  return rows;
}

export function getPublicMenuKeyboard() {
  return Markup.keyboard(buildMainMenuRows()).resize();
}

export function getMainMenuKeyboard(options?: { showLessons?: boolean; showAi?: boolean }) {
  return Markup.keyboard(buildMainMenuRows({ showAi: options?.showAi })).resize();
}

export function getStartFreeLessonsKeyboard() {
  return getPublicMenuKeyboard();
}

export function resolveMenuActionFromLabel(label: string): MainMenuKey | null {
  const normalizedLabel = label.trim();
  const match = MAIN_MENU.find((entry) => entry.label === normalizedLabel);
  return match?.key ?? null;
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

export function getReasonChoiceKeyboard(options: string[]) {
  return Markup.keyboard(options.map((option) => [option])).resize().oneTime();
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
