import type { CrisisRunState } from '@citybrain/shared';
import type { AdaptiveDirective, UnresolvedRisk } from '@citybrain/shared';
import type { EffectivenessMetrics } from './effectiveness.js';

const REPLAN_CONGESTION_THRESHOLD = 0.25;
const REPLAN_STRANDED_THRESHOLD = 0.1;

export function shouldReplan(
  metrics: EffectivenessMetrics,
  risks: UnresolvedRisk[],
  planVersion: number,
  maxReplanVersion: number,
  isReplanPass: boolean
): { replanRequired: boolean; maxReplanReached: boolean } {
  if (isReplanPass) {
    return { replanRequired: false, maxReplanReached: planVersion >= maxReplanVersion };
  }
  if (planVersion >= maxReplanVersion) {
    return { replanRequired: false, maxReplanReached: true };
  }

  const criticalRisk = risks.some((r) => r.severity === 'critical');
  const underperform =
    metrics.congestionReduction < REPLAN_CONGESTION_THRESHOLD ||
    metrics.strandedReduction < REPLAN_STRANDED_THRESHOLD ||
    metrics.outcomeScore < 0.55;

  return {
    replanRequired: criticalRisk || underperform,
    maxReplanReached: false,
  };
}

/**
 * Generate autonomous adaptive directives from residual risks.
 */
export function generateAdaptiveDirectives(
  state: CrisisRunState,
  metrics: EffectivenessMetrics,
  risks: UnresolvedRisk[]
): AdaptiveDirective[] {
  const directives: AdaptiveDirective[] = [];
  const zone = state.candidate?.areaLabel ?? 'affected zone';
  const type = state.candidate?.type ?? 'flood';

  const needsEscalation = risks.some(
    (r) => r.severity === 'critical' || r.category === 'hospital_capacity'
  );
  if (needsEscalation || metrics.outcomeScore < 0.5) {
    directives.push({
      type: 'escalate_severity',
      priority: 1,
      rationale: 'Critical residual risks require elevated operational posture',
      payload: { bumpLevels: 1, escalationTo: 'critical' },
    });
  }

  if (
    risks.some((r) => r.category === 'congestion') ||
    metrics.congestionStillRising
  ) {
    directives.push({
      type: 'expand_rerouting',
      priority: 2,
      rationale: 'Primary reroute insufficient — activate secondary corridors',
      payload: {
        corridors: ['Murree Rd', 'Kashmir Hwy', 'IJP Road'],
        secondary: true,
        zone,
      },
    });
  }

  if (
    risks.some((r) => r.category === 'rescue_delay' || r.category === 'flooding') ||
    metrics.strandedReduction < REPLAN_STRANDED_THRESHOLD
  ) {
    directives.push({
      type: 'dispatch_secondary_teams',
      priority: 2,
      rationale: 'Deploy backup rescue, pumps, and tow units',
      payload: {
        units: type === 'flood' ? ['pump', 'rescue', 'ambulance'] : ['ambulance', 'tow'],
        count: 2,
        zone,
      },
    });
  }

  if (
    risks.length >= 2 ||
    metrics.alertsDelivered < 5000 ||
    risks.some((r) => r.category === 'public_safety')
  ) {
    directives.push({
      type: 'broaden_alerts',
      priority: 3,
      rationale: 'Expand multilingual alerts to adjacent sectors and commuters',
      payload: {
        zones: [zone, 'adjacent_sectors'],
        channels: ['sms', 'app', 'variable_message_sign', 'radio'],
        widenReach: true,
      },
    });
  }

  return directives.sort((a, b) => a.priority - b.priority);
}

export function buildLessons(
  metrics: EffectivenessMetrics,
  risks: UnresolvedRisk[],
  directives: AdaptiveDirective[]
): string[] {
  const lessons: string[] = [];

  if (metrics.congestionReduction >= 0.25) {
    lessons.push(
      `Primary response reduced corridor congestion by ${(metrics.congestionReduction * 100).toFixed(0)}%`
    );
  } else {
    lessons.push('Primary reroute underperformed — secondary artery intervention required');
  }

  for (const r of risks.slice(0, 2)) {
    lessons.push(`${r.category}: ${r.description}`);
  }

  for (const d of directives.slice(0, 2)) {
    lessons.push(`Adaptive: ${d.type} — ${d.rationale}`);
  }

  return lessons.slice(0, 5);
}
