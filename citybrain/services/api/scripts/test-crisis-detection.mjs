import { extractWithRules } from '../dist/agents/signal-extraction/rules.js';
import { analyzeSignalClusters } from '../dist/agents/crisis-detection/clustering.js';
import { classifyCrisisType, buildCrisisCandidate } from '../dist/agents/crisis-detection/classification.js';
import { predictEscalationRisk, inferPreliminarySeverity } from '../dist/agents/crisis-detection/escalation.js';
import { buildChainOfThoughtTrace } from '../dist/agents/crisis-detection/reasoning.js';
import { scoreDetectionConfidence } from '../dist/agents/crisis-detection/confidence.js';

const rawSignals = [
  { rawText: 'Korangi mein pani bhar gaya', source: 'social' },
  { rawText: 'Barish zor ho rahi Korangi', source: 'social' },
  { rawText: 'Heavy rain warning Korangi', source: 'weather' },
  { rawText: 'Cars stuck near Shahrah Faisal', source: 'traffic' },
];

const signals = rawSignals.map((s, i) => {
  const intel = extractWithRules(s);
  return {
    id: `sig-${i}`,
    ...s,
    language: intel.detected_language,
    areaLabel: intel.location,
    location: { lat: 24.82 + i * 0.01, lng: 67.14 },
    confidence: intel.confidence_score,
    intelligence: intel,
    entities: intel.affected_entities,
  };
});

const clusters = analyzeSignalClusters(signals);
const type = classifyCrisisType(clusters, signals);
const weather = { condition: 'heavy_rain', rainfallMm: 42 };
const traffic = { congestionIndex: 0.82, incidents: 3 };
const escalation = predictEscalationRisk(type, clusters, signals, traffic, weather);
const severity = inferPreliminarySeverity(type, escalation, clusters);
const candidate = buildCrisisCandidate(type, clusters, signals, undefined, 0.8);

const trace = buildChainOfThoughtTrace({
  signals,
  clusters,
  weather,
  traffic,
  memoryMatches: [{ summary: 'G-10 flash flood Aug 2024', outcomeScore: 0.72 }],
  crisisType: type,
  preliminarySeverity: severity,
  escalation,
  candidateSummary: candidate?.summary ?? '',
});

const report = {
  candidate,
  preliminarySeverity: severity,
  escalationRisk: escalation,
  clusters,
  reasoningTrace: trace,
  verified: true,
  method: 'cot_rules',
};

const { score } = scoreDetectionConfidence(report, clusters, signals, true);

console.log('Crisis type:', type);
console.log('Candidate:', candidate?.title);
console.log('Severity:', severity);
console.log('Escalation:', escalation.predictedEscalationLevel, escalation.score);
console.log('Confidence:', score);
console.log('CoT steps:', trace.length);
console.log('Step 6 conclusion:', trace[5]?.conclusion);
