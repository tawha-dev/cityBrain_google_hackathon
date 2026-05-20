import { v4 as uuid } from 'uuid';
import type { Signal, CrisisRunState } from '@citybrain/shared';
import type { ExtractedSignalIntelligence } from '@citybrain/shared';
import type { ToolContext } from '@citybrain/agent-tools';
import { hasLlm } from '../../orchestrator/gemini.js';
import { useDemoFastPath } from '../../orchestrator/demo-fast.js';
import { extractWithRules } from './rules.js';
import { extractWithGemini } from './gemini-extractor.js';
import { scoreExtractionConfidence } from './confidence.js';

export interface NormalizedSignal extends Signal {
  intelligence: ExtractedSignalIntelligence;
  extractionMeta: {
    method: 'gemini' | 'rules';
    attempts: number;
    confidenceFactors?: unknown;
  };
}

export interface SignalExtractionResult {
  normalizedSignals: NormalizedSignal[];
  thought: string;
  avgConfidence: number;
  immediateCount: number;
}

/**
 * Signal Extraction Agent — multilingual crisis intelligence extraction.
 */
export async function runSignalExtractionAgent(
  state: CrisisRunState,
  ctx: ToolContext
): Promise<SignalExtractionResult> {
  const normalizedSignals: NormalizedSignal[] = [];
  let totalConfidence = 0;
  let immediateCount = 0;
  const fastDemo = useDemoFastPath(state);

  for (const sig of state.rawSignals) {
    let extraction: ExtractedSignalIntelligence;
    let method: 'gemini' | 'rules' = 'rules';
    let attempts = 1;

    if (hasLlm() && !fastDemo) {
      const geminiResult = await extractWithGemini(sig);
      extraction = geminiResult.extraction;
      method = geminiResult.usedLlm ? 'gemini' : 'rules';
      attempts = geminiResult.attempts;
    } else {
      extraction = extractWithRules(sig);
    }

    const { score, factors } = scoreExtractionConfidence(sig, extraction, method === 'gemini');
    extraction = {
      ...extraction,
      confidence_score: score,
    };

    if (extraction.requires_immediate_attention) immediateCount += 1;
    totalConfidence += score;

    const normalizedText =
      extraction.normalized_summary_en ??
      (extraction.location
        ? `[${extraction.event_type}] ${extraction.location}: ${sig.rawText.slice(0, 200)}`
        : sig.rawText);

    const location = resolveGeo(sig, extraction);

    await ctx.logExecution({
      tool: 'extract_signal_intelligence',
      request: { rawText: sig.rawText, source: sig.source },
      response: { extraction, method, factors },
      stateDelta: {
        event_type: extraction.event_type,
        location: extraction.location,
        confidence: score,
      },
    });

    normalizedSignals.push({
      ...sig,
      id: sig.id ?? uuid(),
      normalizedText,
      language: extraction.detected_language ?? sig.language,
      areaLabel: extraction.location || sig.areaLabel,
      entities: extraction.affected_entities,
      location,
      confidence: score,
      ingestedAt: sig.ingestedAt ?? new Date().toISOString(),
      intelligence: extraction,
      extractionMeta: { method, attempts, confidenceFactors: factors },
    });
  }

  const avgConfidence =
    normalizedSignals.length > 0 ? totalConfidence / normalizedSignals.length : 0;

  const thought = buildAgentThought(normalizedSignals, immediateCount);

  return {
    normalizedSignals,
    thought,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    immediateCount,
  };
}

function resolveGeo(
  sig: Signal,
  extraction: ExtractedSignalIntelligence
): { lat: number; lng: number } {
  if (sig.location?.lat != null && sig.location?.lng != null) {
    return { lat: sig.location.lat, lng: sig.location.lng };
  }

  const GEO: Record<string, { lat: number; lng: number }> = {
    Korangi: { lat: 24.82, lng: 67.14 },
    'Shahrah-e-Faisal': { lat: 24.86, lng: 67.09 },
    'G-10': { lat: 33.6702, lng: 73.0213 },
    Islamabad: { lat: 33.6844, lng: 73.0479 },
    Karachi: { lat: 24.86, lng: 67.0011 },
  };

  for (const [name, coords] of Object.entries(GEO)) {
    if (extraction.location.toLowerCase().includes(name.toLowerCase())) {
      return coords;
    }
  }

  return { lat: 33.6844, lng: 73.0479 };
}

function buildAgentThought(signals: NormalizedSignal[], immediateCount: number): string {
  const langs = [...new Set(signals.map((s) => s.intelligence.detected_language ?? s.language))];
  const types = [...new Set(signals.map((s) => s.intelligence.event_type))].filter(
    (t) => t !== 'unknown'
  );
  return (
    `Normalized ${signals.length} multilingual signal(s) [${langs.join(', ')}]. ` +
    `Event types: ${types.join(', ') || 'pending'}. ` +
    `${immediateCount} require immediate attention. ` +
    `Avg confidence ${(signals.reduce((a, s) => a + s.intelligence.confidence_score, 0) / Math.max(1, signals.length)).toFixed(2)}.`
  );
}

/** Apply agent output to pipeline state */
export function applySignalExtractionToState(
  state: CrisisRunState,
  result: SignalExtractionResult
): void {
  state.normalizedSignals = result.normalizedSignals.map((s) => ({
    id: s.id,
    source: s.source,
    rawText: s.rawText,
    normalizedText: s.normalizedText,
    language: s.language,
    location: s.location,
    areaLabel: s.areaLabel,
    entities: s.entities,
    confidence: s.confidence,
    ingestedAt: s.ingestedAt,
  }));
}
