import type { RankedEmergencyAction } from '@citybrain/shared';
import type { ActionTemplate } from './actions.js';
import { getActionCatalog } from './actions.js';

export interface AdaptiveContext {
  planVersion: number;
  replanReason?: string;
  priorCongestionReduction?: number;
  crisisType: import('@citybrain/shared').CrisisType;
}

/**
 * Adaptive replan — boost congestion actions when v1 plan underperformed.
 * Mirrors "defer/accelerate tranche" logic from layered procurement frameworks.
 */
export function applyAdaptiveAdjustments(
  ranked: RankedEmergencyAction[],
  ctx: AdaptiveContext
): { actions: RankedEmergencyAction[]; note: string } {
  if (ctx.planVersion <= 1) {
    return { actions: ranked, note: '' };
  }

  const boosted = ranked.map((action) => {
    let rankScore = action.rankScore;
    let rationale = action.rationale;

    if (action.kind === 'reroute_traffic') {
      rankScore = Math.min(100, rankScore + 18);
      rationale += ' [adaptive: secondary corridor priority]';
    }
    if (action.kind === 'close_roads' && ctx.crisisType === 'flood') {
      rankScore = Math.min(100, rankScore + 10);
      rationale += ' [adaptive: extend cordon]';
    }
    if (action.kind === 'send_alerts') {
      rankScore = Math.min(100, rankScore + 5);
    }

    return { ...action, rankScore, rationale };
  });

  boosted.sort((a, b) => b.rankScore - a.rankScore);

  const note =
    `Adaptive replan v${ctx.planVersion}: prioritized congestion relief ` +
    `(prior reduction ${((ctx.priorCongestionReduction ?? 0) * 100).toFixed(0)}%). ` +
    (ctx.replanReason ?? 'Reflection triggered replan.');

  return { actions: boosted, note };
}

export function injectAdaptiveActions(
  catalog: ActionTemplate[],
  ctx: AdaptiveContext
): ActionTemplate[] {
  if (ctx.planVersion <= 1) return catalog;

  const hasSecondaryReroute = catalog.some(
    (t) => t.kind === 'reroute_traffic' && t.title.includes('secondary')
  );

  if (!hasSecondaryReroute && (ctx.crisisType === 'flood' || ctx.crisisType === 'road_blockage')) {
    return [
      ...catalog,
      {
        kind: 'reroute_traffic' as const,
        planActionType: 'traffic_reroute' as const,
        title: 'Secondary reroute — Kashmir Hwy spillover relief',
        defaultPhase: 'containment' as const,
        baseScores: {
          lifeSafety: 45,
          congestionRelief: 98,
          resourceEfficiency: 65,
          speedToEffect: 55,
        },
        buildPayload: () => ({
          corridor: 'Kashmir Hwy',
          adaptive: true,
          secondary: true,
        }),
      },
    ];
  }

  return catalog;
}
