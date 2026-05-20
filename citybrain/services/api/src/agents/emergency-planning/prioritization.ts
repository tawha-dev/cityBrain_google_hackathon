import type { CrisisType, SeverityLevel } from '@citybrain/shared';
import type { ActionTemplate } from './actions.js';

/**
 * Decision-matrix weights (adapted from procurement evaluation matrices).
 * Total = 100 points per action.
 */
export const CRITERIA_WEIGHTS: Record<string, number> = {
  lifeSafety: 0.35,
  congestionRelief: 0.25,
  resourceAvailability: 0.15,
  speedToEffect: 0.15,
  escalationAlignment: 0.1,
};

export interface PrioritizationContext {
  crisisType: CrisisType;
  severity: SeverityLevel;
  escalationLevel: string;
  congestionIndex: number;
  strandedVehicles: number;
  inventory: {
    ambulances: number;
    pumps: number;
    engineers: number;
    towTrucks: number;
  };
  planVersion: number;
}

export function scoreAction(
  template: ActionTemplate,
  ctx: PrioritizationContext
): { rankScore: number; criteriaScores: Record<string, number> } {
  const lifeSafety = template.baseScores.lifeSafety;
  const congestionRelief = adjustCongestionScore(template, ctx);
  const resourceAvailability = scoreResourceFit(template, ctx.inventory);
  const speedToEffect = template.baseScores.speedToEffect;
  const escalationAlignment = scoreEscalationFit(template, ctx);

  const criteriaScores = {
    lifeSafety,
    congestionRelief,
    resourceAvailability,
    speedToEffect,
    escalationAlignment,
  };

  const rankScore =
    CRITERIA_WEIGHTS.lifeSafety * lifeSafety +
    CRITERIA_WEIGHTS.congestionRelief * congestionRelief +
    CRITERIA_WEIGHTS.resourceAvailability * resourceAvailability +
    CRITERIA_WEIGHTS.speedToEffect * speedToEffect +
    CRITERIA_WEIGHTS.escalationAlignment * escalationAlignment;

  return { rankScore: Math.round(rankScore * 10) / 10, criteriaScores };
}

function adjustCongestionScore(template: ActionTemplate, ctx: PrioritizationContext): number {
  let score = template.baseScores.congestionRelief;
  if (ctx.congestionIndex >= 0.75) {
    if (template.kind === 'reroute_traffic' || template.kind === 'close_roads') score += 15;
  }
  if (ctx.strandedVehicles >= 50 && template.kind === 'dispatch_rescue') score += 10;
  return Math.min(100, score);
}

function scoreResourceFit(
  template: ActionTemplate,
  inventory: PrioritizationContext['inventory']
): number {
  if (template.kind === 'allocate_pumps') {
    return inventory.pumps >= 3 ? 95 : inventory.pumps >= 1 ? 60 : 25;
  }
  if (template.kind === 'dispatch_rescue') {
    return inventory.ambulances >= 2 ? 90 : 55;
  }
  if (template.kind === 'notify_hospitals' || template.kind === 'send_alerts') {
    return 95;
  }
  return template.baseScores.resourceEfficiency;
}

function scoreEscalationFit(
  template: ActionTemplate,
  ctx: PrioritizationContext
): number {
  if (ctx.escalationLevel === 'critical' || ctx.severity === 'critical') {
    if (template.defaultPhase === 'immediate') return 95;
    return 50;
  }
  if (ctx.escalationLevel === 'operational') return 75;
  return 60;
}

/** Decision tree: filter actions below minimum threshold for crisis class */
export function filterViableActions(
  templates: ActionTemplate[],
  ctx: PrioritizationContext
): ActionTemplate[] {
  return templates.filter((t) => {
    const { rankScore } = scoreAction(t, ctx);
    if (rankScore < 40) return false;
    if (ctx.crisisType === 'heatwave' && t.kind === 'allocate_pumps') return false;
    if (ctx.crisisType === 'heatwave' && t.kind === 'close_roads') return false;
    return true;
  });
}
