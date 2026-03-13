export const BRANDING = {
  schoolName: "Express English Academy",
  websiteUrl: "https://www.expres.allengual.md/",
  consultationUrl: "https://www.expres.allengual.md/",
  accentLine:
    "Academia care te ajuta sa treci de la nesiguranta la engleza vorbita liber si folosita pentru crestere profesionala.",
};

export const TEMP_SHARED_VIDEO_FILE = "Lofi Girl - Snowman (Music Video).mp4";

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
    body: [
      "Unica academie care te transforma dintr-o persoana nesigura pe sine intr-o persoana care vorbeste liber engleza si face bani datorita ei.",
      "",
      "Alege din meniul de mai jos serviciul de care ai nevoie:",
      "",
      "1. Cum scap de frica de vorbire in engleza (link webinar)",
      "2. Metoda de predare (video)",
      "3. Despre academie (video)",
      "4. Servicii (website)",
      "5. Incearca 3 zile gratuite de engleza dupa metoda noastra",
      "6. Ia legatura cu operatorul",
      "7. Consultatie astrologica de cariera",
    ].join("\n"),
  },
  academy: {
    title: "Despre academie",
    body: [
      "Express English Academy este construita pentru oameni care vor sa vorbeasca engleza clar, cu incredere si cu rezultat real in viata profesionala.",
      "",
      "Accentul este pe vorbire, claritate, exercitiu aplicat si progres sustenabil.",
      "",
      "Scopul nu este doar sa inveti reguli, ci sa poti comunica liber si sa transformi engleza intr-un avantaj real.",
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
    body: [
      "Daca vrei ghidare rapida, apasa pe butonul de mai jos si te conectam cu operatorul sau intri direct in flow-ul de calificare.",
    ].join("\n"),
  },
  astrology: {
    title: "Consultatie astrologica de cariera",
    body: [
      "Daca vrei o discutie dedicata despre directia ta profesionala si cum poate engleza sa te ajute, poti deschide consultatia astrologica de cariera din linkul configurat.",
    ].join("\n"),
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
    body: [
      "Cursurile sunt gandite si pentru situatii profesionale reale: interviuri, emailuri, sedinte, prezentari si comunicare mai sigura.",
    ].join("\n"),
  },
  busy_people: {
    title: "Engleza pentru oameni ocupati",
    body: [
      "Lectii scurte, follow-up automat si ritm sustenabil pentru persoane cu program incarcat.",
    ].join("\n"),
  },
} as const;

export const LESSON_SEED_CONTENT = [
  {
    dayNumber: 1,
    key: "free-day-1",
    title: "Lectia 1 - Start rapid",
    messageText:
      "In prima lectie intri direct in ritm: expresii simple, pronuntie si incredere pentru primele raspunsuri in engleza.",
    mediaType: "video_file",
    mediaUrl: TEMP_SHARED_VIDEO_FILE,
    cta: [
      { label: "📞 Vreau la curs", action: "wants_course" },
      { label: "📚 Lectiile tale", action: "lessons" },
    ],
  },
  {
    dayNumber: 2,
    key: "free-day-2",
    title: "Lectia 2 - Engleza de zi cu zi",
    messageText:
      "Astazi consolidam raspunsurile de baza si fluiditatea. Scopul este sa simti progres clar, nu informatie fara context.",
    mediaType: "video_file",
    mediaUrl: TEMP_SHARED_VIDEO_FILE,
    cta: [
      { label: "📚 Lectiile tale", action: "lessons" },
      { label: "📞 Vreau la curs", action: "wants_course" },
    ],
  },
  {
    dayNumber: 3,
    key: "free-day-3",
    title: "Lectia 3 - Urmatorul pas",
    messageText:
      "Ai ajuns la finalul seriei gratuite. Daca vrei un plan aplicat pentru obiectivul tau, intra in flow-ul de calificare si iti pregatim urmatorul pas.",
    mediaType: "video_file",
    mediaUrl: TEMP_SHARED_VIDEO_FILE,
    cta: [
      { label: "📞 Vreau la curs", action: "wants_course" },
      { label: "🤖 Intreaba AI-ul nostru", action: "ask_ai" },
    ],
  },
] as const;
