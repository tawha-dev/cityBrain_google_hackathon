import type { ExtractedSignalIntelligence } from '@citybrain/shared';
import type { Signal } from '@citybrain/shared';

/** Known geo entities — Islamabad + Karachi demo corridors */
const LOCATION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bkorangi\b/i, label: 'Korangi' },
  { pattern: /\bshahrah[\s-]*faisal\b/i, label: 'Shahrah-e-Faisal' },
  { pattern: /\bg-?\s*10\b/i, label: 'G-10' },
  { pattern: /\bg-?\s*13\b/i, label: 'G-13' },
  { pattern: /\bi-?\s*9\b/i, label: 'I-9' },
  { pattern: /\bmargalla\b/i, label: 'Margalla' },
  { pattern: /\bgeorge\s*town\b/i, label: 'George Town' },
  { pattern: /\bsrinagar\b/i, label: 'Srinagar Highway' },
  { pattern: /\bfaiz\s*road\b/i, label: 'Faiz Road' },
  { pattern: /\bislamabad\b/i, label: 'Islamabad' },
  { pattern: /\bkarachi\b/i, label: 'Karachi' },
];

const FLOOD_PATTERNS = [
  /\bpani\b/i,
  /\bflood/i,
  /\bbarish\b/i,
  /\brain\b/i,
  /\bwaterlogging\b/i,
  /\bbhar\s+gaya\b/i,
  /\bphans\b/i,
  /\bsubmerged\b/i,
];

const HEAT_PATTERNS = [/\bheatwave\b/i, /\bheat\s*wave\b/i, /\bgarmi\b/i, /\btemperature\b/i, /\b48\s*°?c\b/i];

const ACCIDENT_PATTERNS = [
  /\baccident\b/i,
  /\bcrash\b/i,
  /\bcollision\b/i,
  /\btakra\b/i,
  /\bstuck\b/i,
  /\bphans\b/i,
  /\bcars?\s+stuck\b/i,
];

const BLOCK_PATTERNS = [/\bblockage\b/i, /\broad\s+block\b/i, /\bband\s+hai\b/i, /\bclosed\b/i];

const INFRA_PATTERNS = [/\bpower\b/i, /\bgrid\b/i, /\boutage\b/i, /\btraffic\s+light\b/i, /\bsubstation\b/i];

const URDU_SCRIPT = /[\u0600-\u06FF]/;
const ROMAN_URDU_MARKERS = /\b(mein|hai|hain|bhar|gaya|gayin|chahiye|bohat|subah|kal|gaariyan|pani)\b/i;

export function detectLanguage(text: string): 'en' | 'ur' | 'roman_ur' | 'mixed' {
  const hasUrdu = URDU_SCRIPT.test(text);
  const hasRoman = ROMAN_URDU_MARKERS.test(text);
  const hasEn = /[a-zA-Z]{3,}/.test(text);
  if (hasUrdu && hasEn) return 'mixed';
  if (hasUrdu) return 'ur';
  if (hasRoman && !hasEn) return 'roman_ur';
  if (hasRoman && hasEn) return 'mixed';
  return 'en';
}

function inferEventType(text: string): ExtractedSignalIntelligence['event_type'] {
  const t = text.toLowerCase();
  if (FLOOD_PATTERNS.some((p) => p.test(t))) return 'flood';
  if (HEAT_PATTERNS.some((p) => p.test(t))) return 'heatwave';
  if (ACCIDENT_PATTERNS.some((p) => p.test(t))) return 'accident';
  if (BLOCK_PATTERNS.some((p) => p.test(t))) return 'road_blockage';
  if (INFRA_PATTERNS.some((p) => p.test(t))) return 'infrastructure_failure';
  return 'unknown';
}

function extractLocation(text: string): string {
  for (const { pattern, label } of LOCATION_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return '';
}

function extractEntities(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  if (/\b(car|cars|vehicle|gaari|gaariyan|truck|bus)\b/i.test(lower)) found.add('vehicles');
  if (/\b(people|citizen|log|public|phans)\b/i.test(lower)) found.add('people');
  if (/\b(road|highway|corridor|shahrah)\b/i.test(lower)) found.add('road_network');
  if (/\b(hospital|pims|ed\b|ambulance)\b/i.test(lower)) found.add('healthcare');

  for (const { label } of LOCATION_PATTERNS) {
    if (lower.includes(label.toLowerCase())) found.add(label);
  }

  return [...found].slice(0, 8);
}

function inferSeverityHint(text: string): ExtractedSignalIntelligence['severity_hint'] {
  const t = text.toLowerCase();
  if (/\b(emergency|critical|trapped|phans|help|bachao|khatarnak)\b/i.test(t)) return 'critical';
  if (/\b(severe|heavy|major|warning|alert)\b/i.test(t)) return 'high';
  if (/\b(moderate|rising|congestion)\b/i.test(t)) return 'medium';
  if (/\b(minor|advisory)\b/i.test(t)) return 'low';
  return 'unknown';
}

function inferSourceType(sig: Signal): ExtractedSignalIntelligence['source_type'] {
  const map: Record<string, ExtractedSignalIntelligence['source_type']> = {
    social: 'social',
    weather: 'weather',
    traffic: 'traffic',
    field_report: 'field_report',
    sensor: 'sensor',
  };
  return map[sig.source] ?? 'citizen';
}

function requiresImmediate(text: string, severity: ExtractedSignalIntelligence['severity_hint']): boolean {
  if (severity === 'critical' || severity === 'high') return true;
  return /\b(trapped|stuck|emergency|help|phans|bachao|warning\s+issued)\b/i.test(text);
}

/**
 * Rule-based extractor — deterministic, no hallucination beyond keyword lists.
 */
export function extractWithRules(sig: Signal): ExtractedSignalIntelligence {
  const text = sig.rawText;
  const event_type = inferEventType(text);
  const location = extractLocation(text) || sig.areaLabel || '';
  const severity_hint = inferSeverityHint(text);
  const affected_entities = extractEntities(text);
  const detected_language = sig.language ?? detectLanguage(text);

  let confidence = 0.55;
  if (event_type !== 'unknown') confidence += 0.15;
  if (location) confidence += 0.15;
  if (affected_entities.length > 0) confidence += 0.1;
  if (sig.confidence) confidence = Math.min(1, (confidence + sig.confidence) / 2);

  return {
    event_type,
    location,
    severity_hint,
    affected_entities,
    confidence_score: Math.round(Math.min(1, confidence) * 100) / 100,
    requires_immediate_attention: requiresImmediate(text, severity_hint),
    source_type: inferSourceType(sig),
    detected_language,
    normalized_summary_en: buildSummaryEn(event_type, location, text),
  };
}

function buildSummaryEn(
  eventType: ExtractedSignalIntelligence['event_type'],
  location: string,
  raw: string
): string {
  const loc = location || 'unspecified area';
  const map: Record<string, string> = {
    flood: `Flooding reported in ${loc}`,
    heatwave: `Heat-related alert for ${loc}`,
    accident: `Traffic incident in ${loc}`,
    road_blockage: `Road blockage in ${loc}`,
    infrastructure_failure: `Infrastructure issue in ${loc}`,
    fire: `Fire emergency in ${loc}`,
    unknown: `Crisis signal from ${loc}`,
  };
  return map[eventType] ?? raw.slice(0, 120);
}
