import { BRANDING, STATIC_PAGES } from "../content/staticContent.js";
import { logger } from "../utils/logger.js";
import { resolveAiApiConfig } from "./aiProvider.js";
import { searchRelevantDocuments } from "./vectorService.js";

type AiAnswer = {
  answer: string;
  usedFallback: boolean;
  sources: string[];
};

function sanitizeAiAnswer(answer: string): string {
  return answer
    .replace(/\[Context\s*\d+\]\s*/gi, "")
    .replace(/\bContextul\s*\d+\b/gi, "informatiile disponibile")
    .replace(/\bContext\s*\d+\b/gi, "informatiile disponibile")
    .replace(/informatiile confirmate din\s*\./gi, "informatiile confirmate din sectiunea Programe si preturi.")
    .trim();
}

function isPricingQuestion(question: string): boolean {
  return /(pret|preturi|costa|cost|abonament|abonamente|program|programe|pachet|pachete|oferta|oferte|basic|medium|advanced|eur|euro)/i.test(
    question,
  );
}

function isSchoolOverviewQuestion(question: string): boolean {
  return /(scoala|allengual|english express|cine sunteti|ce este|despre voi|despre scoala|metoda voastra|cum functioneaza)/i.test(
    question,
  );
}

function hasPricingContext(context: string): boolean {
  return /(250 eur|350 eur|400 eur|550 eur|basic|medium|advanced|pret|preturi|programe|pachete|abonamente|oferta|oferte)/i.test(
    context,
  );
}

function buildKnowledgeContext(question: string, dynamicContext: string): { context: string; sources: string[] } {
  const parts: string[] = [];
  const sources: string[] = [];

  if (dynamicContext.trim().length > 0) {
    parts.push(dynamicContext);
  }

  if (isPricingQuestion(question)) {
    parts.push(`[Context suplimentar] ${STATIC_PAGES.programs.title}\n${STATIC_PAGES.programs.body}`);
    sources.push(`${BRANDING.websiteUrl}#programs`);
  }

  if (isSchoolOverviewQuestion(question)) {
    parts.push(`[Context suplimentar] ${STATIC_PAGES.welcome.title}\n${STATIC_PAGES.welcome.body}`);
    sources.push(`${BRANDING.websiteUrl}#welcome`);
    parts.push(`[Context suplimentar] ${STATIC_PAGES.method.title}\n${STATIC_PAGES.method.body}`);
    sources.push(`${BRANDING.websiteUrl}#method`);
  }

  return {
    context: parts.join("\n\n"),
    sources,
  };
}

function buildFallbackAnswer(question: string, context: string[], sources: string[]): AiAnswer {
  if (context.length === 0) {
    return {
      answer:
        "Nu am gasit suficient context in baza de cunostinte. Daca vrei, apasa pe Vreau la curs sau cere o consultatie pentru un raspuns mai exact.",
      usedFallback: true,
      sources,
    };
  }

  return {
    answer: [
      `Am gasit cateva informatii relevante pentru intrebarea: "${question}".`,
      "",
      context.slice(0, 2).join("\n\n"),
      "",
      "Daca vrei un raspuns personalizat pentru situatia ta, intra in flow-ul Vreau la curs.",
      "",
      `Surse utile:\n${sources.slice(0, 3).join("\n")}`,
    ].join("\n"),
    usedFallback: true,
    sources,
  };
}

export async function answerQuestion(question: string): Promise<AiAnswer> {
  const rawDocuments = await searchRelevantDocuments(question, 8);
  const curatedDocuments = rawDocuments.filter((item) => item.source === "curated_content");
  const otherDocuments = rawDocuments.filter((item) => item.source !== "curated_content");
  const pricingProgramsUrl = `${BRANDING.websiteUrl}#programs`;
  const welcomeUrl = `${BRANDING.websiteUrl}#welcome`;
  const documents = [...curatedDocuments, ...otherDocuments]
    .sort((left, right) => {
      const leftPriority = isPricingQuestion(question) && left.url === pricingProgramsUrl ? 1 : 0;
      const rightPriority = isPricingQuestion(question) && right.url === pricingProgramsUrl ? 1 : 0;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      const leftSchoolPriority = isSchoolOverviewQuestion(question) && left.url === welcomeUrl ? 1 : 0;
      const rightSchoolPriority = isSchoolOverviewQuestion(question) && right.url === welcomeUrl ? 1 : 0;

      if (leftSchoolPriority !== rightSchoolPriority) {
        return rightSchoolPriority - leftSchoolPriority;
      }

      return right.score - left.score;
    })
    .slice(0, 5);
  const sources = [...new Set(documents.map((item) => item.url))];
  const topScore = documents[0]?.score ?? 0;
  const minScore = isSchoolOverviewQuestion(question) ? 0.08 : 0.15;
  const dynamicContext = documents
    .map(
      (item, index) =>
        `[Context ${index + 1}] ${item.title ?? item.url}\n${item.content.slice(0, 1200)}`,
    )
    .join("\n\n");
  const supplementalContext = buildKnowledgeContext(question, dynamicContext);
  const mergedSources = [...new Set([...sources, ...supplementalContext.sources])];

  if (documents.length === 0 || topScore < minScore) {
    if (supplementalContext.context.trim().length > 0) {
      return buildFallbackAnswer(question, supplementalContext.context.split("\n\n").slice(0, 4), mergedSources);
    }

    return buildFallbackAnswer(question, [], mergedSources);
  }
  const context = supplementalContext.context;

  if (isPricingQuestion(question) && !hasPricingContext(context)) {
    return buildFallbackAnswer(question, [], mergedSources);
  }

  const aiConfig = resolveAiApiConfig();

  if (!aiConfig) {
    return buildFallbackAnswer(
      question,
      documents.map((item) => item.content.slice(0, 320)),
      sources,
    );
  }

  try {
    const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.apiKey}`,
        ...aiConfig.headers,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are the AI assistant for English Express by Allengual. Answer only from the provided knowledge base. Never invent prices, packages, lesson counts, currencies, schedules or subscription names. If exact data is not in the knowledge base, say you do not have confirmed information and invite the user to request a consultation. Keep answers concise, friendly and professional. Do not mention internal context labels, context numbers or implementation details.",
          },
          {
            role: "user",
            content:
              `Intrebarea utilizatorului: ${question}\n\n` +
              "Daca utilizatorul intreaba despre preturi sau programe, raspunde doar cu datele exacte din context.\n\n" +
              `Knowledge base:\n${context}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { provider: aiConfig.provider, status: response.status, errorText },
        "AI request esuat.",
      );
      return buildFallbackAnswer(
        question,
        documents.map((item) => item.content.slice(0, 320)),
        mergedSources,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return buildFallbackAnswer(
        question,
        documents.map((item) => item.content.slice(0, 320)),
        sources,
      );
    }

    return {
      answer: `${sanitizeAiAnswer(content)}\n\nSurse utile:\n${mergedSources.slice(0, 3).join("\n")}`,
      usedFallback: false,
      sources: mergedSources,
    };
  } catch (error) {
    logger.error({ provider: aiConfig.provider, err: error }, "AI request a aruncat exceptie.");
    return buildFallbackAnswer(
      question,
      documents.map((item) => item.content.slice(0, 320)),
      mergedSources,
    );
  }
}
