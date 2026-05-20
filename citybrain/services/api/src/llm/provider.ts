import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLM_CONFIG } from './config.js';
import { hasOpenRouter, openRouterJson, openRouterStructured } from './openrouter.js';
import type { StructuredGenerateOptions } from './provider-types.js';

export type { StructuredGenerateOptions };

export function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function hasLlm(): boolean {
  if (LLM_CONFIG.provider === 'gemini') return hasGemini();
  if (LLM_CONFIG.provider === 'openrouter') return hasOpenRouter();
  return hasGemini() || hasOpenRouter();
}

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return geminiClient;
}

async function geminiGenerateJson<T>(prompt: string, model: string): Promise<T | null> {
  const ai = getGeminiClient();
  if (!ai) return null;
  try {
    const m = ai.getGenerativeModel({
      model,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    const result = await m.generateContent(prompt);
    const text = result.response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn(`[gemini] ${model}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function geminiStructured<T>(options: {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: object;
  model: string;
}): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const m = ai.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: options.responseSchema as any,
        temperature: 0.2,
      },
    });
    const result = await m.generateContent(options.userPrompt);
    const text = result.response.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn(`[gemini-structured] ${options.model}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function withGeminiModels<T>(fn: (model: string) => Promise<T | null>): Promise<T | null> {
  const models = [LLM_CONFIG.geminiModel, LLM_CONFIG.geminiModelFallback].filter(
    (m, i, arr) => arr.indexOf(m) === i
  );
  for (const model of models) {
    const result = await fn(model);
    if (result !== null) return result;
  }
  return null;
}

async function tryGeminiJson<T>(prompt: string, model?: string): Promise<T | null> {
  if (!hasGemini()) return null;
  if (model) return geminiGenerateJson<T>(prompt, model);
  return withGeminiModels((m) => geminiGenerateJson<T>(prompt, m));
}

async function tryGeminiStructured<T>(options: StructuredGenerateOptions): Promise<T | null> {
  if (!hasGemini()) return null;
  const run = (model: string) =>
    geminiStructured<T>({
      ...options,
      model,
    });
  if (options.model) return run(options.model);
  return withGeminiModels(run);
}

/** auto: OpenRouter → Gemini; openrouter/gemini: single provider only */
export async function generateJson<T>(prompt: string, model?: string): Promise<T | null> {
  if (LLM_CONFIG.provider === 'openrouter') {
    return hasOpenRouter() ? openRouterJson<T>(prompt) : null;
  }
  if (LLM_CONFIG.provider === 'gemini') {
    return tryGeminiJson<T>(prompt, model);
  }
  // auto — OpenRouter first (avoids Gemini quota when OR is available)
  if (hasOpenRouter()) {
    const or = await openRouterJson<T>(prompt);
    if (or !== null) return or;
  }
  return tryGeminiJson<T>(prompt, model);
}

export async function generateStructuredJson<T>(
  options: StructuredGenerateOptions
): Promise<T | null> {
  if (LLM_CONFIG.provider === 'openrouter') {
    return hasOpenRouter()
      ? openRouterStructured<T>({
          systemInstruction: options.systemInstruction,
          userPrompt: options.userPrompt,
        })
      : null;
  }
  if (LLM_CONFIG.provider === 'gemini') {
    return tryGeminiStructured<T>(options);
  }
  // auto — OpenRouter first
  if (hasOpenRouter()) {
    const or = await openRouterStructured<T>({
      systemInstruction: options.systemInstruction,
      userPrompt: options.userPrompt,
    });
    if (or !== null) return or;
  }
  return tryGeminiStructured<T>(options);
}

export { SchemaType } from '@google/generative-ai';
