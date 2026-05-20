import { SCENARIOS, type Scenario } from '../../seed/scenarios.js';
import { computeValidationScore } from '../citizen-ingest/validation-score.js';

const CRISIS_TO_CITIZEN_CATEGORY: Record<Scenario['crisisType'], string> = {
  flood: 'flood',
  heatwave: 'storm',
  accident: 'accident',
  infrastructure_failure: 'fire',
  road_blockage: 'accident',
};

const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  karachi_flood:
    'Cinematic Karachi rain flood — Clifton/Saddar, PMD alert, drain breach, rescue surge',
  g10_flood: 'Islamabad G-10 urban flood — Roman Urdu social + rain + traffic spike',
  margalla_heat: 'Extreme heat — Margalla sector, hospital surge, trail distress',
  srinagar_accident: 'Multi-vehicle collision — Srinagar Highway standstill',
  i9_grid: 'Industrial grid failure — I-9 substation, traffic signals failing',
  faiz_road_block: 'Faiz Road blocked — overturned truck, heavy congestion',
};

export function mapScenarioToCitizenCategory(crisisType: Scenario['crisisType']): string {
  return CRISIS_TO_CITIZEN_CATEGORY[crisisType] ?? 'other';
}

export function pickPrimaryCitizenSignal(scenario: Scenario) {
  const field = scenario.signals.find((s) => s.source === 'field_report');
  if (field) return field;
  return scenario.signals.reduce((best, s) => (s.confidence > best.confidence ? s : best));
}

export function averageSignalConfidence(scenario: Scenario): number {
  if (!scenario.signals.length) return 0.85;
  return scenario.signals.reduce((sum, s) => sum + s.confidence, 0) / scenario.signals.length;
}

/** Estimated validation % when demo enrichment runs (for mobile UI badges). */
export function estimateDemoValidationPercent(scenario: Scenario): number {
  const hasWeather = scenario.signals.some((s) => s.source === 'weather');
  const social = scenario.signals.filter((s) => s.source === 'social');
  const socialScore = social.length
    ? Math.max(...social.map((s) => s.confidence))
    : 0.88;
  const newsHits = Math.max(2, Math.min(3, social.length + (hasWeather ? 1 : 0)));

  return computeValidationScore({
    geocoded: true,
    weatherCorroborates: hasWeather,
    newsHits,
    socialScore,
    agentConfidence: averageSignalConfidence(scenario),
  }).total;
}

export interface CitizenDemoScenarioSummary {
  key: string;
  title: string;
  areaLabel: string;
  category: string;
  crisisType: Scenario['crisisType'];
  expectedConfidence: number;
  signalCount: number;
  featured: boolean;
  description: string;
}

export function listCitizenDemoScenarios(): CitizenDemoScenarioSummary[] {
  return Object.entries(SCENARIOS).map(([key, scenario]) => ({
    key,
    title: scenario.title,
    areaLabel: scenario.areaLabel,
    category: mapScenarioToCitizenCategory(scenario.crisisType),
    crisisType: scenario.crisisType,
    expectedConfidence: estimateDemoValidationPercent(scenario),
    signalCount: scenario.signals.length,
    featured: key === 'karachi_flood' || key === 'g10_flood',
    description: SCENARIO_DESCRIPTIONS[key] ?? scenario.title,
  }));
}

export function getCitizenDemoScenario(key: string): Scenario | undefined {
  return SCENARIOS[key];
}
