import {
  ResponsePlanSchema,
  EmergencyPlanReportSchema,
  type CrisisRunState,
  type ResponsePlan,
  type EmergencyPlanReport,
  type SeverityLevel,
} from '@citybrain/shared';
import type { ToolContext } from '@citybrain/agent-tools';
import { TOOL_REGISTRY } from '@citybrain/agent-tools';
import { hasLlm } from '../../orchestrator/gemini.js';
import { useDemoFastPath } from '../../orchestrator/demo-fast.js';
import { getActionCatalog, type ActionContext } from './actions.js';
import { CRITERIA_WEIGHTS, filterViableActions, type PrioritizationContext } from './prioritization.js';
import { rankActions } from './ranking.js';
import { aggregateImpact } from './impact.js';
import { sequenceActions, buildExecutionSequence } from './sequencing.js';
import { applyAdaptiveAdjustments, injectAdaptiveActions } from './adaptive.js';
import { planWithGemini } from './gemini-planner.js';
import type { CrisisDetectionResult } from '../crisis-detection/agent.js';

export interface EmergencyPlanningResult extends EmergencyPlanReport {
  plan: ResponsePlan;
}

type ExtendedState = CrisisRunState & {
  crisisDetection?: CrisisDetectionResult;
  emergencyPlanning?: EmergencyPlanningResult;
  reflection?: { metricsDelta?: { congestionReduction?: number }; summary?: string };
  reflectionAnalysis?: {
    unresolvedRisks?: Array<{ category: string; description: string }>;
    adaptiveDirectives?: Array<{ type: string; rationale: string }>;
  };
};

export async function runEmergencyPlanningAgent(
  state: CrisisRunState,
  ctx: ToolContext
): Promise<EmergencyPlanningResult> {
  const sop = await TOOL_REGISTRY.load_sop({}, state, ctx);
  const inventory = await TOOL_REGISTRY.inventory_status({}, state, ctx);
  const traffic = await TOOL_REGISTRY.get_traffic({}, state, ctx);

  const ext = state as ExtendedState;
  const crisisType = state.candidate?.type ?? 'flood';
  const areaLabel = state.candidate?.areaLabel ?? 'Islamabad';
  const severity = (state.severity?.level ?? ext.crisisDetection?.preliminarySeverity ?? 'high') as SeverityLevel;
  const escalationLevel =
    state.severity?.escalationLevel ??
    ext.crisisDetection?.escalationRisk?.predictedEscalationLevel ??
    'operational';

  const prioCtx: PrioritizationContext = {
    crisisType,
    severity,
    escalationLevel,
    congestionIndex: Number(traffic.congestionIndex ?? 0.82),
    strandedVehicles: state.severity?.estimatedImpact?.strandedVehicles ?? 80,
    inventory: {
      ambulances: Number(inventory.ambulances ?? 4),
      pumps: Number(inventory.pumps ?? 6),
      engineers: Number(inventory.engineers ?? 8),
      towTrucks: Number(inventory.towTrucks ?? 3),
    },
    planVersion: state.planVersion,
  };

  const actionCtx: ActionContext = {
    areaLabel,
    crisisType,
    congestionIndex: prioCtx.congestionIndex,
    strandedVehicles: prioCtx.strandedVehicles,
    planVersion: state.planVersion,
  };

  let report: EmergencyPlanReport | null = null;

  if (hasLlm() && !useDemoFastPath(state)) {
    report = await planWithGemini(state, prioCtx, actionCtx, String(sop.sopId ?? 'sop_generic'));
  }

  if (!report) {
    let catalog = getActionCatalog(crisisType);
    const replanReason =
      ext.reflectionAnalysis?.unresolvedRisks?.map((r) => r.description).join('; ') ??
      ext.reflection?.summary;
    catalog = injectAdaptiveActions(catalog, {
      planVersion: state.planVersion,
      crisisType,
      replanReason,
      priorCongestionReduction: ext.reflection?.metricsDelta?.congestionReduction,
    });
    catalog = filterViableActions(catalog, prioCtx);

    let ranked = rankActions(catalog, prioCtx, actionCtx);
    const adaptive = applyAdaptiveAdjustments(ranked, {
      planVersion: state.planVersion,
      crisisType,
      replanReason,
      priorCongestionReduction: ext.reflection?.metricsDelta?.congestionReduction,
    });
    ranked = adaptive.actions;

    const sequenced = sequenceActions(ranked);
    const aggregate = aggregateImpact(sequenced);

    report = {
      version: state.planVersion,
      summary: buildSummary(crisisType, areaLabel, sequenced, aggregate, state.planVersion),
      rankedActions: sequenced,
      executionSequence: buildExecutionSequence(sequenced),
      aggregateImpact: aggregate,
      criteriaWeights: CRITERIA_WEIGHTS,
      thought: buildThought(sequenced, aggregate, adaptive.note),
      method: 'decision_matrix',
      adaptiveNote: adaptive.note || undefined,
      sopId: String(sop.sopId ?? ''),
    };
  }

  const parsed = EmergencyPlanReportSchema.parse(report);
  const plan = toResponsePlan(parsed);

  await ctx.logExecution({
    tool: 'build_emergency_plan',
    request: { crisisType, severity, planVersion: state.planVersion },
    response: {
      rankedActions: parsed.rankedActions.map((a) => ({
        kind: a.kind,
        rankScore: a.rankScore,
        sequenceOrder: a.sequenceOrder,
      })),
      aggregateImpact: parsed.aggregateImpact,
    },
    stateDelta: {
      actionCount: plan.actions.length,
      congestionDelta: parsed.aggregateImpact.totalCongestionDelta,
    },
  });

  return { ...parsed, plan };
}

function toResponsePlan(report: EmergencyPlanReport): ResponsePlan {
  const ordered = [...report.rankedActions].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const actions = ordered.map((a) => ({
    id: a.id,
    type: a.planActionType,
    title: a.title,
    payload: { ...a.payload, emergencyKind: a.kind, phase: a.phase, rankScore: a.rankScore },
    priority: a.priority,
  }));

  return ResponsePlanSchema.parse({
    version: report.version,
    summary: report.summary,
    actions,
  });
}

function buildSummary(
  type: string,
  area: string,
  actions: EmergencyPlanReport['rankedActions'],
  aggregate: EmergencyPlanReport['aggregateImpact'],
  version: number
): string {
  return (
    `Emergency plan v${version} for ${type} at ${area}: ` +
    `${actions.length} actions sequenced across immediate/containment/recovery. ` +
    `Est. congestion Δ ${aggregate.totalCongestionDelta}, ` +
    `stranded relief ${(aggregate.totalStrandedReduction * 100).toFixed(0)}%, ` +
    `clearance ~${aggregate.estimatedClearanceMinutes}min.`
  );
}

function buildThought(
  actions: EmergencyPlanReport['rankedActions'],
  aggregate: EmergencyPlanReport['aggregateImpact'],
  adaptiveNote: string
): string {
  const top = actions.slice(0, 3).map((a) => `${a.kind}(${a.rankScore})`).join(' → ');
  return (
    `Decision-matrix plan: ${top}. ` +
    `Congestion Δ ${aggregate.totalCongestionDelta}. ` +
    (adaptiveNote || 'Standard SOP sequencing applied.')
  );
}

export function applyEmergencyPlanningToState(
  state: CrisisRunState,
  result: EmergencyPlanningResult
): void {
  state.plan = result.plan;
  (state as ExtendedState).emergencyPlanning = result;
}
