export const BRANDING = {
  schoolName: "Express English Academy",
  websiteUrl: "https://www.expres.allengual.md/",
  consultationUrl: "https://www.expres.allengual.md/",
  accentLine:
    "Academia care te ajuta sa treci de la nesiguranta la engleza vorbita liber si folosita pentru crestere profesionala.",
};

export const SERVICE_VIDEO_FILES = {
  fearSpeaking: "webinar-fear.mp4",
  teachingMethod: "method.mp4",
  aboutAcademy: "academy.mp4",
} as const;

export const LEAD_LEVEL_OPTIONS = ["Incepator", "Elementar", "Intermediar", "Nu stiu"] as const;

export const LEAD_GOAL_OPTIONS = [
  "Job / cariera",
  "Calatorii",
  "Studii",
  "Dezvoltare personala",
] as const;

export const PUBLIC_ENTRY_MENU = [
  {
    key: "free_lessons",
    label: "🎓 3 zile gratuite",
  },
  {
    key: "marathon",
    label: "🚀 Maraton Engleza",
  },
  {
    key: "fear_speaking",
    label: "🗣️ Webinar: fara frica",
  },
  {
    key: "teaching_method",
    label: "🎥 Metoda noastra",
  },
  {
    key: "services",
    label: "💼 Programe si preturi",
  },
  {
    key: "operator",
    label: "⚡ Contact operator",
  },
  {
    key: "career_astrology",
    label: "🔮 Consultatie cariera",
  },
] as const;

export const MAIN_MENU = [
  {
    key: "lessons",
    label: "📚 Lectiile tale",
  },
  ...PUBLIC_ENTRY_MENU,
  {
    key: "ask_ai",
    label: "🤖 Intreaba AI-ul",
  },
] as const;

export type PublicEntryKey = (typeof PUBLIC_ENTRY_MENU)[number]["key"];

export const PUBLIC_ENTRY_LABELS: Record<PublicEntryKey, string> = Object.fromEntries(
  PUBLIC_ENTRY_MENU.map((item) => [item.key, item.label]),
) as Record<PublicEntryKey, string>;

export const STATIC_PAGES = {
  welcome: {
    title: "Buna, bine ai venit la Express English Academy",
    body:
      "Alege intre 3 lectii gratuite sau Maratonul de 21 de zile si pornim rapid, cu un onboarding scurt si clar.",
  },
  academy: {
    title: "Despre academie",
    body: "Express English Academy este pentru oameni care vor sa vorbeasca engleza clar, aplicat si cu incredere.",
  },
  marathon: {
    title: "Maratonul «Vorbeste engleza fluent EXPRESS»",
    body: [
      "Program intensiv de 21 de zile, cu 21 de lectii scurte de 2-3 minute si exercitii interactive dupa fiecare lectie.",
      "",
      "Potrivit pentru nivelurile 0 - B1 si construit pentru practica zilnica, rezultate rapide si mai multa incredere in vorbire.",
      "",
      "*Pachete disponibile*",
      "🔹 *Basic*",
      "– acces complet la maraton (21 lectii + exercitii interactive)",
      "",
      "🔘 *Silver*",
      "– acces complet la maraton",
      "– meditatie audio cu afirmatii pozitive in engleza",
      "– acces la chat suport cu Victoria",
      "",
      "🔸 *Gold*",
      "– acces complet la maraton",
      "– meditatie audio cu afirmatii pozitive in engleza",
      "– chat suport cu Victoria",
      "– consultanta astrologica EXPRESS de cariera",
      "",
      "🔺 *Premium*",
      "– tot din Gold",
      "– acces la webinar LIVE din 21 aprilie: «Cum a construit un imperiu educational de la credite»",
      "",
      "🟤 *VIP* (doar 5 locuri)",
      "– tot din Premium",
      "– consultanta individuala 1 la 1 cu Victoria",
      "",
      "Accesul la maraton, meditatie si webinar este valabil 6 luni.",
      "Programul incepe dupa 10 aprilie si ruleaza pe parcursul a cateva saptamani.",
      "",
      "Pentru pret, apasa pe butonul de mai jos si iti deschidem imediat cererea in CRM.",
    ].join("\n"),
  },
  programs: {
    title: "Programe si preturi",
    body: [
      "*Basic - Engleza pentru supravietuire* - 250 EUR",
      "*Medium - Engleza pentru putere si curaj* - 350 EUR",
      "*Advanced - Engleza pentru statut si influenta* - 400 EUR",
      "*Basic + Medium* - 550 EUR in loc de 600 EUR",
      "",
      "Deschide site-ul pentru descrierea completa a fiecarui program.",
    ].join("\n"),
  },
  method: {
    title: "Metoda noastra",
    body: "Video scurt despre cum lucram: clar, practic si orientat pe vorbire.",
  },
  fear_speaking: {
    title: "Webinar: cum scapi de frica de vorbire",
    body: "Video despre cum spargi blocajul si incepi sa vorbesti cu mai multa siguranta.",
  },
  website: {
    title: "Site oficial",
    body: `Deschide site-ul oficial pentru toate detaliile: ${BRANDING.websiteUrl}`,
  },
  operator: {
    title: "Contact operator",
    body: "Completeaza formularul scurt si trimitem cererea direct in CRM cu prioritate mare.",
  },
  astrology: {
    title: "Consultatie cariera",
    body: "Completeaza formularul scurt si trimitem cererea in CRM pentru consultatia de cariera.",
  },
  mistakes: {
    title: "TOP 5 greseli",
    body: [
      "1. invatarea fara practica reala",
      "2. lipsa de consecventa",
      "3. accentul exclusiv pe gramatica",
      "4. frica de a vorbi",
      "5. lipsa unui plan simplu",
    ].join("\n"),
  },
  career: {
    title: "Engleza pentru cariera",
    body: "Interviuri, emailuri, sedinte, prezentari si comunicare mai sigura la munca.",
  },
  busy_people: {
    title: "Engleza pentru oameni ocupati",
    body: "Lectii scurte, ritm sustenabil si follow-up clar pentru persoane cu program incarcat.",
  },
} as const;

export const LESSON_SEED_CONTENT = [
  {
    dayNumber: 1,
    key: "free-day-1",
    title: "Lectia 1 - Present Simple",
    messageText: "Urmareste lectia si dupa un minut poti porni testul scurt pentru Present Simple.",
    mediaType: "video_file",
    mediaUrl: "lesson-1.mp4",
    cta: [
      { label: "📚 Lectiile tale", action: "lessons" },
      { label: "📞 Vreau la curs", action: "wants_course" },
    ],
  },
  {
    dayNumber: 2,
    key: "free-day-2",
    title: "Lectia 2 - Daily routine",
    messageText: "Lectia a doua consolideaza raspunsurile de baza si vocabularul de zi cu zi.",
    mediaType: "video_file",
    mediaUrl: "lesson-2.mp4",
    cta: [
      { label: "📚 Lectiile tale", action: "lessons" },
      { label: "📞 Vreau la curs", action: "wants_course" },
    ],
  },
  {
    dayNumber: 3,
    key: "free-day-3",
    title: "Lectia 3 - Next step",
    messageText: "Ai ajuns la finalul seriei gratuite. Urmareste lectia si pregateste pasul urmator.",
    mediaType: "video_file",
    mediaUrl: "lesson-3.mp4",
    cta: [
      { label: "📞 Vreau la curs", action: "wants_course" },
      { label: "🤖 Intreaba AI-ul", action: "ask_ai" },
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
