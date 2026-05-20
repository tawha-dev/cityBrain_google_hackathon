import type { CrisisCandidate, CrisisType } from '@citybrain/shared';
import type { SignalCluster } from '@citybrain/shared';
import type { EnrichedSignal } from './clustering.js';

const EVENT_TO_CRISIS: Record<string, CrisisType> = {
  flood: 'flood',
  heatwave: 'heatwave',
  accident: 'accident',
  infrastructure_failure: 'infrastructure_failure',
  road_blockage: 'road_blockage',
  fire: 'infrastructure_failure',
  unknown: 'flood',
};

const SCENARIO_DEFAULTS: Record<
  string,
  Pick<CrisisCandidate, 'type' | 'title' | 'areaLabel' | 'centroid' | 'summary'>
> = {
  karachi_flood: {
    type: 'flood',
    title: 'Urban Flooding — Karachi (Heavy Rainfall)',
    areaLabel: 'Clifton / Saddar Corridor',
    centroid: { lat: 24.8607, lng: 67.0011 },
    summary:
      'Severe urban flooding cluster — PMD extreme rainfall, drain gauge breach, social distress across Clifton–Saddar',
  },
  g10_flood: {
    type: 'flood',
    title: 'Urban Flooding — G-10',
    areaLabel: 'G-10 Markaz',
    centroid: { lat: 33.6702, lng: 73.0213 },
    summary: 'Flash flood cluster from social, weather, and traffic convergence',
  },
  margalla_heat: {
    type: 'heatwave',
    title: 'Extreme Heat Event — Margalla Hills',
    areaLabel: 'Margalla Sector',
    centroid: { lat: 33.738, lng: 73.06 },
    summary: 'Heat stress indicators across weather and hospital load signals',
  },
  srinagar_accident: {
    type: 'accident',
    title: 'Multi-Vehicle Accident — Srinagar Highway',
    areaLabel: 'Srinagar Highway',
    centroid: { lat: 33.652, lng: 73.089 },
    summary: 'Collision cluster with traffic standstill and stranded vehicles',
  },
  i9_grid: {
    type: 'infrastructure_failure',
    title: 'Grid Failure — I-9 Industrial',
    areaLabel: 'I-9 Industrial Area',
    centroid: { lat: 33.648, lng: 73.042 },
    summary: 'Power infrastructure failure affecting traffic systems',
  },
  faiz_road_block: {
    type: 'road_blockage',
    title: 'Road Blockage — Faiz Road',
    areaLabel: 'Faiz Road',
    centroid: { lat: 33.699, lng: 73.055 },
    summary: 'Sustained blockage with congestion propagation',
  },
};

export function classifyCrisisType(
  clusters: SignalCluster[],
  signals: EnrichedSignal[]
): CrisisType {
  const votes = new Map<CrisisType, number>();

  for (const c of clusters) {
    const mapped = EVENT_TO_CRISIS[c.dominantEventType] ?? 'flood';
    votes.set(mapped, (votes.get(mapped) ?? 0) + c.size * 2);
  }

  for (const s of signals) {
    const t = s.intelligence?.event_type;
    if (t && t !== 'unknown') {
      const mapped = EVENT_TO_CRISIS[t] ?? 'flood';
      votes.set(mapped, (votes.get(mapped) ?? 0) + 1);
    }
  }

  let best: CrisisType = 'flood';
  let max = 0;
  for (const [k, v] of votes) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

export function buildCrisisCandidate(
  type: CrisisType,
  clusters: SignalCluster[],
  signals: EnrichedSignal[],
  scenarioKey?: string,
  confidence = 0.75
): CrisisCandidate | null {
  const primary = clusters[0];
  const scenario = scenarioKey ? SCENARIO_DEFAULTS[scenarioKey] : undefined;

  if (!primary && !scenario) {
    if (signals.length === 0) return null;
    return {
      type,
      title: `Emerging ${type.replace('_', ' ')} — Islamabad`,
      areaLabel: 'Islamabad',
      centroid: signals[0].location ?? { lat: 33.6844, lng: 73.0479 },
      signalIds: signals.map((s) => s.id!).filter(Boolean),
      confidence,
      summary: 'Multi-signal anomaly detected without tight geographic cluster',
    };
  }

  if (scenario && (!primary || primary.size < 2)) {
    return {
      ...scenario,
      type: scenario.type,
      signalIds: signals.map((s) => s.id!).filter(Boolean),
      confidence: Math.max(confidence, 0.85),
    };
  }

  const titleMap: Record<CrisisType, string> = {
    flood: `Urban Flooding — ${primary!.areaLabel}`,
    heatwave: `Heat Event — ${primary!.areaLabel}`,
    accident: `Traffic Incident — ${primary!.areaLabel}`,
    infrastructure_failure: `Infrastructure Failure — ${primary!.areaLabel}`,
    road_blockage: `Road Blockage — ${primary!.areaLabel}`,
  };

  return {
    type,
    title: titleMap[type],
    areaLabel: primary!.areaLabel,
    centroid: primary!.centroid,
    signalIds: clusters.flatMap((c) => c.signalIds),
    confidence,
    summary: buildSummary(type, primary!, clusters),
  };
}

function buildSummary(type: CrisisType, primary: SignalCluster, clusters: SignalCluster[]): string {
  const parts = [
    `${clusters.length} cluster(s), ${primary.size} signals in primary zone`,
    primary.hasWeatherAlert ? 'weather alert present' : null,
    primary.hasCongestionSpike ? 'congestion spike detected' : null,
    primary.repeatedComplaintCount >= 2 ? 'repeated complaints' : null,
    primary.strandedVehicleSignals > 0 ? `${primary.strandedVehicleSignals} stranded-vehicle signal(s)` : null,
  ].filter(Boolean);
  return `${type.replace('_', ' ')} crisis: ${parts.join('; ')}`;
}
