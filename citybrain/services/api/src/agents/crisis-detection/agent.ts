import {
  CrisisCandidateSchema,
  CrisisDetectionReportSchema,
  type CrisisDetectionReport,
  type CrisisRunState,
} from '@citybrain/shared';
import type { ToolContext } from '@citybrain/agent-tools';
import { TOOL_REGISTRY } from '@citybrain/agent-tools';
import { hasLlm } from '../../orchestrator/gemini.js';
import { useDemoFastPath } from '../../orchestrator/demo-fast.js';
import { analyzeSignalClusters, type EnrichedSignal } from './clustering.js';
import { classifyCrisisType, buildCrisisCandidate } from './classification.js';
import { predictEscalationRisk, inferPreliminarySeverity } from './escalation.js';
import { buildChainOfThoughtTrace, formatThoughtFromTrace, type CoTContext } from './reasoning.js';
import { scoreDetectionConfidence } from './confidence.js';
import { detectWithGeminiCoT } from './gemini-detector.js';
import type { SignalExtractionResult } from '../signal-extraction/agent.js';

const DETECTION_THRESHOLD = 0.55;

export interface CrisisDetectionResult extends CrisisDetectionReport {
  detectionFactors?: unknown;
}

type StateWithExtraction = CrisisRunState & {
  signalExtraction?: SignalExtractionResult;
  crisisDetection?: CrisisDetectionResult;
};

function getEnrichedSignals(state: CrisisRunState): EnrichedSignal[] {
  const ext = state as StateWithExtraction;
  if (ext.signalExtraction?.normalizedSignals?.length) {
    return ext.signalExtraction.normalizedSignals.map((s) => ({
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
      intelligence: s.intelligence,
    }));
  }

  return state.normalizedSignals.map((s) => ({ ...s }));
}

/**
 * Crisis Detection Agent — CoT fusion of clusters, weather, traffic, memory.
 */
export async function runCrisisDetectionAgent(
  state: CrisisRunState,
  ctx: ToolContext,
  _crisisId: string
): Promise<CrisisDetectionResult> {
  await TOOL_REGISTRY.cluster_signals({}, state, ctx);
  const memoryResult = await TOOL_REGISTRY.query_memory({}, state, ctx);
  const weather = await TOOL_REGISTRY.get_weather({}, state, ctx);
  const traffic = await TOOL_REGISTRY.get_traffic({}, state, ctx);

  const signals = getEnrichedSignals(state);
  const clusters = analyzeSignalClusters(signals);
  const memoryMatches = (memoryResult.matches as Array<{ summary?: string; outcomeScore?: number }>) ?? [];

  const crisisType = classifyCrisisType(clusters, signals);
  const escalation = predictEscalationRisk(
    crisisType,
    clusters,
    signals,
    traffic as { congestionIndex?: number },
    weather as { condition?: string; rainfallMm?: number; temperatureC?: number }
  );
  const preliminarySeverity = inferPreliminarySeverity(crisisType, escalation, clusters);

  const cotCtx: CoTContext = {
    signals,
    clusters,
    weather,
    traffic,
    memoryMatches,
    crisisType,
    preliminarySeverity,
    escalation,
    candidateSummary: 'pending classification',
  };

  let report: CrisisDetectionReport | null = null;
  let method: 'cot_gemini' | 'cot_rules' = 'cot_rules';

  if (hasLlm() && !useDemoFastPath(state)) {
    report = await detectWithGeminiCoT(cotCtx, clusters, signals, state.scenarioKey);
    if (report) method = 'cot_gemini';
  }

  if (!report) {
    const candidate = buildCrisisCandidate(
      crisisType,
      clusters,
      signals,
      state.scenarioKey,
      0.75
    );
    cotCtx.candidateSummary = candidate?.summary ?? 'No candidate';
    const reasoningTrace = buildChainOfThoughtTrace(cotCtx);
    const verified = !reasoningTrace[8]?.analysis.includes('weakly grounded');

    report = {
      candidate,
      preliminarySeverity,
      escalationRisk: escalation,
      clusters,
      reasoningTrace,
      confidence: 0,
      thought: formatThoughtFromTrace(reasoningTrace, candidate?.title),
      verified,
      method: 'cot_rules',
      memoryInsight: memoryMatches[0]?.summary,
    };
  }

  const { score, factors } = scoreDetectionConfidence(
    report,
    clusters,
    signals,
    memoryMatches.length > 0
  );

  if (report.candidate) {
    report.candidate.confidence = Math.round(score * 100) / 100;
    if (score < DETECTION_THRESHOLD) {
      report.candidate = null;
    } else {
      report.candidate = CrisisCandidateSchema.parse(report.candidate);
    }
  }

  report.confidence = score;
  report.thought = formatThoughtFromTrace(report.reasoningTrace, report.candidate?.title);

  for (const step of report.reasoningTrace) {
    await ctx.logExecution({
      tool: 'crisis_detection_reasoning',
      request: { step: step.step, title: step.title },
      response: { analysis: step.analysis, conclusion: step.conclusion, evidence: step.evidence },
      stateDelta: { agent: 'crisis_detection', step: step.step },
    });
  }

  await ctx.logExecution({
    tool: 'detect_crisis',
    request: { signalCount: signals.length, clusterCount: clusters.length },
    response: {
      candidate: report.candidate,
      preliminarySeverity: report.preliminarySeverity,
      escalationRisk: report.escalationRisk,
      confidence: score,
    },
    stateDelta: {
      type: report.candidate?.type,
      escalation: report.escalationRisk.predictedEscalationLevel,
    },
  });

  const parsed = CrisisDetectionReportSchema.parse({ ...report, method });
  return { ...parsed, detectionFactors: factors };
}

export function applyCrisisDetectionToState(
  state: CrisisRunState,
  result: CrisisDetectionResult
): void {
  state.candidate = result.candidate ?? undefined;
  (state as StateWithExtraction).crisisDetection = result;
}
