import type { RankedEmergencyAction, PlanPhase } from '@citybrain/shared';

/**
 * Staggered execution sequencing (analogous to staggered startup protocols).
 * Life-safety actions first, then congestion containment, then public comms.
 */
const PHASE_ORDER: PlanPhase[] = ['immediate', 'containment', 'recovery'];

const KIND_TIE_BREAK: Record<string, number> = {
  dispatch_rescue: 1,
  notify_hospitals: 2,
  allocate_pumps: 3,
  close_roads: 4,
  reroute_traffic: 5,
  send_alerts: 6,
};

export function sequenceActions(actions: RankedEmergencyAction[]): RankedEmergencyAction[] {
  const byPhase = new Map<PlanPhase, RankedEmergencyAction[]>();

  for (const phase of PHASE_ORDER) {
    byPhase.set(phase, []);
  }

  for (const action of actions) {
    const list = byPhase.get(action.phase) ?? [];
    list.push(action);
    byPhase.set(action.phase, list);
  }

  const sequenced: RankedEmergencyAction[] = [];
  let order = 1;

  for (const phase of PHASE_ORDER) {
    const phaseActions = (byPhase.get(phase) ?? []).sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      return (KIND_TIE_BREAK[a.kind] ?? 99) - (KIND_TIE_BREAK[b.kind] ?? 99);
    });

    for (const action of phaseActions) {
      sequenced.push({ ...action, sequenceOrder: order++ });
    }
  }

  return sequenced;
}

export function buildExecutionSequence(actions: RankedEmergencyAction[]): string[] {
  return [...actions]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map((a) => a.id);
}
