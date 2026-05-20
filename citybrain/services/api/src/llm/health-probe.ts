import { LLM_CONFIG, llmStatus } from './config.js';
import { hasGemini, hasLlm } from './provider.js';
import { probeOpenRouter } from './openrouter.js';

const PROBE_PROMPT =
  'Reply with JSON only: {"ping":"pong","provider":"citybrain","ok":true}';

export interface LlmProbeAttempt {
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface LlmProbeResult {
  ok: boolean;
  provider: 'openrouter' | 'gemini' | 'none';
  model?: string;
  latencyMs: number;
  response?: Record<string, unknown>;
  error?: string;
  config: ReturnType<typeof llmStatus>;
  attempts?: LlmProbeAttempt[];
}

async function probeGemini(): Promise<{
  ok: boolean;
  model?: string;
  latencyMs: number;
  response?: Record<string, unknown>;
  error?: string;
  attempts: LlmProbeAttempt[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  const attempts: LlmProbeAttempt[] = [];
  if (!apiKey) {
    return { ok: false, latencyMs: 0, error: 'GEMINI_API_KEY not set', attempts };
  }

  const models = [LLM_CONFIG.geminiModel, LLM_CONFIG.geminiModelFallback].filter(
    (m, i, arr) => arr.indexOf(m) === i
  );

  for (const model of models) {
    const start = Date.now();
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const ai = new GoogleGenerativeAI(apiKey);
      const m = ai.getGenerativeModel({
        model,
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      });
      const result = await m.generateContent(PROBE_PROMPT);
      const text = result.response.text();
      const latencyMs = Date.now() - start;
      if (!text) {
        attempts.push({ model, ok: false, latencyMs, error: 'empty response' });
        continue;
      }
      const parsed = JSON.parse(text) as Record<string, unknown>;
      attempts.push({ model, ok: true, latencyMs });
      return { ok: true, model, latencyMs, response: parsed, attempts };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ model, ok: false, latencyMs, error: message });
    }
  }

  const last = attempts[attempts.length - 1];
  return {
    ok: false,
    latencyMs: attempts.reduce((sum, a) => sum + a.latencyMs, 0),
    error: last?.error ?? 'all Gemini models failed',
    attempts,
  };
}

export async function probeLlm(): Promise<LlmProbeResult> {
  const config = llmStatus();
  const started = Date.now();
  const allAttempts: LlmProbeAttempt[] = [];

  if (!hasLlm()) {
    return {
      ok: false,
      provider: 'none',
      latencyMs: Date.now() - started,
      error: 'No LLM configured — set OPENROUTER_API_KEY or GEMINI_API_KEY',
      config,
    };
  }

  const tryOpenRouter =
    LLM_CONFIG.provider === 'openrouter' ||
    (LLM_CONFIG.provider === 'auto' && Boolean(process.env.OPENROUTER_API_KEY));

  const tryGemini =
    LLM_CONFIG.provider === 'gemini' ||
    (LLM_CONFIG.provider === 'auto' && hasGemini());

  let orError: string | undefined;

  if (tryOpenRouter && process.env.OPENROUTER_API_KEY) {
    const or = await probeOpenRouter(PROBE_PROMPT);
    if (or.attempts?.length) allAttempts.push(...or.attempts);
    if (or.ok) {
      return {
        ok: true,
        provider: 'openrouter',
        model: or.model,
        latencyMs: Date.now() - started,
        response: or.response,
        config,
        attempts: allAttempts,
      };
    }
    orError = or.error;
    if (LLM_CONFIG.provider === 'openrouter') {
      return {
        ok: false,
        provider: 'openrouter',
        latencyMs: Date.now() - started,
        error: or.error,
        config,
        attempts: allAttempts,
      };
    }
  }

  if (tryGemini) {
    const gem = await probeGemini();
    allAttempts.push(...gem.attempts);
    if (gem.ok) {
      return {
        ok: true,
        provider: 'gemini',
        model: gem.model,
        latencyMs: Date.now() - started,
        response: gem.response,
        config,
        attempts: allAttempts,
      };
    }
    return {
      ok: false,
      provider: 'none',
      latencyMs: Date.now() - started,
      error:
        LLM_CONFIG.provider === 'auto' && orError
          ? `OpenRouter failed (${orError}); Gemini failed (${gem.error ?? 'unknown'})`
          : gem.error,
      config,
      attempts: allAttempts,
    };
  }

  return {
    ok: false,
    provider: 'none',
    latencyMs: Date.now() - started,
    error: orError ?? 'LLM probe failed for configured provider',
    config,
    attempts: allAttempts.length ? allAttempts : undefined,
  };
}
