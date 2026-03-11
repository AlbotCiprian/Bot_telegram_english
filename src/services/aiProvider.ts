import { config, isConfigured } from "../utils/config.js";

export type SupportedAiProvider = "groq" | "deepseek" | "openrouter";

export type AiApiConfig = {
  provider: SupportedAiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
};

function buildGroqConfig(): AiApiConfig | null {
  const apiKey = isConfigured(config.GROQ_API_KEY) ? config.GROQ_API_KEY : config.AI_API_KEY;
  const model = isConfigured(config.GROQ_MODEL) ? config.GROQ_MODEL : config.AI_MODEL;

  if (!isConfigured(apiKey)) {
    return null;
  }

  return {
    provider: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey,
    model: isConfigured(model) ? model : "llama-3.1-8b-instant",
  };
}

function buildDeepSeekConfig(): AiApiConfig | null {
  const apiKey = isConfigured(config.DEEPSEEK_API_KEY) ? config.DEEPSEEK_API_KEY : config.AI_API_KEY;
  const model = isConfigured(config.DEEPSEEK_MODEL) ? config.DEEPSEEK_MODEL : config.AI_MODEL;

  if (!isConfigured(apiKey)) {
    return null;
  }

  return {
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    apiKey,
    model: isConfigured(model) ? model : "deepseek-chat",
  };
}

function buildOpenRouterConfig(): AiApiConfig | null {
  const apiKey = isConfigured(config.OPENROUTER_API_KEY)
    ? config.OPENROUTER_API_KEY
    : config.AI_API_KEY;
  const model = isConfigured(config.OPENROUTER_MODEL) ? config.OPENROUTER_MODEL : config.AI_MODEL;

  if (!isConfigured(apiKey)) {
    return null;
  }

  return {
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey,
    model: isConfigured(model) ? model : "openrouter/auto",
    headers: {
      "X-Title": "Allengual Telegram Bot",
    },
  };
}

export function resolveAiApiConfig(): AiApiConfig | null {
  switch (config.AI_PROVIDER) {
    case "groq":
      return buildGroqConfig();
    case "deepseek":
      return buildDeepSeekConfig();
    case "openrouter":
      return buildOpenRouterConfig();
    case "none":
      return null;
    case "auto":
    default:
      return buildGroqConfig() ?? buildDeepSeekConfig() ?? buildOpenRouterConfig();
  }
}
