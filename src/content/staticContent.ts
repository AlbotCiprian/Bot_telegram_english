export const BRANDING = {
  schoolName: "Express English Academy",
  websiteUrl: "https://www.expres.allengual.md/",
  consultationUrl: "https://www.expres.allengual.md/",
  accentLine:
    "Academia care te ajuta sa treci de la nesiguranta la engleza vorbita liber si folosita pentru crestere profesionala.",
};

export const SERVICE_VIDEO_FILES = {
  fearSpeaking: "Webinar_fear_speaking.mp4",
  teachingMethod: "Video_metda_depredare!.mp4",
  aboutAcademy: "",
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
    key: "fear_speaking",
    label: "🗣️ Webinar: fara frica",
  },
  {
    key: "teaching_method",
    label: "🎥 Metoda noastra",
  },
  {
    key: "about_academy",
    label: "🏛️ Despre academie",
  },
  {
    key: "services",
    label: "💼 Programe si preturi",
  },
  {
    key: "operator",
    label: "📞 Vorbeste cu operatorul",
  },
  {
    key: "career_astrology",
    label: "🔮 Consultatie de cariera",
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
    body: "",
  },
  academy: {
    title: "Despre academie",
    body: [
      "Express English Academy este pentru oameni care vor sa vorbeasca engleza clar si cu incredere.",
      "",
      "Lucram practic, cu pasi simpli, continut aplicat si progres real.",
    ].join("\n"),
  },
  programs: {
    title: "Programe si preturi",
    body: [
      "*Basic - Engleza pentru supravietuire* - 250 EUR",
      "- 20-25 de lectii inregistrate",
      "- 7 intalniri de grup cu Victoria Cosovan",
      "- Workbook, chat suport, video conversationale",
      "- Diploma A2, acces 6 luni",
      "",
      "*Medium - Engleza pentru putere si curaj* - 350 EUR",
      "- 20-25 de lectii inregistrate",
      "- 7 intalniri de grup cu Victoria Cosovan",
      "- Workbook, chat suport, video conversationale",
      "- Diploma B1, acces 6 luni",
      "",
      "*Advanced - Engleza pentru statut si influenta* - 400 EUR",
      "- 20-25 de lectii inregistrate",
      "- 7 intalniri de grup cu Victoria Cosovan",
      "- Workbook, chat suport, video conversationale",
      "- Diploma B2, acces 6 luni",
      "",
      "*Basic + Medium* - 550 EUR in loc de 600 EUR",
      "- traseu complet de la baza pana la vorbire cu incredere",
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
    title: "Vorbeste cu operatorul",
    body: "Daca vrei recomandare rapida, intra direct in legatura cu operatorul.",
  },
  astrology: {
    title: "Consultatie de cariera",
    body:
      "Daca vrei o discutie dedicata despre directia ta profesionala, poti deschide consultatia din linkul configurat.",
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
    messageText:
      "In prima lectie intri direct in ritm. Urmareste materialul si apoi rezolva testul scurt pentru Present Simple.",
    mediaType: "video_link",
    mediaUrl: "https://drive.google.com/file/d/18hSQtwISv180c_DZrz09ji7V81dDPqL8/view?usp=drivesdk",
    cta: [
      { label: "📚 Lectiile tale", action: "lessons" },
      { label: "📞 Vreau la curs", action: "wants_course" },
    ],
  },
  {
    dayNumber: 2,
    key: "free-day-2",
    title: "Lectia 2 - Daily routine",
    messageText:
      "Lectia a doua consolideaza raspunsurile de baza si vocabularul de zi cu zi. Se deschide automat dupa 24 de ore.",
    mediaType: "video_link",
    mediaUrl: "https://drive.google.com/file/d/1b40m6Nn7zKknrzMuDiDQRFWogmTz9GhZ/view?usp=drivesdk",
    cta: [
      { label: "📚 Lectiile tale", action: "lessons" },
      { label: "📞 Vreau la curs", action: "wants_course" },
    ],
  },
  {
    dayNumber: 3,
    key: "free-day-3",
    title: "Lectia 3 - Next step",
    messageText:
      "Ai ajuns la finalul seriei gratuite. Urmareste lectia si apoi intra in flow-ul de calificare daca vrei programul complet.",
    mediaType: "video_link",
    mediaUrl: "https://drive.google.com/file/d/14XdideiSad-wIeVOYfLWNHBoU8_GBqVp/view?usp=drivesdk",
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
