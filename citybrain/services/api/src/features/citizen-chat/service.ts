import {
  hasOpenRouter,
  openRouterChat,
  parseOpenRouterJson,
  type OpenRouterChatMessage,
} from '../../llm/openrouter.js';

const ALLOWED_CATEGORIES = [
  'flood',
  'tsunami',
  'earthquake',
  'landslide',
  'rain_monsoon',
  'fire',
  'accident',
  'storm',
  'other',
] as const;

const ALLOWED_LANGUAGES = ['en', 'ur', 'roman_ur'] as const;

export interface CitizenChatInputMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CitizenChatSuggestion {
  ready: boolean;
  category?: string;
  rawText?: string;
  language?: string;
}

export interface CitizenChatResult {
  reply: string;
  suggestion?: CitizenChatSuggestion;
  model?: string;
}

interface LlmChatResponse {
  reply?: string;
  suggestion?: {
    ready?: boolean;
    category?: string;
    rawText?: string;
    language?: string;
  };
}

const SYSTEM_PROMPT = `You are CityBrain's emergency report assistant for citizens in Pakistan.
Your job is to help users describe their emergency and prepare a citizen alert report.

Rules:
- Be concise, calm, and helpful. Ask at most 1-2 short clarifying questions if needed (what happened, where, urgency).
- Support English, Urdu, and Roman Urdu. Reply in the same language the user uses.
- Never claim that rescue units are dispatched or that authorities have acted. You only help draft a report.
- When you have enough information (emergency type + description of at least 5 characters + general location if mentioned), set suggestion.ready to true.
- Map emergencies to exactly one category id from this list: ${ALLOWED_CATEGORIES.join(', ')}.
- rawText should be a clear citizen report description (include location/area if known).
- language must be one of: en, ur, roman_ur.
- If information is incomplete, set suggestion.ready to false and ask one focused follow-up in reply.

Respond with a single JSON object only:
{
  "reply": "string — your message to the user",
  "suggestion": {
    "ready": boolean,
    "category": "category_id or omit",
    "rawText": "draft report text or omit",
    "language": "en|ur|roman_ur or omit"
  }
}`;

function normalizeCategory(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const id = value.trim().toLowerCase();
  return (ALLOWED_CATEGORIES as readonly string[]).includes(id) ? id : 'other';
}

function normalizeLanguage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const lang = value.trim().toLowerCase();
  return (ALLOWED_LANGUAGES as readonly string[]).includes(lang) ? lang : undefined;
}

function sanitizeSuggestion(raw: LlmChatResponse['suggestion']): CitizenChatSuggestion | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const ready = Boolean(raw.ready);
  const category = normalizeCategory(raw.category);
  const rawText = typeof raw.rawText === 'string' ? raw.rawText.trim() : undefined;
  const language = normalizeLanguage(raw.language) ?? 'en';

  if (!ready) {
    return { ready: false };
  }

  if (!category || !rawText || rawText.length < 5) {
    return { ready: false };
  }

  return { ready: true, category, rawText, language };
}

export async function processCitizenChat(input: {
  messages: CitizenChatInputMessage[];
}): Promise<CitizenChatResult> {
  if (!hasOpenRouter()) {
    return {
      reply:
        'The AI assistant is temporarily unavailable. You can still tap Report Now on the home screen to submit your emergency manually.',
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
        'Sorry, I could not reach the assistant right now. Please try again or use Report Now to submit manually.',
    };
  }

  const parsed = parseOpenRouterJson<LlmChatResponse>(text);
  if (!parsed?.reply) {
    return {
      reply:
        'Sorry, I had trouble understanding that. Please describe your emergency again — what happened and where?',
      model,
    };
  }

  return {
    reply: parsed.reply.trim(),
    suggestion: sanitizeSuggestion(parsed.suggestion),
    model,
  };
}
