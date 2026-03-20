import { Markup } from "telegraf";
import { UI_LABELS } from "../content/copy.js";
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

  for (const item of PUBLIC_ENTRY_MENU.filter((entry) => entry.key !== "free_lessons" && entry.key !== "marathon")) {
    remainingKeys.push(item.key);
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
  return Markup.keyboard(buildMainMenuRows()).resize();
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
  return Markup.inlineKeyboard([[Markup.button.callback(UI_LABELS.backToMenu, "menu:menu")]]);
}

export function getPrivacyChoiceKeyboard() {
  return Markup.keyboard([[UI_LABELS.acceptPrivacy]]).oneTime().resize();
}

export function getYesNoKeyboard(prefix: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(UI_LABELS.yes, `${prefix}:yes`), Markup.button.callback(UI_LABELS.no, `${prefix}:no`)],
  ]);
}

export function getPhoneRequestKeyboard() {
  return Markup.keyboard([
    [Markup.button.contactRequest(UI_LABELS.sendPhone)],
    [UI_LABELS.writePhoneManually],
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
    "Botul te poate ghida prin lecțiile gratuite, prin resursele academiei și prin pașii necesari dacă vrei să fii contactat.",
    "",
    "Dacă ești utilizator nou, primul pas este onboardingul scurt pentru activarea accesului.",
    "",
    "Comenzi disponibile:",
    "/start",
    "/menu",
    "/help",
    "/reset",
  ].join("\n");
}
