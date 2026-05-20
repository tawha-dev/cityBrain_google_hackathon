import {
  ReflectionAnalysisSchema,
  ReflectionReportSchema,
  type CrisisRunState,
  type ReflectionAnalysis,
} from '@citybrain/shared';
import type { ToolContext } from '@citybrain/agent-tools';
import { TOOL_REGISTRY } from '@citybrain/agent-tools';
import { broadcast } from '../../ws/hub.js';
import * as repo from '../../db/repository.js';
import { evaluateEffectiveness } from './effectiveness.js';
import { analyzeFailedMitigations } from './mitigation-analysis.js';
import { analyzeUnresolvedRisks } from './risk-analysis.js';
import {
  shouldReplan,
  generateAdaptiveDirectives,
  buildLessons,
} from './adaptive-response.js';
import { buildEscalationWorkflow, applySeverityEscalation } from './escalation.js';
import { buildReflectionCoT, formatReflectionThought } from './reasoning.js';
import { applyAutonomousAdjustments } from './autonomous.js';
import type { ExecutionReport } from '@citybrain/shared';

const MAX_REPLAN_VERSION = 2;

export interface ReflectionAgentResult {
  analysis: ReflectionAnalysis;
}

type ExtendedState = CrisisRunState & {
  executionReport?: ExecutionReport;
  reflectionAnalysis?: ReflectionAnalysis;
};

/**
 * Reflection Agent — post-execution CoT analysis, adaptive directives, autonomous adjustments.
 */
export async function runReflectionAgent(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string,
  isReplanPass = false
): Promise<ReflectionAgentResult> {
  const ext = state as ExtendedState;
  const executionReport = ext.executionReport;

  const toolScore = await TOOL_REGISTRY.score_outcome({}, state, ctx);
  const metrics = evaluateEffectiveness(state, executionReport);

  metrics.outcomeScore =
    Math.round(
      (metrics.outcomeScore * 0.6 + Number(toolScore.outcomeScore ?? 0.75) * 0.4) * 100
    ) / 100;
  metrics.congestionReduction =
    Number(toolScore.congestionReduction ?? metrics.congestionReduction) || metrics.congestionReduction;
  metrics.strandedReduction =
    Number(toolScore.strandedReduction ?? metrics.strandedReduction) || metrics.strandedReduction;

  const failedMitigations = analyzeFailedMitigations(state, executionReport);
  const unresolvedRisks = analyzeUnresolvedRisks(state, metrics, failedMitigations);
  const adaptiveDirectives = generateAdaptiveDirectives(state, metrics, unresolvedRisks);

  const { replanRequired, maxReplanReached } = shouldReplan(
    metrics,
    unresolvedRisks,
    state.planVersion,
    MAX_REPLAN_VERSION,
    isReplanPass
  );

  const lessons = buildLessons(metrics, unresolvedRisks, adaptiveDirectives);
  const summary = buildSummary(metrics, replanRequired, maxReplanReached, isReplanPass);

  const report = ReflectionReportSchema.parse({
    outcomeScore: metrics.outcomeScore,
    lessons,
    replanRequired,
    summary,
    metricsDelta: {
      congestionReduction: metrics.congestionReduction,
      strandedReduction: metrics.strandedReduction,
      alertsDelivered: metrics.alertsDelivered,
    },
  });

  const reasoningTrace = buildReflectionCoT({
    metrics,
    risks: unresolvedRisks,
    failedMitigations,
    directives: adaptiveDirectives,
    replanRequired,
    isReplanPass,
  });

  const escalateDirective = adaptiveDirectives.find((d) => d.type === 'escalate_severity');
  const escalationPreview = applySeverityEscalation(
    state.severity?.level,
    state.severity?.escalationLevel,
    escalateDirective,
    unresolvedRisks
  );

  const analysis = ReflectionAnalysisSchema.parse({
    report,
    reasoningTrace,
    unresolvedRisks,
    failedMitigations,
    adaptiveDirectives,
    escalationWorkflow: escalationPreview.applied
      ? buildEscalationWorkflow(escalationPreview)
      : undefined,
    replanRequired,
    maxReplanReached,
    thought: formatReflectionThought(reasoningTrace, summary),
    method: 'cot_rules',
  });

  for (const step of reasoningTrace) {
    await ctx.logExecution({
      tool: 'reflection_reasoning',
      request: { step: step.step, title: step.title },
      response: { analysis: step.analysis, conclusion: step.conclusion },
      stateDelta: { agent: 'reflection', step: step.step },
    });
  }

  const adjustments = applyAutonomousAdjustments(state, analysis);
  state.reflection = report;

  if (adjustments.severityUpdated && state.severity) {
    await repo.updateCrisis(crisisId, {
      severity: state.severity.level,
      escalationLevel: state.severity.escalationLevel,
    });
    broadcast({
      type: 'escalation.changed',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: {
        level: state.severity.escalationLevel,
        reason: 'reflection_autonomous_escalation',
        directives: adjustments.directivesApplied,
      },
    });
  }

  await TOOL_REGISTRY.write_memory({}, state, ctx);
  await repo.writeCrisisMemory(crisisId, state);

  await ctx.logExecution({
    tool: 'reflect_outcome',
    request: { crisisId, planVersion: state.planVersion, isReplanPass },
    response: {
      outcomeScore: metrics.outcomeScore,
      replanRequired,
      risks: unresolvedRisks.length,
      directives: adaptiveDirectives.map((d) => d.type),
    },
    stateDelta: {
      replanRequired,
      severity: state.severity?.level,
    },
  });

  if (replanRequired) {
    broadcast({
      type: 'pipeline.replan',
      crisisId,
      timestamp: new Date().toISOString(),
      payload: {
        reason: summary,
        planVersion: state.planVersion + 1,
        directives: adaptiveDirectives,
      },
    });
  } else {
    await repo.updateCrisis(crisisId, { status: 'resolved' });
  }

  return { analysis };
}

function buildSummary(
  metrics: ReturnType<typeof evaluateEffectiveness>,
  replanRequired: boolean,
  maxReplanReached: boolean,
  isReplanPass: boolean
): string {
  if (isReplanPass) {
    return replanRequired
      ? `Replan v${MAX_REPLAN_VERSION} still below thresholds (score ${metrics.outcomeScore}) — monitoring mode`
      : `Adaptive replan succeeded — congestion −${(metrics.congestionReduction * 100).toFixed(0)}%`;
  }
  if (maxReplanReached && !replanRequired) {
    return 'Max replan cycles reached — holding current posture with documented residual risks';
  }
  if (replanRequired) {
    return (
      `Partial success — congestion −${(metrics.congestionReduction * 100).toFixed(0)}%, ` +
      'residual risks detected. Initiating adaptive replan with secondary response.'
    );
  }
  return (
    `Response objectives met (score ${metrics.outcomeScore}) — ` +
    `congestion −${(metrics.congestionReduction * 100).toFixed(0)}%, ` +
    `stranded −${(metrics.strandedReduction * 100).toFixed(0)}%`
  );
}

export function applyReflectionToState(
  state: CrisisRunState,
  result: ReflectionAgentResult
): void {
  state.reflection = result.analysis.report;
  state.replanRequired = result.analysis.replanRequired;
  (state as ExtendedState).reflectionAnalysis = result.analysis;
}
