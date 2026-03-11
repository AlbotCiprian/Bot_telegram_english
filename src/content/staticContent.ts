export const BRANDING = {
  schoolName: "English Express by Allengual",
  websiteUrl: "https://www.expres.allengual.md/",
  consultationUrl: "https://www.expres.allengual.md/",
  accentLine: "Engleza practica pentru oameni ocupati care vor progres real.",
};

export const LEAD_LEVEL_OPTIONS = ["Incepator", "Elementar", "Intermediar", "Nu stiu"] as const;

export const LEAD_GOAL_OPTIONS = [
  "Job / cariera",
  "Calatorii",
  "Studii",
  "Dezvoltare personala",
] as const;

export const MAIN_MENU = [
  {
    key: "free_lessons",
    label: "🎓 Incepe 3 lectii gratuite",
  },
  {
    key: "lessons",
    label: "📚 Lectiile tale",
  },
  {
    key: "programs",
    label: "💶 Programe si preturi",
  },
  {
    key: "ask_ai",
    label: "🤖 Intreaba AI-ul nostru",
  },
  {
    key: "method",
    label: "🧭 Metoda noastra",
  },
  {
    key: "mistakes",
    label: "🚫 TOP 5 greseli",
  },
  {
    key: "career",
    label: "💼 Engleza pentru cariera",
  },
  {
    key: "busy_people",
    label: "⏱️ Engleza pentru oameni ocupati",
  },
  {
    key: "website",
    label: "🌐 Site oficial",
  },
  {
    key: "wants_course",
    label: "📞 Vreau la curs",
  },
] as const;

export const STATIC_PAGES: Record<string, { title: string; body: string }> = {
  welcome: {
    title: "Bine ai venit la English Express",
    body: [
      "English Express by Allengual este un program de limba engleza orientat spre vorbire, progres rapid si claritate pentru oameni ocupati.",
      "",
      "Primeste 3 lectii gratuite de engleza si vezi cat de rapid poti incepe sa vorbesti mai fluent.",
      "",
      "🎓 Lectii video practice",
      "🚀 Metoda simpla",
      "⏱️ Creat pentru oameni ocupati",
    ].join("\n"),
  },
  programs: {
    title: "Programe si preturi",
    body: [
      "Aici ai informatia confirmata despre programe, pachete, abonamente si preturi:",
      "",
      "*Basic - Engleza pentru supravietuire* - 250 EUR",
      "- 20-25 de lectii inregistrate de 5-20 minute",
      "- 7 intalniri de grup, 1 pe saptamana, cu Victoria Cosovan",
      "- Workbook cu exercitii",
      "- Chat suport pentru intrebari",
      "- Video conversationale",
      "- Diploma nivel A2",
      "- Acces 6 luni",
      "",
      "*Medium - Engleza pentru putere si curaj* - 350 EUR",
      "- 20-25 de lectii inregistrate de 5-20 minute",
      "- 7 intalniri de grup, 1 pe saptamana, cu Victoria Cosovan",
      "- Workbook, chat suport si video conversationale",
      "- Diploma nivel B1",
      "- Acces 6 luni",
      "",
      "*Advanced - Engleza pentru statut si influenta* - 400 EUR",
      "- 20-25 de lectii inregistrate de 5-20 minute",
      "- 7 intalniri de grup, 1 pe saptamana, cu Victoria Cosovan",
      "- Workbook, chat suport si video conversationale",
      "- Diploma nivel B2",
      "- Acces 6 luni",
      "",
      "*Basic + Medium* - 550 EUR in loc de 600 EUR",
      "- traseu complet de la baza la vorbire cu incredere",
      "- creat pentru cei care vor progres logic, fara stres",
    ].join("\n"),
  },
  method: {
    title: "Metoda noastra",
    body: [
      "Lucram practic, cu obiective clare si ritm sustenabil.",
      "",
      "- focus pe vorbire, nu pe teorie inutila",
      "- lectii scurte si clare",
      "- progres usor de urmarit",
      "- suport pentru oameni ocupati care vor rezultat real",
    ].join("\n"),
  },
  mistakes: {
    title: "TOP 5 greseli",
    body: [
      "Cele mai frecvente blocaje care tin engleza pe loc sunt:",
      "",
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
      "Pentru situatii profesionale reale:",
      "",
      "- interviuri",
      "- emailuri si sedinte",
      "- prezentari",
      "- incredere in comunicarea profesionala",
      "",
      "Daca vrei, iti aratam si ce program ti se potriveste: Basic, Medium sau Advanced.",
    ].join("\n"),
  },
  busy_people: {
    title: "Engleza pentru oameni ocupati",
    body: [
      "Sistem gandit pentru persoane cu program incarcat:",
      "",
      "- lectii scurte",
      "- pasi clari",
      "- follow-up automat",
      "- ritm sustenabil",
      "",
      "Nu este un curs lung si obositor. Este construit sa poti continua constant.",
    ].join("\n"),
  },
  website: {
    title: "Website",
    body: `Deschide site-ul oficial pentru detalii complete: ${BRANDING.websiteUrl}`,
  },
};

export const LESSON_SEED_CONTENT = [
  {
    dayNumber: 1,
    key: "free-day-1",
    title: "Lectia 1 - Start rapid",
    messageText:
      "In prima lectie intri direct in ritm: expresii simple, pronuntie si incredere pentru primele raspunsuri in engleza.",
    mediaType: "video_file",
    mediaUrl: "Lofi Girl - Snowman (Music Video).mp4",
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
    mediaUrl: "Lofi Girl - Snowman (Music Video).mp4",
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
    mediaUrl: "Lofi Girl - Snowman (Music Video).mp4",
    cta: [
      { label: "📞 Vreau la curs", action: "wants_course" },
      { label: "🤖 Intreaba AI-ul nostru", action: "ask_ai" },
    ],
  },
] as const;
