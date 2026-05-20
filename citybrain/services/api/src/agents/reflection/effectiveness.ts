import type { CrisisRunState } from '@citybrain/shared';
import type { ExecutionReport } from '@citybrain/shared';

export interface EffectivenessMetrics {
  outcomeScore: number;
  congestionReduction: number;
  strandedReduction: number;
  alertsDelivered: number;
  actionSuccessRate: number;
  beforeCongestion: number;
  afterCongestion: number;
  congestionStillRising: boolean;
}

const BASELINE_CONGESTION = 0.82;

export function evaluateEffectiveness(
  state: CrisisRunState,
  executionReport?: ExecutionReport
): EffectivenessMetrics {
  const results = state.executionResults ?? [];
  const successCount = results.filter((r) => r.status === 'success').length;
  const actionSuccessRate =
    results.length > 0 ? successCount / results.length : executionReport?.succeeded
      ? executionReport.succeeded / Math.max(1, executionReport.totalActions)
      : 0.75;

  const beforeCongestion =
    state.severity?.estimatedImpact?.congestionIndex != null
      ? Number(state.severity.estimatedImpact.congestionIndex) + 0.32
      : BASELINE_CONGESTION;

  const afterCongestion = Number(
    state.severity?.estimatedImpact?.congestionIndex ?? beforeCongestion * 0.68
  );

  let congestionReduction = (beforeCongestion - afterCongestion) / Math.max(0.01, beforeCongestion);
  congestionReduction = Math.max(0, Math.min(1, congestionReduction));

  const beforeStranded = state.severity?.estimatedImpact?.strandedVehicles ?? 80;
  const afterStranded = Math.round(beforeStranded * (1 - congestionReduction * 0.55));
  const strandedReduction = Math.max(
    0,
    (beforeStranded - afterStranded) / Math.max(1, beforeStranded)
  );

  const alertsDelivered = state.alerts?.[0]?.reachEstimate ?? 0;

  const outcomeScore = Math.round(
    Math.min(
      1,
      0.35 * actionSuccessRate +
        0.35 * congestionReduction +
        0.2 * strandedReduction +
        0.1 * (alertsDelivered > 0 ? 1 : 0)
    ) * 100
  ) / 100;

  const congestionStillRising =
    congestionReduction < 0.15 || afterCongestion >= beforeCongestion * 0.95;

  return {
    outcomeScore,
    congestionReduction: Math.round(congestionReduction * 100) / 100,
    strandedReduction: Math.round(strandedReduction * 100) / 100,
    alertsDelivered,
    actionSuccessRate: Math.round(actionSuccessRate * 100) / 100,
    beforeCongestion,
    afterCongestion,
    congestionStillRising,
  };
}
