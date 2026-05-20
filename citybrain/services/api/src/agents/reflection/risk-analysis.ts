import { v4 as uuid } from 'uuid';
import type { CrisisRunState } from '@citybrain/shared';
import type { UnresolvedRisk } from '@citybrain/shared';
import type { EffectivenessMetrics } from './effectiveness.js';
import type { FailedMitigation } from '@citybrain/shared';

export function analyzeUnresolvedRisks(
  state: CrisisRunState,
  metrics: EffectivenessMetrics,
  failedMitigations: FailedMitigation[]
): UnresolvedRisk[] {
  const risks: UnresolvedRisk[] = [];
  const type = state.candidate?.type ?? 'flood';
  const zone = state.candidate?.areaLabel ?? 'Unknown zone';

  if (metrics.congestionStillRising || metrics.congestionReduction < 0.25) {
    risks.push({
      id: uuid(),
      category: 'congestion',
      severity: metrics.congestionReduction < 0.1 ? 'critical' : 'high',
      description: 'Congestion still increasing or insufficient relief on primary corridors',
      evidence: [
        `Congestion reduction ${(metrics.congestionReduction * 100).toFixed(0)}%`,
        `After index ${metrics.afterCongestion.toFixed(2)}`,
        'Kashmir Hwy / Srinagar corridor may remain overloaded',
      ],
      zone,
    });
  }

  if (
    type === 'flood' &&
    (metrics.congestionReduction < 0.3 ||
      failedMitigations.some((f) => f.planActionType === 'deploy_pumps'))
  ) {
    risks.push({
      id: uuid(),
      category: 'flooding',
      severity: 'high',
      description: 'Flooding spreading or pump deployment insufficient',
      evidence: [
        `Crisis type: ${type}`,
        failedMitigations.length
          ? `Failed mitigations: ${failedMitigations.map((f) => f.planActionType).join(', ')}`
          : 'Water levels not stabilizing in downstream zones',
      ],
      zone,
    });
  }

  const hospitalFailed = failedMitigations.some(
    (f) => f.tool.includes('notifyHospitals') || String(f.reason).includes('hospital')
  );
  const highStranded = (state.severity?.estimatedImpact?.strandedVehicles ?? 0) > 60;
  if (hospitalFailed || (highStranded && metrics.strandedReduction < 0.15)) {
    risks.push({
      id: uuid(),
      category: 'hospital_capacity',
      severity: 'critical',
      description: 'Hospitals overloaded or surge notification incomplete',
      evidence: [
        hospitalFailed ? 'Hospital notify step failed or partial' : 'High stranded vehicle count',
        `Stranded relief ${(metrics.strandedReduction * 100).toFixed(0)}%`,
      ],
      zone,
    });
  }

  const rescueFailed = failedMitigations.some(
    (f) =>
      f.planActionType === 'dispatch_emergency' ||
      f.tool.includes('dispatchRescue') ||
      f.tool.includes('create_ticket')
  );
  if (rescueFailed || metrics.strandedReduction < 0.1) {
    risks.push({
      id: uuid(),
      category: 'rescue_delay',
      severity: metrics.strandedReduction < 0.05 ? 'critical' : 'high',
      description: 'Rescue delays rising — units not reaching trapped citizens in time',
      evidence: [
        rescueFailed ? 'Dispatch/rescue execution failed' : 'Low stranded-vehicle reduction',
        `Action success rate ${(metrics.actionSuccessRate * 100).toFixed(0)}%`,
      ],
      zone,
    });
  }

  if (type === 'infrastructure_failure' && metrics.outcomeScore < 0.6) {
    risks.push({
      id: uuid(),
      category: 'infrastructure',
      severity: 'high',
      description: 'Grid/traffic infrastructure recovery incomplete',
      evidence: ['Infrastructure isolation may need extended manual control'],
      zone,
    });
  }

  return risks;
}
