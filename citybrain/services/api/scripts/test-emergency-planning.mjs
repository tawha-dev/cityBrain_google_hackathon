import { getActionCatalog } from '../dist/agents/emergency-planning/actions.js';
import { filterViableActions, CRITERIA_WEIGHTS } from '../dist/agents/emergency-planning/prioritization.js';
import { rankActions } from '../dist/agents/emergency-planning/ranking.js';
import { sequenceActions, buildExecutionSequence } from '../dist/agents/emergency-planning/sequencing.js';
import { aggregateImpact } from '../dist/agents/emergency-planning/impact.js';

const prioCtx = {
  crisisType: 'flood',
  severity: 'critical',
  escalationLevel: 'critical',
  congestionIndex: 0.82,
  strandedVehicles: 120,
  inventory: { ambulances: 4, pumps: 6, engineers: 8, towTrucks: 3 },
  planVersion: 1,
};

const actionCtx = {
  areaLabel: 'G-10 Markaz',
  crisisType: 'flood',
  congestionIndex: 0.82,
  strandedVehicles: 120,
  planVersion: 1,
};

const catalog = filterViableActions(getActionCatalog('flood'), prioCtx);
const ranked = rankActions(catalog, prioCtx, actionCtx);
const sequenced = sequenceActions(ranked);
const aggregate = aggregateImpact(sequenced);
const sequence = buildExecutionSequence(sequenced);

console.log('Criteria weights:', CRITERIA_WEIGHTS);
console.log('\nRanked actions (execution order):');
for (const a of sequenced) {
  console.log(
    `  ${a.sequenceOrder}. [${a.phase}] ${a.kind} — score ${a.rankScore} — Δcong ${a.impact.congestionDelta}`
  );
}
console.log('\nAggregate:', aggregate);
console.log('Sequence IDs:', sequence.length);
