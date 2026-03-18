import { config } from "../utils/config.js";

export type MarathonPackageKey = "basic" | "silver" | "gold" | "premium" | "vip";

export type MarathonOffer = {
  index: number;
  cohortLabel: string;
  priceLabel: string;
};

export type MarathonPackage = {
  key: MarathonPackageKey;
  label: string;
  title: string;
  details: string[];
  availableOffers: MarathonOffer[];
};

type MarathonPackageDefinition = {
  key: MarathonPackageKey;
  label: string;
  title: string;
  details: string[];
  configuredPrices: string;
  legacyPrices: string;
};

const DEFAULT_COHORT_OPTIONS = ["29 martie", "5 aprilie", "10 aprilie"];

const DEFAULT_PRICE_MAP: Record<MarathonPackageKey, string[]> = {
  basic: ["89 eur", "109 eur", "129 eur"],
  silver: ["129 eur", "149 eur", "169 eur"],
  gold: ["189 eur", "209 eur", "229 eur"],
  premium: ["260 eur", "280 eur", "300 eur"],
  vip: ["510 eur", "600 eur"],
};

const MARATHON_PACKAGE_DEFINITIONS: MarathonPackageDefinition[] = [
  {
    key: "basic",
    label: "🔹 Basic",
    title: "Basic",
    details: ["acces complet la maraton (21 lectii + exercitii interactive)"],
    configuredPrices: config.MARATHON_BASIC_PRICES,
    legacyPrices: config.MARATHON_BASIC_PRICE,
  },
  {
    key: "silver",
    label: "🔘 Silver",
    title: "Silver",
    details: [
      "acces complet la maraton (21 lectii + exercitii interactive)",
      "meditatie audio cu afirmatii pozitive in limba engleza",
      "acces la chat suport cu Victoria",
    ],
    configuredPrices: config.MARATHON_SILVER_PRICES,
    legacyPrices: config.MARATHON_SILVER_PRICE,
  },
  {
    key: "gold",
    label: "🔸 Gold",
    title: "Gold",
    details: [
      "acces complet la maraton (21 lectii + exercitii interactive)",
      "meditatie audio cu afirmatii pozitive in limba engleza",
      "chat suport cu Victoria",
      "consultanta astrologica EXPRESS de cariera",
    ],
    configuredPrices: config.MARATHON_GOLD_PRICES,
    legacyPrices: config.MARATHON_GOLD_PRICE,
  },
  {
    key: "premium",
    label: "🔺 Premium",
    title: "Premium",
    details: [
      "tot ce include Gold",
      'acces la webinar LIVE din 21 aprilie: "Cum a construit un imperiu educational de la credite"',
    ],
    configuredPrices: config.MARATHON_PREMIUM_PRICES,
    legacyPrices: config.MARATHON_PREMIUM_PRICE,
  },
  {
    key: "vip",
    label: "🟤 VIP - 5 locuri",
    title: "VIP - 5 locuri",
    details: [
      "tot ce include Premium",
      "consultanta individuala 1 la 1 cu Victoria",
    ],
    configuredPrices: config.MARATHON_VIP_PRICES,
    legacyPrices: config.MARATHON_VIP_PRICE,
  },
];

function splitConfiguredValues(value: string): string[] {
  return value
    .split(/\s*\|\s*|\s*\/\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveCohortOptions(): string[] {
  const configured = splitConfiguredValues(config.MARATHON_COHORT_OPTIONS);
  if (configured.length > 0) {
    return configured;
  }

  const legacyCandidates = [
    config.MARATHON_BASIC_TERM,
    config.MARATHON_SILVER_TERM,
    config.MARATHON_GOLD_TERM,
    config.MARATHON_PREMIUM_TERM,
    config.MARATHON_VIP_TERM,
  ];

  for (const candidate of legacyCandidates) {
    const parsed = splitConfiguredValues(candidate);
    if (parsed.length > 0) {
      return parsed;
    }
  }

  return DEFAULT_COHORT_OPTIONS;
}

function resolvePriceOptions(definition: MarathonPackageDefinition): string[] {
  const configured = splitConfiguredValues(definition.configuredPrices);
  if (configured.length > 0) {
    return configured;
  }

  const legacy = splitConfiguredValues(definition.legacyPrices);
  if (legacy.length > 0) {
    return legacy;
  }

  return DEFAULT_PRICE_MAP[definition.key];
}

export function isMarathonPackageKey(value: string): value is MarathonPackageKey {
  return MARATHON_PACKAGE_DEFINITIONS.some((definition) => definition.key === value);
}

export function getMarathonPackageCatalog(): MarathonPackage[] {
  const cohortOptions = resolveCohortOptions();

  return MARATHON_PACKAGE_DEFINITIONS.map((definition) => {
    const priceOptions = resolvePriceOptions(definition);
    const availableOffers = cohortOptions
      .map((cohortLabel, index) => {
        const priceLabel = priceOptions[index];
        if (!priceLabel) {
          return null;
        }

        return {
          index,
          cohortLabel,
          priceLabel,
        };
      })
      .filter((offer): offer is MarathonOffer => Boolean(offer));

    return {
      key: definition.key,
      label: definition.label,
      title: definition.title,
      details: definition.details,
      availableOffers,
    };
  });
}

export function getMarathonPackageByKey(packageKey: MarathonPackageKey): MarathonPackage | null {
  return getMarathonPackageCatalog().find((item) => item.key === packageKey) ?? null;
}

export function getMarathonOffer(packageKey: MarathonPackageKey, offerIndex: number): MarathonOffer | null {
  const marathonPackage = getMarathonPackageByKey(packageKey);
  if (!marathonPackage) {
    return null;
  }

  return marathonPackage.availableOffers.find((offer) => offer.index === offerIndex) ?? null;
}

export function buildMarathonLandingMessage(): string {
  return [
    '*Maratonul "Vorbeste engleza fluent EXPRESS"*',
    "",
    "Program de 21 de zile cu lectii scurte si exercitii interactive.",
    "Alege pachetul potrivit si vezi imediat detaliile, data de start si pretul.",
  ].join("\n");
}

export function buildMarathonPackageMessage(marathonPackage: MarathonPackage): string {
  const lines = [`*${marathonPackage.label}*`, ""];

  for (const detail of marathonPackage.details) {
    lines.push(`- ${detail}`);
  }

  lines.push("");
  lines.push(
    marathonPackage.availableOffers.length > 0
      ? "Alege data de start disponibila pentru acest pachet."
      : "Preturile pentru acest pachet nu sunt configurate inca.",
  );

  return lines.join("\n");
}

export function buildMarathonOfferMessage(marathonPackage: MarathonPackage, offer: MarathonOffer): string {
  return [
    `*${marathonPackage.label}*`,
    "",
    `Data start: ${offer.cohortLabel}`,
    `Pret: ${offer.priceLabel}`,
    "",
    ...marathonPackage.details.map((detail) => `- ${detail}`),
    "",
    "Accesul inclus in acest pachet este valabil 6 luni.",
  ].join("\n");
}
