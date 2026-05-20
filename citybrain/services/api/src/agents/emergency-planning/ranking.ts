import { v4 as uuid } from 'uuid';
import type { RankedEmergencyAction } from '@citybrain/shared';
import type { ActionTemplate } from './actions.js';
import { scoreAction, type PrioritizationContext } from './prioritization.js';
import { estimateActionImpact } from './impact.js';
import type { ActionContext } from './actions.js';

export function rankActions(
  templates: ActionTemplate[],
  prioCtx: PrioritizationContext,
  actionCtx: ActionContext
): RankedEmergencyAction[] {
  const scored = templates.map((template) => {
    const { rankScore, criteriaScores } = scoreAction(template, prioCtx);
    const impact = estimateActionImpact(template.kind, prioCtx, actionCtx);
    return {
      template,
      rankScore,
      criteriaScores,
      impact,
    };
  });

  scored.sort((a, b) => b.rankScore - a.rankScore);

  return scored.map((item, index) => ({
    id: uuid(),
    kind: item.template.kind,
    planActionType: item.template.planActionType,
    title: item.template.title,
    priority: Math.max(1, Math.min(10, 10 - index)),
    rankScore: item.rankScore,
    sequenceOrder: 0,
    phase: item.template.defaultPhase,
    payload: item.template.buildPayload(actionCtx),
    impact: item.impact,
    rationale: buildRationale(item.template.kind, item.rankScore, item.criteriaScores),
    criteriaScores: item.criteriaScores,
  }));
}

function buildRationale(
  kind: string,
  score: number,
  criteria: Record<string, number>
): string {
  const top = Object.entries(criteria).sort((a, b) => b[1] - a[1])[0];
  return `${kind}: composite ${score.toFixed(1)}/100 — strongest on ${top?.[0] ?? 'balance'} (${top?.[1]?.toFixed(0) ?? 0})`;
}
