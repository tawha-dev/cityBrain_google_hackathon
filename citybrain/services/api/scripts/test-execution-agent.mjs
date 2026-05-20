import { resolveToolsForAction } from '../dist/agents/execution/resolver.js';
import { mergeToolResults } from '../dist/agents/execution/retry.js';
import { EXECUTION_TOOL_DEFINITIONS } from '@citybrain/agent-tools';

const state = {
  candidate: {
    type: 'flood',
    title: 'Urban Flooding — G-10',
    areaLabel: 'G-10 Markaz',
    centroid: { lat: 33.6702, lng: 73.0213 },
  },
  severity: {
    estimatedImpact: { congestionIndex: 0.82, strandedVehicles: 120 },
  },
  plan: {
    actions: [
      {
        id: 'a1',
        type: 'dispatch_emergency',
        title: 'Dispatch rescue',
        payload: { emergencyKind: 'dispatch_rescue', unit: 'rescue' },
        priority: 1,
      },
      {
        id: 'a2',
        type: 'traffic_reroute',
        title: 'Reroute traffic',
        payload: { emergencyKind: 'reroute_traffic', corridor: 'Murree Rd' },
        priority: 2,
      },
    ],
  },
};

console.log('Tool definitions:', EXECUTION_TOOL_DEFINITIONS.length);
for (const action of state.plan.actions) {
  const calls = resolveToolsForAction(action, state, 'test-crisis-id-0001');
  console.log(`\n${action.title} →`, calls.map((c) => c.tool).join(', '));
}

const merged = mergeToolResults([
  { success: true, content: 'ok', data: { congestionDelta: -0.32 } },
  { success: false, content: 'rate limited', errorType: 'rate_limit', isError: true },
]);
console.log('\nMerge partial:', merged.status, merged.log.slice(0, 80));
