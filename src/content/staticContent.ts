export const BRANDING = {
  schoolName: "Express English Academy",
  websiteUrl: "https://www.expres.allengual.md/",
  consultationUrl: "https://www.expres.allengual.md/",
  accentLine:
    "Academia care te ajuta sa treci de la nesiguranta la engleza vorbita liber si folosita pentru crestere profesionala.",
};

export const SERVICE_VIDEO_FILES = {
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
    label: "🎓 Incearca 3 zile gratuite de engleza dupa metoda noastra",
  },
  {
    key: "fear_speaking",
    label: "🗣️ Cum scap de frica de vorbire in engleza",
  },
  {
    key: "teaching_method",
    label: "🎥 Metoda de predare",
  },
  {
    key: "about_academy",
    label: "🏛️ Despre academie",
  },
  {
    key: "services",
    label: "💼 Servicii",
  },
  {
    key: "operator",
    label: "📞 Ia legatura cu operatorul",
  },
  {
    key: "career_astrology",
    label: "🔮 Consultatie astrologica de cariera",
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
    label: "🤖 Intreaba AI-ul nostru",
  },
] as const;

export type PublicEntryKey = (typeof PUBLIC_ENTRY_MENU)[number]["key"];

export const PUBLIC_ENTRY_LABELS: Record<PublicEntryKey, string> = Object.fromEntries(
  PUBLIC_ENTRY_MENU.map((item) => [item.key, item.label]),
) as Record<PublicEntryKey, string>;

export const STATIC_PAGES = {
  welcome: {
    title: "Buna, bine ai venit la Express English Academy",
    body: "Unica academie care te ajuta sa vorbesti engleza liber, cu incredere si cu rezultat real.",
  },
  academy: {
    title: "Despre academie",
    body: [
      "Express English Academy este construita pentru oameni care vor sa vorbeasca engleza clar, cu incredere si cu rezultat real in viata profesionala.",
      "",
      "Accentul este pe vorbire, claritate, exercitiu aplicat si progres sustenabil.",
    ].join("\n"),
  },
  programs: {
    title: "Servicii si preturi",
    body: [
      "Aici ai informatia confirmata despre programe si preturi:",
      "",
      "*Basic - Engleza pentru supravietuire* - 250 EUR",
      "- 20-25 de lectii inregistrate cu durata de 5-20 minute",
      "- 7 intalniri de grup, 1 pe saptamana, cu Victoria Cosovan",
      "- Workbook cu exercitii",
      "- Chat suport pentru intrebari",
      "- Video conversationale",
      "- Diploma de confirmare a nivelului A2",
      "- Acces 6 luni",
      "",
      "*Medium - Engleza pentru putere si curaj* - 350 EUR",
      "- 20-25 de lectii inregistrate cu durata de 5-20 minute",
      "- 7 intalniri de grup, 1 pe saptamana, cu Victoria Cosovan",
      "- Workbook, chat suport si video conversationale",
      "- Diploma de confirmare a nivelului B1",
      "- Acces 6 luni",
      "",
      "*Advanced - Engleza pentru statut si influenta* - 400 EUR",
      "- 20-25 de lectii inregistrate cu durata de 5-20 minute",
      "- 7 intalniri de grup, 1 pe saptamana, cu Victoria Cosovan",
      "- Workbook, chat suport si video conversationale",
      "- Diploma de confirmare a nivelului B2",
      "- Acces 6 luni",
      "",
      "*Basic + Medium* - 550 EUR in loc de 600 EUR",
      "- traseu complet de la baza pana la vorbire cu incredere",
      "- pentru cei care vor progres logic, fara stres si fara ani de blocaj",
    ].join("\n"),
  },
  method: {
    title: "Metoda de predare",
    body: [
      "Metoda noastra este construita pentru oameni ocupati care vor sa vorbeasca, nu doar sa memoreze.",
      "",
      "- pasi clari si lectii scurte",
      "- accent pe vorbire reala si incredere",
      "- progres usor de urmarit",
      "- ritm sustenabil, fara teorie inutila",
    ].join("\n"),
  },
  fear_speaking: {
    title: "Cum scap de frica de vorbire in engleza",
    body: [
      "Frica de vorbire apare cel mai des din lipsa de practica, teama de greseala si lipsa unui cadru simplu.",
      "",
      "Webinarul nostru te ajuta sa intelegi cum spargi blocajul si cum incepi sa vorbesti cu mai multa siguranta.",
    ].join("\n"),
  },
  website: {
    title: "Servicii",
    body: `Deschide site-ul oficial pentru toate detaliile: ${BRANDING.websiteUrl}`,
  },
  operator: {
    title: "Ia legatura cu operatorul",
    body: "Daca vrei ghidare rapida, apasa butonul de mai jos si te conectam cu operatorul.",
  },
  astrology: {
    title: "Consultatie astrologica de cariera",
    body:
      "Daca vrei o discutie dedicata despre directia ta profesionala si cum poate engleza sa te ajute, poti deschide consultatia din linkul configurat.",
  },
  mistakes: {
    title: "TOP 5 greseli",
    body: [
      "Cele mai frecvente blocaje sunt:",
      "1. invatarea fara practica reala",
      "2. lipsa de consecventa",
      "3. accentul exclusiv pe gramatica",
      "4. frica de a vorbi",
      "5. lipsa unui plan simplu de progres",
    ].join("\n"),
  },
  career: {
    title: "Engleza pentru cariera",
    body: "Cursurile sunt gandite si pentru interviuri, emailuri, sedinte, prezentari si comunicare mai sigura.",
  },
  busy_people: {
    title: "Engleza pentru oameni ocupati",
    body: "Lectii scurte, follow-up automat si ritm sustenabil pentru persoane cu program incarcat.",
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
      { label: "🤖 Intreaba AI-ul nostru", action: "ask_ai" },
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
