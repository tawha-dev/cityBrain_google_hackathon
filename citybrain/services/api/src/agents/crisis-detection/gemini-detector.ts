import {
  CrisisDetectionReportSchema,
  type CrisisDetectionReport,
} from '@citybrain/shared';
import { generateStructuredJson } from '../../orchestrator/gemini-structured.js';
import type { CoTContext } from './reasoning.js';
import { buildChainOfThoughtTrace, formatThoughtFromTrace } from './reasoning.js';
import {
  classifyCrisisType,
  buildCrisisCandidate,
} from './classification.js';
import { predictEscalationRisk, inferPreliminarySeverity } from './escalation.js';
import type { EnrichedSignal } from './clustering.js';
import type { SignalCluster } from '@citybrain/shared';

const SYSTEM_PROMPT = `You are CityBrain Crisis Detection — an emergency operations reasoning system.
Use chain-of-thought: analyze weather alerts, congestion spikes, repeated complaints, geographic clusters, and stranded vehicles.
Extract ONLY conclusions supported by the provided evidence.
Return JSON matching the schema. Include reasoningTrace with numbered steps 1-9.`;

function buildUserPrompt(ctx: CoTContext, scenarioKey?: string): string {
  return `Let's analyze step by step whether a crisis should be declared.

Scenario hint: ${scenarioKey ?? 'none'}

Signals (${ctx.signals.length}):
${ctx.signals
  .slice(0, 8)
  .map((s) => `- [${s.source}] ${s.rawText} (conf=${s.confidence ?? 'n/a'})`)
  .join('\n')}

Clusters:
${JSON.stringify(ctx.clusters, null, 2)}

Weather: ${JSON.stringify(ctx.weather)}
Traffic: ${JSON.stringify(ctx.traffic)}
Memory: ${JSON.stringify(ctx.memoryMatches)}

Steps required in reasoningTrace:
1 Signal inventory
2 Weather alert analysis
3 Congestion spike analysis
4 Repeated complaint pattern
5 Geographic clustering
6 Stranded vehicle assessment
7 Crisis classification
8 Escalation risk projection
9 Verification

Output candidate only if confidence >= 0.55. Use crisis types: flood, heatwave, accident, infrastructure_failure, road_blockage.`;
}

function responseSchema(): object {
  return {
    type: 'object',
    properties: {
      candidate: {
        type: 'object',
        nullable: true,
        properties: {
          type: {
            type: 'string',
            enum: ['flood', 'heatwave', 'accident', 'infrastructure_failure', 'road_blockage'],
          },
          title: { type: 'string' },
          areaLabel: { type: 'string' },
          centroid: {
            type: 'object',
            properties: { lat: { type: 'number' }, lng: { type: 'number' } },
            required: ['lat', 'lng'],
          },
          signalIds: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          summary: { type: 'string' },
        },
        required: ['type', 'title', 'areaLabel', 'centroid', 'signalIds', 'confidence', 'summary'],
      },
      preliminarySeverity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
      },
      escalationRisk: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['low', 'medium', 'high', 'imminent'] },
          score: { type: 'number' },
          predictedEscalationLevel: {
            type: 'string',
            enum: ['watch', 'advisory', 'operational', 'critical'],
          },
          factors: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string' },
          timeHorizonMinutes: { type: 'number' },
        },
        required: ['level', 'score', 'predictedEscalationLevel', 'factors', 'rationale'],
      },
      reasoningTrace: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            step: { type: 'number' },
            title: { type: 'string' },
            analysis: { type: 'string' },
            evidence: { type: 'array', items: { type: 'string' } },
            conclusion: { type: 'string' },
          },
          required: ['step', 'title', 'analysis'],
        },
      },
      confidence: { type: 'number' },
      verified: { type: 'boolean' },
    },
    required: ['preliminarySeverity', 'escalationRisk', 'reasoningTrace', 'confidence', 'verified'],
  };
}

export async function detectWithGeminiCoT(
  ctx: CoTContext,
  clusters: SignalCluster[],
  signals: EnrichedSignal[],
  scenarioKey?: string
): Promise<CrisisDetectionReport | null> {
  const raw = await generateStructuredJson<Record<string, unknown>>({
    systemInstruction: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(ctx, scenarioKey),
    responseSchema: responseSchema(),
  });

  if (!raw) return null;

  const crisisType = classifyCrisisType(clusters, signals);
  const fallbackCandidate = buildCrisisCandidate(
    crisisType,
    clusters,
    signals,
    scenarioKey,
    Number((raw as { confidence?: number }).confidence ?? 0.75)
  );

  const merged = {
    candidate:
      (raw.candidate as CrisisDetectionReport['candidate']) ?? fallbackCandidate,
    preliminarySeverity:
      raw.preliminarySeverity ?? inferPreliminarySeverity(crisisType, ctx.escalation, clusters),
    escalationRisk: raw.escalationRisk ?? ctx.escalation,
    clusters,
    reasoningTrace:
      Array.isArray(raw.reasoningTrace) && raw.reasoningTrace.length >= 5
        ? raw.reasoningTrace
        : buildChainOfThoughtTrace(ctx),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.75,
    thought: '',
    verified: Boolean(raw.verified),
    method: 'cot_gemini' as const,
    memoryInsight: ctx.memoryMatches[0]?.summary,
  };

  merged.thought = formatThoughtFromTrace(
    merged.reasoningTrace as CrisisDetectionReport['reasoningTrace'],
    merged.candidate?.title
  );

  const parsed = CrisisDetectionReportSchema.safeParse(merged);
  return parsed.success ? parsed.data : null;
}
