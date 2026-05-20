import { z } from 'zod';

export const EventTypeEnum = z.enum([
  'flood',
  'heatwave',
  'accident',
  'infrastructure_failure',
  'road_blockage',
  'fire',
  'unknown',
]);

export const SeverityHintEnum = z.enum(['low', 'medium', 'high', 'critical', 'unknown']);

export const SourceTypeEnum = z.enum([
  'social',
  'weather',
  'traffic',
  'field_report',
  'sensor',
  'citizen',
  'official',
  'unknown',
]);

/**
 * Per-signal structured intelligence from Signal Extraction Agent.
 * Maps to Gemini responseSchema / application validation layer.
 */
export const ExtractedSignalIntelligenceSchema = z.object({
  event_type: EventTypeEnum.describe(
    'Primary crisis type inferred from text. Use unknown only if truly ambiguous.'
  ),
  location: z
    .string()
    .describe(
      'Best-effort location: neighborhood, road, or city (e.g. Korangi, G-10, Shahrah-e-Faisal). Empty string if not mentioned.'
    ),
  severity_hint: SeverityHintEnum.describe(
    'Urgency implied by language (trapped, emergency, warning, stuck).'
  ),
  affected_entities: z
    .array(z.string())
    .describe(
      'Entities explicitly mentioned: vehicles, people, roads, hospitals. Max 8. Do not invent.'
    ),
  confidence_score: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence that extraction is grounded in source text.'),
  requires_immediate_attention: z
    .boolean()
    .describe('True if text implies active danger, trapping, or official emergency.'),
  source_type: SourceTypeEnum.describe('Inferred channel type of the report.'),
  detected_language: z
    .enum(['en', 'ur', 'roman_ur', 'mixed'])
    .optional()
    .describe('Primary language of the input text.'),
  normalized_summary_en: z
    .string()
    .optional()
    .describe('One-line English summary for ops dashboard.'),
});

export type ExtractedSignalIntelligence = z.infer<typeof ExtractedSignalIntelligenceSchema>;

export const SignalExtractionBatchSchema = z.object({
  extractions: z.array(ExtractedSignalIntelligenceSchema),
});
