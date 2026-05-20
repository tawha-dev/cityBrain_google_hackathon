import type { EmergencyActionKind } from '@citybrain/shared';
import type { ActionImpactEstimate } from '@citybrain/shared';
import type { PrioritizationContext } from './prioritization.js';
import type { ActionContext } from './actions.js';

const IMPACT_BASE: Record<
  EmergencyActionKind,
  Omit<ActionImpactEstimate, 'etaMinutes'>
> = {
  reroute_traffic: { congestionDelta: -0.32, strandedReduction: 0.12, livesRiskReduction: 0.15 },
  dispatch_rescue: { congestionDelta: -0.05, strandedReduction: 0.35, livesRiskReduction: 0.55 },
  notify_hospitals: { congestionDelta: 0, strandedReduction: 0.05, livesRiskReduction: 0.4 },
  send_alerts: { congestionDelta: -0.18, strandedReduction: 0.08, livesRiskReduction: 0.2 },
  close_roads: { congestionDelta: -0.22, strandedReduction: 0.15, livesRiskReduction: 0.35 },
  allocate_pumps: { congestionDelta: -0.15, strandedReduction: 0.2, livesRiskReduction: 0.3 },
};

const ETA_BASE: Record<EmergencyActionKind, number> = {
  dispatch_rescue: 8,
  notify_hospitals: 5,
  close_roads: 12,
  reroute_traffic: 15,
  allocate_pumps: 20,
  send_alerts: 3,
};

export function estimateActionImpact(
  kind: EmergencyActionKind,
  prioCtx: PrioritizationContext,
  actionCtx: ActionContext
): ActionImpactEstimate {
  const base = IMPACT_BASE[kind];
  let congestionDelta = base.congestionDelta;
  let strandedReduction = base.strandedReduction;

  if (prioCtx.congestionIndex >= 0.8 && kind === 'reroute_traffic') {
    congestionDelta *= 1.2;
    strandedReduction *= 1.15;
  }
  if (actionCtx.planVersion > 1 && kind === 'reroute_traffic') {
    congestionDelta *= 1.25;
  }

  return {
    congestionDelta: Math.round(Math.max(-0.55, congestionDelta) * 100) / 100,
    strandedReduction: Math.min(0.6, Math.round(strandedReduction * 100) / 100),
    livesRiskReduction: base.livesRiskReduction,
    etaMinutes: ETA_BASE[kind],
  };
}

export function aggregateImpact(
  actions: Array<{ impact: ActionImpactEstimate }>
): {
  totalCongestionDelta: number;
  totalStrandedReduction: number;
  estimatedClearanceMinutes: number;
  actionsCount: number;
} {
  if (actions.length === 0) {
    return {
      totalCongestionDelta: 0,
      totalStrandedReduction: 0,
      estimatedClearanceMinutes: 0,
      actionsCount: 0,
    };
  }

  const totalCongestionDelta = actions.reduce((a, x) => a + x.impact.congestionDelta, 0);
  const totalStrandedReduction = Math.min(
    0.85,
    1 - actions.reduce((p, x) => p * (1 - x.impact.strandedReduction), 1)
  );
  const estimatedClearanceMinutes = Math.max(...actions.map((x) => x.impact.etaMinutes));

  return {
    totalCongestionDelta: Math.round(totalCongestionDelta * 100) / 100,
    totalStrandedReduction: Math.round(totalStrandedReduction * 100) / 100,
    estimatedClearanceMinutes,
    actionsCount: actions.length,
  };
}
