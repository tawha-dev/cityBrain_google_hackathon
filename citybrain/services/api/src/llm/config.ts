/**
 * LLM provider config — override via .env (see .env.example).
 * Default: OpenRouter free tier (no Gemini quota limits).
 */
export const LLM_CONFIG = {
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview',
  geminiModelFallback: process.env.GEMINI_MODEL_FALLBACK ?? 'gemini-2.5-flash',
  /** Primary OpenRouter model */
  openRouterModel: process.env.OPENROUTER_MODEL ?? 'nvidia/nemotron-3-super-120b-a12b:free',
  /** Comma-separated fallbacks when primary is rate-limited */
  openRouterModelFallbacks: (
    process.env.OPENROUTER_MODEL_FALLBACK ??
    'openai/gpt-oss-120b:free,minimax/minimax-m2.5:free,deepseek/deepseek-v4-flash:free,google/gemma-4-31b-it:free'
  )
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),
  /** auto | gemini | openrouter — auto tries OpenRouter first, then Gemini */
  provider: (process.env.AI_PROVIDER ?? 'auto').toLowerCase() as
    | 'auto'
    | 'gemini'
    | 'openrouter',
} as const;

export function llmStatus() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    provider: LLM_CONFIG.provider,
    geminiModel: LLM_CONFIG.geminiModel,
    geminiModelFallback: LLM_CONFIG.geminiModelFallback,
    openRouterModel: LLM_CONFIG.openRouterModel,
    openRouterModelFallbacks: LLM_CONFIG.openRouterModelFallbacks,
    openweather: Boolean(process.env.OPENWEATHER_API_KEY),
    news: Boolean(process.env.NEWS_API_KEY),
    googleMaps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    socialVerify: Boolean(process.env.NEWS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
  };
}
