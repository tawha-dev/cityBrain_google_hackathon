import { LLM_CONFIG } from './config.js';



export function hasOpenRouter(): boolean {

  return Boolean(process.env.OPENROUTER_API_KEY?.trim());

}



export interface OpenRouterChatMessage {

  role: 'system' | 'user' | 'assistant';

  content: string;

}

type ChatMessage = OpenRouterChatMessage;



function openRouterModels(): string[] {

  return [LLM_CONFIG.openRouterModel, ...LLM_CONFIG.openRouterModelFallbacks].filter(

    (m, i, arr) => m && arr.indexOf(m) === i

  );

}



interface ChatCompletionResult {

  text: string | null;

  model: string;

  status?: number;

  error?: string;

}



async function chatCompletionWithModel(

  model: string,

  messages: ChatMessage[],

  jsonMode: boolean

): Promise<ChatCompletionResult> {

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {

    return { text: null, model, error: 'OPENROUTER_API_KEY not set' };

  }



  const keyHint = apiKey.length > 8 ? `…${apiKey.slice(-6)}` : '(set)';

  console.info(`[openrouter] → POST chat/completions model=${model} key=${keyHint}`);



  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 45_000);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {

    method: 'POST',

    headers: {

      Authorization: `Bearer ${apiKey}`,

      'Content-Type': 'application/json',

      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'http://localhost:4000',

      'X-Title': 'CityBrain AI',

    },

    body: JSON.stringify({

      model,

      messages,

      temperature: 0.2,
      max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS ?? 4096),
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),

    signal: AbortSignal.timeout(timeoutMs),

  });



  if (!res.ok) {

    const err = await res.text().catch(() => '');

    const detail = err.slice(0, 400) || res.statusText;

    console.warn(`[openrouter] ← ${model}: HTTP ${res.status}`, detail.slice(0, 200));

    return { text: null, model, status: res.status, error: detail };

  }



  const data = (await res.json()) as {

    model?: string;

    choices?: Array<{ message?: { content?: string } }>;

  };

  const text = data.choices?.[0]?.message?.content ?? null;

  if (!text) {

    return { text: null, model: data.model ?? model, status: res.status, error: 'empty response' };

  }

  console.info(`[openrouter] ← ${model}: OK (${text.length} chars)`);

  return { text, model: data.model ?? model, status: res.status };

}



async function chatCompletion(messages: ChatMessage[], jsonMode = true): Promise<string | null> {

  for (const model of openRouterModels()) {

    const result = await chatCompletionWithModel(model, messages, jsonMode);

    if (result.text) return result.text;

  }

  return null;

}



export interface OpenRouterProbeResult {

  ok: boolean;

  model?: string;

  latencyMs: number;

  response?: Record<string, unknown>;

  error?: string;

  attempts: Array<{ model: string; ok: boolean; latencyMs: number; error?: string; status?: number }>;

}



export async function probeOpenRouter(prompt: string): Promise<OpenRouterProbeResult> {

  const attempts: OpenRouterProbeResult['attempts'] = [];

  const messages: ChatMessage[] = [

    {

      role: 'user',

      content: `${prompt}\n\nRespond with a single valid JSON object only.`,

    },

  ];



  for (const requestedModel of openRouterModels()) {

    const start = Date.now();

    const result = await chatCompletionWithModel(requestedModel, messages, true);

    const latencyMs = Date.now() - start;



    if (!result.text) {

      attempts.push({

        model: requestedModel,

        ok: false,

        latencyMs,

        status: result.status,

        error: result.error ?? 'request failed or empty response',

      });

      continue;

    }



    try {

      const parsed = JSON.parse(result.text) as Record<string, unknown>;

      attempts.push({ model: requestedModel, ok: true, latencyMs, status: result.status });

      return {

        ok: true,

        model: result.model ?? requestedModel,

        latencyMs,

        response: parsed,

        attempts,

      };

    } catch {

      const match = result.text.match(/\{[\s\S]*\}/);

      if (match) {

        try {

          const parsed = JSON.parse(match[0]) as Record<string, unknown>;

          attempts.push({ model: requestedModel, ok: true, latencyMs, status: result.status });

          return {

            ok: true,

            model: result.model ?? requestedModel,

            latencyMs,

            response: parsed,

            attempts,

          };

        } catch {

          /* fall through */

        }

      }

      attempts.push({

        model: requestedModel,

        ok: false,

        latencyMs,

        status: result.status,

        error: 'invalid JSON in response',

      });

    }

  }



  const last = attempts[attempts.length - 1];

  return {

    ok: false,

    latencyMs: attempts.reduce((sum, a) => sum + a.latencyMs, 0),

    error: last?.error ?? 'all OpenRouter models failed',

    attempts,

  };

}



export async function openRouterJson<T>(prompt: string, system?: string): Promise<T | null> {

  const text = await chatCompletion(

    [

      ...(system ? [{ role: 'system' as const, content: system }] : []),

      { role: 'user', content: `${prompt}\n\nRespond with a single valid JSON object only.` },

    ],

    true

  );

  if (!text) return null;

  try {

    return JSON.parse(text) as T;

  } catch {

    const match = text.match(/\{[\s\S]*\}/);

    if (!match) return null;

    return JSON.parse(match[0]) as T;

  }

}



export async function openRouterStructured<T>(options: {

  systemInstruction: string;

  userPrompt: string;

}): Promise<T | null> {

  return openRouterJson<T>(

    options.userPrompt,

    `${options.systemInstruction}\nOutput valid JSON matching the requested structure.`

  );

}



export type OpenRouterStreamChunk = { delta: string; model?: string };

/** Stream chat completion tokens from OpenRouter (first model that succeeds). */
export async function* openRouterChatStream(
  messages: OpenRouterChatMessage[],
  options?: { jsonMode?: boolean; maxTokens?: number }
): AsyncGenerator<OpenRouterStreamChunk, { text: string; model?: string } | null> {
  const jsonMode = options?.jsonMode ?? false;
  const maxTokens =
    options?.maxTokens ?? Number(process.env.OPENROUTER_SAFETY_MAX_TOKENS ?? 1200);

  for (const model of openRouterModels()) {
    const result = yield* streamChatCompletionWithModel(model, messages, jsonMode, maxTokens);
    if (result) return result;
  }
  return null;
}

async function* streamChatCompletionWithModel(
  model: string,
  messages: ChatMessage[],
  jsonMode: boolean,
  maxTokens: number
): AsyncGenerator<OpenRouterStreamChunk, { text: string; model?: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 45_000);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'http://localhost:4000',
      'X-Title': 'CityBrain AI',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => '');
    console.warn(
      `[openrouter] stream ${model}: HTTP ${res.status}`,
      (err.slice(0, 200) || res.statusText).slice(0, 200)
    );
    return null;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  let fullText = '';
  let resolvedModel = model;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload) as {
            model?: string;
            choices?: Array<{ delta?: { content?: string } }>;
          };
          if (parsed.model) resolvedModel = parsed.model;
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            fullText += delta;
            yield { delta, model: resolvedModel };
          }
        } catch {
          /* ignore malformed SSE chunk */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!fullText) return null;
  console.info(`[openrouter] stream ← ${resolvedModel}: OK (${fullText.length} chars)`);
  return { text: fullText, model: resolvedModel };
}

export async function openRouterChat(

  messages: OpenRouterChatMessage[],

  options?: { jsonMode?: boolean }

): Promise<{ text: string | null; model?: string }> {

  const jsonMode = options?.jsonMode ?? false;

  for (const model of openRouterModels()) {

    const result = await chatCompletionWithModel(model, messages, jsonMode);

    if (result.text) {

      return { text: result.text, model: result.model };

    }

  }

  return { text: null };

}



export function parseOpenRouterJson<T>(text: string): T | null {

  try {

    return JSON.parse(text) as T;

  } catch {

    const match = text.match(/\{[\s\S]*\}/);

    if (!match) return null;

    try {

      return JSON.parse(match[0]) as T;

    } catch {

      return null;

    }

  }

}


