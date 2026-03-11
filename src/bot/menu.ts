import { Markup } from "telegraf";
import { LEAD_GOAL_OPTIONS, LEAD_LEVEL_OPTIONS, MAIN_MENU, STATIC_PAGES } from "../content/staticContent.js";

function getMenuItem(key: (typeof MAIN_MENU)[number]["key"]) {
  const item = MAIN_MENU.find((entry) => entry.key === key);
  if (!item) {
    throw new Error(`Menu item lipseste pentru cheia ${key}.`);
  }
  return item;
}

export function getMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(getMenuItem("free_lessons").label, "menu:free_lessons")],
    [
      Markup.button.callback(getMenuItem("lessons").label, "menu:lessons"),
      Markup.button.callback(getMenuItem("wants_course").label, "menu:wants_course"),
    ],
    [
      Markup.button.callback(getMenuItem("programs").label, "menu:programs"),
      Markup.button.callback(getMenuItem("ask_ai").label, "menu:ask_ai"),
    ],
    [
      Markup.button.callback(getMenuItem("method").label, "menu:method"),
      Markup.button.callback(getMenuItem("mistakes").label, "menu:mistakes"),
    ],
    [
      Markup.button.callback(getMenuItem("career").label, "menu:career"),
      Markup.button.callback(getMenuItem("busy_people").label, "menu:busy_people"),
    ],
    [Markup.button.callback(getMenuItem("website").label, "menu:website")],
  ]);
}

export function getStartFreeLessonsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🎓 Incepe 3 lectii gratuite", "menu:free_lessons")],
    [
      Markup.button.callback("💶 Programe si preturi", "menu:programs"),
      Markup.button.callback("🤖 Intreaba AI-ul nostru", "menu:ask_ai"),
    ],
    [Markup.button.callback("🌐 Site oficial", "menu:website")],
  ]);
}

export function getBackToMenuKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("Meniul principal", "menu:menu")]]);
}

export function getPrivacyChoiceKeyboard() {
  return Markup.keyboard([["✔ Accept"]]).oneTime().resize();
}

export function getMarketingChoiceKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Da", "consent:marketing:yes"),
      Markup.button.callback("Nu", "consent:marketing:no"),
    ],
  ]);
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

export function getLeadLevelKeyboard() {
  return Markup.keyboard([
    [LEAD_LEVEL_OPTIONS[0], LEAD_LEVEL_OPTIONS[1]],
    [LEAD_LEVEL_OPTIONS[2], LEAD_LEVEL_OPTIONS[3]],
  ])
    .resize()
    .oneTime();
}

export function getLeadGoalKeyboard() {
  return Markup.keyboard([
    [LEAD_GOAL_OPTIONS[0], LEAD_GOAL_OPTIONS[1]],
    [LEAD_GOAL_OPTIONS[2], LEAD_GOAL_OPTIONS[3]],
  ])
    .resize()
    .oneTime();
}

export function getLevelKeyboard(prefix: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("A0", `${prefix}:A0`),
      Markup.button.callback("A1", `${prefix}:A1`),
      Markup.button.callback("A2", `${prefix}:A2`),
    ],
    [
      Markup.button.callback("B1", `${prefix}:B1`),
      Markup.button.callback("B2", `${prefix}:B2`),
      Markup.button.callback("Alt nivel", `${prefix}:OTHER`),
    ],
  ]);
}

export function buildStaticPageMessage(pageKey: keyof typeof STATIC_PAGES): string {
  const page = STATIC_PAGES[pageKey];
  return `*${page.title}*\n\n${page.body}`;
}

export function buildHelpMessage(): string {
  return [
    "*Ajutor*",
    "",
    "Recomandarea principala: incepe cu seria de 3 lectii gratuite.",
    "",
    "Din meniu poti sa:",
    "- primesti lectiile gratuite",
    "- vezi programele si preturile",
    "- intrebi AI-ul nostru despre scoala si cursuri",
    "- intri direct in flow-ul Vreau la curs",
    "",
    "Comenzi disponibile:",
    "/start",
    "/menu",
    "/help",
    "/reset",
  ].join("\n");
}
