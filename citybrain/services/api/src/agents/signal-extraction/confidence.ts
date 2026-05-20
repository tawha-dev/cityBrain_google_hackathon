import type { ExtractedSignalIntelligence } from '@citybrain/shared';
import type { Signal } from '@citybrain/shared';

export interface ConfidenceFactors {
  languageClarity: number;
  eventTypeMatch: number;
  locationGrounded: number;
  entityGrounded: number;
  sourceReliability: number;
}

const SOURCE_WEIGHT: Record<string, number> = {
  weather: 0.95,
  sensor: 0.9,
  traffic: 0.85,
  field_report: 0.8,
  social: 0.65,
  citizen: 0.6,
};

/**
 * Post-validation confidence — penalize hallucination indicators.
 */
export function scoreExtractionConfidence(
  sig: Signal,
  extraction: ExtractedSignalIntelligence,
  usedLlm: boolean
): { score: number; factors: ConfidenceFactors } {
  const text = sig.rawText.toLowerCase();

  const languageClarity = extraction.detected_language ? 0.85 : 0.7;

  const eventTypeMatch =
    extraction.event_type === 'unknown'
      ? 0.4
      : verifyEventInText(text, extraction.event_type)
        ? 0.95
        : 0.45;

  const locationGrounded = extraction.location
    ? verifyLocationInText(text, sig.areaLabel ?? '', extraction.location)
      ? 0.95
      : 0.35
    : 0.5;

  const entityGrounded =
    extraction.affected_entities.length === 0
      ? 0.7
      : extraction.affected_entities.filter((e) => verifyEntityInText(text, e)).length /
        extraction.affected_entities.length;

  const sourceReliability = SOURCE_WEIGHT[extraction.source_type] ?? 0.65;

  const factors: ConfidenceFactors = {
    languageClarity,
    eventTypeMatch,
    locationGrounded,
    entityGrounded,
    sourceReliability,
  };

  let score =
    0.25 * eventTypeMatch +
    0.25 * locationGrounded +
    0.2 * entityGrounded +
    0.15 * sourceReliability +
    0.15 * languageClarity;

  if (!usedLlm) score *= 0.92;
  if (extraction.event_type !== 'unknown' && eventTypeMatch < 0.5) {
    score = Math.min(score, 0.55);
  }

  return { score: Math.round(Math.min(1, Math.max(0, score)) * 100) / 100, factors };
}

function verifyEventInText(text: string, eventType: string): boolean {
  const checks: Record<string, RegExp[]> = {
    flood: [/\bpani\b/, /\bflood/, /\bbarish/, /\bbhar/],
    heatwave: [/heat/, /\bgarmi/],
    accident: [/accident/, /crash/, /stuck/, /takra/, /phans/],
    road_blockage: [/block/, /\bband\b/, /closed/],
    infrastructure_failure: [/power/, /grid/, /outage/],
  };
  const patterns = checks[eventType];
  return patterns ? patterns.some((p) => p.test(text)) : false;
}

function verifyLocationInText(text: string, areaLabel: string, location: string): boolean {
  const loc = location.toLowerCase();
  if (text.includes(loc)) return true;
  if (areaLabel && areaLabel.toLowerCase().includes(loc)) return true;
  if (loc.includes('shahrah') && /shahrah|faisal/i.test(text)) return true;
  return false;
}

function verifyEntityInText(text: string, entity: string): boolean {
  const e = entity.toLowerCase();
  if (e === 'vehicles' && /car|vehicle|gaari|truck|bus|stuck/i.test(text)) return true;
  if (e === 'people' && /people|citizen|log|phans|help/i.test(text)) return true;
  if (e === 'road_network' && /road|highway|shahrah|corridor/i.test(text)) return true;
  if (text.includes(e)) return true;
  return false;
}
