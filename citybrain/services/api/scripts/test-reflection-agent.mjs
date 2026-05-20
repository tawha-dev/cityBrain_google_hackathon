import { evaluateEffectiveness } from '../dist/agents/reflection/effectiveness.js';
import { analyzeFailedMitigations } from '../dist/agents/reflection/mitigation-analysis.js';
import { analyzeUnresolvedRisks } from '../dist/agents/reflection/risk-analysis.js';
import {
  generateAdaptiveDirectives,
  shouldReplan,
} from '../dist/agents/reflection/adaptive-response.js';
import { buildReflectionCoT } from '../dist/agents/reflection/reasoning.js';

const state = {
  candidate: { type: 'flood', areaLabel: 'G-10 Markaz' },
  severity: {
    level: 'high',
    escalationLevel: 'operational',
    estimatedImpact: { congestionIndex: 0.5, strandedVehicles: 100 },
  },
  alerts: [{ reachEstimate: 8000 }],
  executionResults: [
    { actionId: 'a1', status: 'success', tool: 'dispatchRescue', stateDelta: {}, log: 'ok' },
    { actionId: 'a2', status: 'partial', tool: 'updateTrafficRoutes', stateDelta: {}, log: 'partial reroute' },
  ],
  planVersion: 1,
};

const metrics = evaluateEffectiveness(state);
const failed = analyzeFailedMitigations(state);
const risks = analyzeUnresolvedRisks(state, metrics, failed);
const directives = generateAdaptiveDirectives(state, metrics, risks);
const { replanRequired } = shouldReplan(metrics, risks, 1, 2, false);
const trace = buildReflectionCoT({
  metrics,
  risks,
  failedMitigations: failed,
  directives,
  replanRequired,
  isReplanPass: false,
});

console.log('Metrics:', metrics);
console.log('\nUnresolved risks:');
risks.forEach((r) => console.log(`  [${r.category}] ${r.description}`));
console.log('\nAdaptive directives:', directives.map((d) => d.type));
console.log('Replan required:', replanRequired);
console.log('CoT steps:', trace.length);
