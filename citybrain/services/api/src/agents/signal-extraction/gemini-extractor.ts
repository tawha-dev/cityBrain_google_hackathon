import {
  ExtractedSignalIntelligenceSchema,
  type ExtractedSignalIntelligence,
  type Signal,
} from '@citybrain/shared';
import { generateStructuredJson } from '../../orchestrator/gemini-structured.js';
import { extractWithRules } from './rules.js';

const SYSTEM_PROMPT = `You are CityBrain Signal Extraction — a data extraction system for emergency operations.
You extract ONLY facts present in the input text. Do not invent locations, events, or casualties.
Support English, Urdu script, and Roman Urdu.
If a field is not supported by the text, use: event_type=unknown, location="", affected_entities=[], severity_hint=unknown.
Output must match the JSON schema exactly.`;

function buildUserPrompt(sig: Signal): string {
  return `Extract structured crisis intelligence from this report.

Source channel: ${sig.source}
Declared language hint: ${sig.language ?? 'auto'}
Area hint (if any): ${sig.areaLabel ?? 'none'}

TEXT:
"""
${sig.rawText}
"""

Rules:
- location must be copied or clearly implied (neighborhood, road name) — never guess a city not mentioned
- affected_entities: only explicit nouns (vehicles, people, roads)
- requires_immediate_attention: true only for trapped, stuck, emergency, heavy flooding, official warning
- confidence_score: your confidence that extraction is grounded (0-1)`;
}

function zodToGeminiSchema(): object {
  return {
    type: 'object',
    properties: {
      event_type: {
        type: 'string',
        enum: [
          'flood',
          'heatwave',
          'accident',
          'infrastructure_failure',
          'road_blockage',
          'fire',
          'unknown',
        ],
        description: 'Crisis type from text',
      },
      location: {
        type: 'string',
        description: 'Location string or empty if absent',
      },
      severity_hint: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical', 'unknown'],
      },
      affected_entities: {
        type: 'array',
        items: { type: 'string' },
      },
      confidence_score: { type: 'number' },
      requires_immediate_attention: { type: 'boolean' },
      source_type: {
        type: 'string',
        enum: ['social', 'weather', 'traffic', 'field_report', 'sensor', 'citizen', 'official', 'unknown'],
      },
      detected_language: {
        type: 'string',
        enum: ['en', 'ur', 'roman_ur', 'mixed'],
      },
      normalized_summary_en: { type: 'string' },
    },
    required: [
      'event_type',
      'location',
      'severity_hint',
      'affected_entities',
      'confidence_score',
      'requires_immediate_attention',
      'source_type',
    ],
  };
}

const MAX_RETRIES = 3;

export async function extractWithGemini(sig: Signal): Promise<{
  extraction: ExtractedSignalIntelligence;
  usedLlm: boolean;
  attempts: number;
}> {
  const schema = zodToGeminiSchema();
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const prompt =
      attempt === 1
        ? buildUserPrompt(sig)
        : `${buildUserPrompt(sig)}\n\nPrevious output failed validation: ${lastError}\nFix the JSON.`;

    const raw = await generateStructuredJson<Record<string, unknown>>({
      systemInstruction: SYSTEM_PROMPT,
      userPrompt: prompt,
      responseSchema: schema,
    });

    if (!raw) {
      lastError = 'empty or parse failure';
      return { extraction: extractWithRules(sig), usedLlm: false, attempts: attempt };
    }

    const parsed = ExtractedSignalIntelligenceSchema.safeParse(sanitizeExtraction(raw));
    if (parsed.success) {
      return { extraction: parsed.data, usedLlm: true, attempts: attempt };
    }

    lastError = parsed.error.message.slice(0, 200);
  }

  return { extraction: extractWithRules(sig), usedLlm: false, attempts: MAX_RETRIES };
}

/** Strip fields LLM must not invent beyond schema */
function sanitizeExtraction(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    event_type: raw.event_type ?? 'unknown',
    location: typeof raw.location === 'string' ? raw.location.slice(0, 256) : '',
    severity_hint: raw.severity_hint ?? 'unknown',
    affected_entities: Array.isArray(raw.affected_entities)
      ? raw.affected_entities.filter((x) => typeof x === 'string').slice(0, 8)
      : [],
    confidence_score:
      typeof raw.confidence_score === 'number'
        ? Math.min(1, Math.max(0, raw.confidence_score))
        : 0.5,
    requires_immediate_attention: Boolean(raw.requires_immediate_attention),
    source_type: raw.source_type ?? 'unknown',
    detected_language: raw.detected_language,
    normalized_summary_en:
      typeof raw.normalized_summary_en === 'string'
        ? raw.normalized_summary_en.slice(0, 500)
        : undefined,
  };
}
