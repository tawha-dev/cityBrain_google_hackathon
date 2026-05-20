import {
  hasOpenRouter,
  openRouterChat,
  openRouterChatStream,
  parseOpenRouterJson,
  type OpenRouterChatMessage,
} from '../../llm/openrouter.js';

export interface SafetyChatInputMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SafetyChatResult {
  reply: string;
  tips: string[];
  /** Arabic-script Urdu for TTS when reply is Roman Urdu or English */
  replyUr?: string;
  tipsUr?: string[];
  model?: string;
}

interface LlmSafetyResponse {
  reply?: string;
  tips?: string[];
  replyUr?: string;
  tipsUr?: string[];
}

const SYSTEM_PROMPT = `You are CityBrain's emergency safety advisor for citizens in Pakistan.
The user describes an emergency or hazardous situation. Give calm, practical safety guidance they can follow immediately.

Rules:
- Reply in the same language the user uses (English, Urdu, or Roman Urdu).
- In "reply": a short empathetic summary (2-4 sentences) in the user's language (shown on screen).
- In "tips": 3 to 6 bullet-style actionable safety steps in the user's language.
- When the user's latest message is in Urdu or Roman Urdu, also provide "replyUr" and "tipsUr" in Arabic script (اردو) for text-to-speech.
- When the user's latest message is in English only, omit replyUr and tipsUr (use empty string and empty array).
- If reply is already in Arabic Urdu, replyUr can match reply; tipsUr must match tips in Arabic script.
- Tailor advice to the specific hazard (flood, fire, earthquake, heavy rain, accident scene, etc.).
- Never claim rescue units are dispatched, authorities notified, or that you contacted anyone.
- Never give medical diagnosis or legal advice. For life-threatening danger, include "Call 1122 / local emergency number".
- This is general guidance only — tell users to follow official alerts when available.
- If the situation is unclear, ask one brief clarifying question in "reply" and give general safety tips.

Respond with a single JSON object only:
{
  "reply": "string",
  "tips": ["tip 1", "tip 2", "..."],
  "replyUr": "Arabic Urdu when user wrote Urdu/Roman Urdu, else empty string",
  "tipsUr": ["Arabic Urdu tips when user wrote Urdu/Roman Urdu, else []"]
}`;

function sanitizeTips(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim())
    .slice(0, 8);
}

/** Best-effort reply text from a partial JSON stream (json_mode). */
export function extractPartialReplyFromStream(buffer: string): string {
  const match = /"reply"\s*:\s*"/.exec(buffer);
  if (!match) return '';

  let i = match.index + match[0].length;
  let out = '';
  while (i < buffer.length) {
    const c = buffer[i]!;
    if (c === '\\' && i + 1 < buffer.length) {
      const next = buffer[i + 1]!;
      if (next === 'n') out += '\n';
      else if (next === 'r') out += '\r';
      else if (next === 't') out += '\t';
      else if (next === '"') out += '"';
      else if (next === '\\') out += '\\';
      else out += next;
      i += 2;
      continue;
    }
    if (c === '"') break;
    out += c;
    i += 1;
  }
  return out;
}

export type SafetyChatStreamEvent =
  | { type: 'delta'; reply: string }
  | { type: 'done'; result: SafetyChatResult }
  | { type: 'error'; message: string };

function buildSafetyChatResult(
  parsed: LlmSafetyResponse | null,
  model?: string,
  fallbackReply?: string
): SafetyChatResult {
  if (!parsed?.reply) {
    return {
      reply:
        fallbackReply ??
        'Please describe your situation again — what is happening and where you are — so I can suggest safety steps.',
      tips: [],
      model,
    };
  }

  const replyUr =
    typeof parsed.replyUr === 'string' && parsed.replyUr.trim().length > 0
      ? parsed.replyUr.trim()
      : undefined;
  const tipsUr = sanitizeTips(parsed.tipsUr);

  return {
    reply: parsed.reply.trim(),
    tips: sanitizeTips(parsed.tips),
    replyUr,
    tipsUr: tipsUr.length > 0 ? tipsUr : undefined,
    model,
  };
}

export async function* streamSafetyChat(input: {
  messages: SafetyChatInputMessage[];
}): AsyncGenerator<SafetyChatStreamEvent> {
  if (!hasOpenRouter()) {
    yield {
      type: 'done',
      result: {
        reply:
          'Safety advice is temporarily unavailable. If you are in immediate danger, call 1122 or your local emergency number. You can also use Report Now to alert authorities.',
        tips: ['Move to a safe place if you can do so without risk', 'Call emergency services if anyone is injured'],
      },
    };
    return;
  }

  const conversation: OpenRouterChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...input.messages.map((m) => ({ role: m.role, content: m.content.trim() })),
  ];

  let accumulated = '';
  let lastEmittedReply = '';
  let model: string | undefined;

  const stream = openRouterChatStream(conversation, { jsonMode: true });
  let next = await stream.next();

  while (!next.done) {
    accumulated += next.value.delta;
    if (next.value.model) model = next.value.model;
    const reply = extractPartialReplyFromStream(accumulated);
    if (reply.length > lastEmittedReply.length) {
      lastEmittedReply = reply;
      yield { type: 'delta', reply };
    }
    next = await stream.next();
  }

  const final = next.value;
  if (!final?.text) {
    yield {
      type: 'done',
      result: {
        reply:
          'I could not connect right now. Stay safe — avoid unnecessary travel and monitor official alerts. Try again in a moment.',
        tips: [],
      },
    };
    return;
  }

  model = final.model ?? model;
  const parsed = parseOpenRouterJson<LlmSafetyResponse>(final.text);
  yield { type: 'done', result: buildSafetyChatResult(parsed, model) };
}

export async function processSafetyChat(input: {
  messages: SafetyChatInputMessage[];
}): Promise<SafetyChatResult> {
  if (!hasOpenRouter()) {
    return {
      reply:
        'Safety advice is temporarily unavailable. If you are in immediate danger, call 1122 or your local emergency number. You can also use Report Now to alert authorities.',
      tips: ['Move to a safe place if you can do so without risk', 'Call emergency services if anyone is injured'],
    };
  }

  const conversation: OpenRouterChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...input.messages.map((m) => ({ role: m.role, content: m.content.trim() })),
  ];

  const { text, model } = await openRouterChat(conversation, { jsonMode: true });

  if (!text) {
    return {
      reply:
        'I could not connect right now. Stay safe — avoid unnecessary travel and monitor official alerts. Try again in a moment.',
      tips: [],
    };
  }

  const parsed = parseOpenRouterJson<LlmSafetyResponse>(text);
  if (!parsed?.reply) {
    return {
      reply:
        'Please describe your situation again — what is happening and where you are — so I can suggest safety steps.',
      tips: [],
      model,
    };
  }

  const replyUr =
    typeof parsed.replyUr === 'string' && parsed.replyUr.trim().length > 0
      ? parsed.replyUr.trim()
      : undefined;
  const tipsUr = sanitizeTips(parsed.tipsUr);

  return {
    reply: parsed.reply.trim(),
    tips: sanitizeTips(parsed.tips),
    replyUr,
    tipsUr: tipsUr.length > 0 ? tipsUr : undefined,
    model,
  };
}
