import { UI_LABELS } from "./copy.js";
import { config } from "../utils/config.js";

const MARATHON_TIMEZONE = "Europe/Chisinau";

export const BRANDING = {
  schoolName: "Express English Academy",
  websiteUrl: "https://www.expres.allengual.md/",
  consultationUrl: "https://www.expres.allengual.md/",
  accentLine:
    "Academia care te ajută să treci de la nesiguranță la engleză vorbită liber și folosită pentru creștere profesională.",
};

export const SERVICE_VIDEO_FILES = {
  fearSpeaking: "webinar-fear-v2-vertical.mp4",
  teachingMethod: "method-v2-vertical.mp4",
  aboutAcademy: "academy-v2-vertical.mp4",
} as const;

export const LEAD_LEVEL_OPTIONS = ["Începător", "Elementar", "Intermediar", "Nu știu"] as const;

export const LEAD_GOAL_OPTIONS = [
  "Job / carieră",
  "Călătorii",
  "Studii",
  "Dezvoltare personală",
] as const;

function buildDateKey(date: Date, timeZone = MARATHON_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function parseOptionalDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseOptionalDateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = parseOptionalDate(trimmed);
  return parsed ? buildDateKey(parsed) : null;
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function isMarathonVisible(
  now = new Date(),
  overrides?: { startDate?: string; endDate?: string },
): boolean {
  const start = parseOptionalDateKey(overrides?.startDate ?? config.MARATHON_START_DATE);
  const end = parseOptionalDateKey(overrides?.endDate ?? config.MARATHON_END_DATE);

  if (!start && !end) {
    return true;
  }

  const nowKey = buildDateKey(now);
  const afterStart = !start || nowKey >= start;
  const beforeEnd = !end || nowKey <= end;
  return afterStart && beforeEnd;
}

function buildMarathonPeriodLabel(): string {
  const start = parseOptionalDate(config.MARATHON_START_DATE);
  const end = parseOptionalDate(config.MARATHON_END_DATE);

  if (start && end) {
    return `Perioada activă: ${formatDateLabel(start)} - ${formatDateLabel(end)}.`;
  }

  if (start) {
    return `Perioada activă începe la ${formatDateLabel(start)}.`;
  }

  if (end) {
    return `Perioada activă este deschisă până la ${formatDateLabel(end)}.`;
  }

  return "Programul începe după 10 aprilie și rulează pe parcursul a câteva săptămâni.";
}

function buildMarathonPackageBlock(params: {
  title: string;
  price: string;
  term: string;
  bullets: string[];
}): string[] {
  const lines = [`*${params.title}*`];

  if (params.price.trim()) {
    lines.push(`Preț: ${params.price.trim()}`);
  }

  if (params.term.trim()) {
    lines.push(`Termen: ${params.term.trim()}`);
  }

  for (const bullet of params.bullets) {
    lines.push(`- ${bullet}`);
  }

  lines.push("");
  return lines;
}

function buildMarathonBody(): string {
  return [
    "Program intensiv de 21 de zile, cu 21 de lecții scurte de 2-3 minute și exerciții interactive după fiecare lecție.",
    "",
    "Potrivit pentru nivelurile 0 - B1 și construit pentru practică zilnică, rezultate rapide și mai multă încredere în vorbire.",
    "",
    buildMarathonPeriodLabel(),
    "",
    "*Pachete disponibile*",
    ...buildMarathonPackageBlock({
      title: "Basic",
      price: config.MARATHON_BASIC_PRICE,
      term: config.MARATHON_BASIC_TERM,
      bullets: ["acces complet la maraton (21 lecții + exerciții interactive)"],
    }),
    ...buildMarathonPackageBlock({
      title: "Silver",
      price: config.MARATHON_SILVER_PRICE,
      term: config.MARATHON_SILVER_TERM,
      bullets: [
        "acces complet la maraton",
        "meditație audio cu afirmații pozitive în engleză",
        "acces la chat suport cu Victoria",
      ],
    }),
    ...buildMarathonPackageBlock({
      title: "Gold",
      price: config.MARATHON_GOLD_PRICE,
      term: config.MARATHON_GOLD_TERM,
      bullets: [
        "acces complet la maraton",
        "meditație audio cu afirmații pozitive în engleză",
        "chat suport cu Victoria",
        "consultație astrologică EXPRESS de carieră",
      ],
    }),
    ...buildMarathonPackageBlock({
      title: "Premium",
      price: config.MARATHON_PREMIUM_PRICE,
      term: config.MARATHON_PREMIUM_TERM,
      bullets: [
        "tot din Gold",
        'acces la webinar LIVE din 21 aprilie: "Cum a construit un imperiu educațional de la credite"',
      ],
    }),
    ...buildMarathonPackageBlock({
      title: "VIP (doar 5 locuri)",
      price: config.MARATHON_VIP_PRICE,
      term: config.MARATHON_VIP_TERM,
      bullets: ["tot din Premium", "consultație individuală 1 la 1 cu Victoria"],
    }),
    "Accesul la maraton, meditație și webinar este valabil 6 luni.",
    "",
    "Pentru preț, apasă pe butonul de mai jos și îți deschidem imediat cererea în CRM.",
  ].join("\n");
}

export const PUBLIC_ENTRY_LABELS = {
  free_lessons: UI_LABELS.freeLessons,
  marathon: UI_LABELS.marathon,
  fear_speaking: UI_LABELS.fearSpeaking,
  teaching_method: UI_LABELS.teachingMethod,
  services: UI_LABELS.services,
  operator: UI_LABELS.operator,
  career_astrology: UI_LABELS.careerAstrology,
} as const;

export type PublicEntryKey = keyof typeof PUBLIC_ENTRY_LABELS;

const marathonMenuEntries = isMarathonVisible()
  ? ([{ key: "marathon", label: PUBLIC_ENTRY_LABELS.marathon }] as const)
  : ([] as const);

export const PUBLIC_ENTRY_MENU = [
  {
    key: "free_lessons",
    label: PUBLIC_ENTRY_LABELS.free_lessons,
  },
  ...marathonMenuEntries,
  {
    key: "fear_speaking",
    label: PUBLIC_ENTRY_LABELS.fear_speaking,
  },
  {
    key: "teaching_method",
    label: PUBLIC_ENTRY_LABELS.teaching_method,
  },
  {
    key: "services",
    label: PUBLIC_ENTRY_LABELS.services,
  },
  {
    key: "operator",
    label: PUBLIC_ENTRY_LABELS.operator,
  },
  {
    key: "career_astrology",
    label: PUBLIC_ENTRY_LABELS.career_astrology,
  },
] as const;

export type MainMenuKey = "lessons" | PublicEntryKey | "ask_ai";

export const MAIN_MENU = [
  {
    key: "lessons",
    label: UI_LABELS.lessons,
  },
  ...PUBLIC_ENTRY_MENU,
  {
    key: "ask_ai",
    label: UI_LABELS.askAi,
  },
] as const;

export const STATIC_PAGES = {
  welcome: {
    title: "Bună, bine ai venit la Express English Academy",
    body:
      "Alege între 3 lecții gratuite sau Maratonul de engleză și pornim rapid, cu un onboarding scurt și clar.",
  },
  academy: {
    title: "Despre academie",
    body: "Express English Academy este pentru oameni care vor să vorbească engleză clar, aplicat și cu încredere.",
  },
  marathon: {
    title: 'Maratonul "Vorbește engleză fluent EXPRESS"',
    body: buildMarathonBody(),
  },
  programs: {
    title: "Programe și prețuri",
    body: [
      "*Basic - Engleză pentru supraviețuire* - 250 EUR",
      "*Medium - Engleză pentru putere și curaj* - 350 EUR",
      "*Advanced - Engleză pentru statut și influență* - 400 EUR",
      "*Basic + Medium* - 550 EUR în loc de 600 EUR",
      "",
      "Deschide site-ul pentru descrierea completă a fiecărui program.",
    ].join("\n"),
  },
  method: {
    title: "Metoda noastră",
    body: "Video scurt despre cum lucrăm: clar, practic și orientat spre vorbire.",
  },
  fear_speaking: {
    title: "Webinar: cum scapi de frica de a vorbi",
    body: "Video despre cum spargi blocajul și începi să vorbești cu mai multă siguranță.",
  },
  website: {
    title: "Site oficial",
    body: `Deschide site-ul oficial pentru toate detaliile: ${BRANDING.websiteUrl}`,
  },
  operator: {
    title: "Contact operator",
    body: "Completează formularul scurt și trimitem cererea direct în CRM cu prioritate mare.",
  },
  astrology: {
    title: "Consultație în carieră",
    body: "Completează formularul scurt și trimitem cererea în CRM pentru consultația de carieră.",
  },
  mistakes: {
    title: "TOP 5 greșeli",
    body: [
      "1. învățarea fără practică reală",
      "2. lipsa de consecvență",
      "3. accentul exclusiv pe gramatică",
      "4. frica de a vorbi",
      "5. lipsa unui plan simplu",
    ].join("\n"),
  },
  career: {
    title: "Engleză pentru carieră",
    body: "Interviuri, emailuri, ședințe, prezentări și comunicare mai sigură la muncă.",
  },
  busy_people: {
    title: "Engleză pentru oameni ocupați",
    body: "Lecții scurte, ritm sustenabil și follow-up clar pentru persoane cu program încărcat.",
  },
} as const;

export const LESSON_SEED_CONTENT = [
  {
    dayNumber: 1,
    key: "free-day-1",
    title: "Lecția 1 - Present Simple",
    messageText: "Urmărește lecția, iar după minimum un minut poți deschide testul scurt pentru Present Simple.",
    mediaType: "video_file",
    mediaUrl: "lesson-1-v2-landscape.mp4",
    cta: [
      { label: UI_LABELS.lessons, action: "lessons" },
      { label: UI_LABELS.wantsCourse, action: "wants_course" },
    ],
  },
  {
    dayNumber: 2,
    key: "free-day-2",
    title: "Lecția 2 - Daily routine",
    messageText: "Lecția a doua consolidează răspunsurile de bază și vocabularul de zi cu zi.",
    mediaType: "video_file",
    mediaUrl: "lesson-2-v2-landscape.mp4",
    cta: [
      { label: UI_LABELS.lessons, action: "lessons" },
      { label: UI_LABELS.wantsCourse, action: "wants_course" },
    ],
  },
  {
    dayNumber: 3,
    key: "free-day-3",
    title: "Lecția 3 - Next step",
    messageText: "Ai ajuns la finalul seriei gratuite. Urmărește lecția și pregătește pasul următor.",
    mediaType: "video_file",
    mediaUrl: "lesson-3-v2-landscape.mp4",
    cta: [
      { label: UI_LABELS.wantsCourse, action: "wants_course" },
      { label: UI_LABELS.askAi, action: "ask_ai" },
    ],
  },
] as const;

export const LESSON_ONE_QUIZ = [
  {
    question: "I ___ coffee every morning.",
    options: ["drink", "drinks", "drinking"],
    correctOptionIndex: 0,
  },
  {
    question: "She ___ in London.",
    options: ["live", "lives", "living"],
    correctOptionIndex: 1,
  },
  {
    question: "We ___ pizza on Friday.",
    options: ["eats", "eat", "eating"],
    correctOptionIndex: 1,
  },
  {
    question: "My brother ___ home at 6 pm.",
    options: ["go", "goes", "going"],
    correctOptionIndex: 1,
  },
  {
    question: "They ___ English very well.",
    options: ["speaks", "speak", "speaking"],
    correctOptionIndex: 1,
  },
  {
    question: "I ___ work on Sunday.",
    options: ["don't", "doesn't", "not"],
    correctOptionIndex: 0,
  },
  {
    question: "She ___ drink coffee.",
    options: ["don't", "doesn't", "not"],
    correctOptionIndex: 1,
  },
  {
    question: "___ you work today?",
    options: ["Do", "Does", "Are"],
    correctOptionIndex: 0,
  },
  {
    question: "___ she speak English?",
    options: ["Do", "Does", "Is"],
    correctOptionIndex: 1,
  },
  {
    question: "We ___ the bus to work.",
    options: ["take", "takes", "taking"],
    correctOptionIndex: 0,
  },
  {
    question: "I ___ bread every day.",
    options: ["buy", "buys", "buying"],
    correctOptionIndex: 0,
  },
  {
    question: "He ___ sport every weekend.",
    options: ["do", "does", "doing"],
    correctOptionIndex: 1,
  },
  {
    question: "She ___ music in the evening.",
    options: ["listen", "listens", "listening"],
    correctOptionIndex: 1,
  },
  {
    question: "___ you live in London?",
    options: ["Do", "Does", "Are"],
    correctOptionIndex: 0,
  },
  {
    question: "They ___ breakfast at 8 am.",
    options: ["eat", "eats", "eating"],
    correctOptionIndex: 0,
  },
] as const;
