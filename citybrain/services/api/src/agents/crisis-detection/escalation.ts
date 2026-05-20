import type { CrisisType, EscalationLevel } from '@citybrain/shared';
import type { EscalationRisk, SignalCluster } from '@citybrain/shared';
import type { EnrichedSignal } from './clustering.js';

export function predictEscalationRisk(
  crisisType: CrisisType,
  clusters: SignalCluster[],
  signals: EnrichedSignal[],
  traffic: { congestionIndex?: number },
  weather: { condition?: string; rainfallMm?: number; temperatureC?: number }
): EscalationRisk {
  const primary = clusters[0];
  const factors: string[] = [];
  let score = 0.25;

  if (primary?.hasWeatherAlert) {
    factors.push('official_weather_alert');
    score += 0.2;
  }
  if (weather.condition === 'heavy_rain' || (weather.rainfallMm ?? 0) > 30) {
    factors.push('heavy_rainfall_forecast');
    score += 0.15;
  }
  if (weather.temperatureC != null && weather.temperatureC >= 42) {
    factors.push('extreme_heat');
    score += 0.15;
  }

  const congestion = Number(traffic.congestionIndex ?? 0);
  if (congestion >= 0.75 || primary?.hasCongestionSpike) {
    factors.push('congestion_spike');
    score += 0.18;
  }

  const repeated = clusters.reduce((a, c) => a + c.repeatedComplaintCount, 0);
  if (repeated >= 2) {
    factors.push('repeated_complaints');
    score += 0.12;
  }

  const stranded = clusters.reduce((a, c) => a + c.strandedVehicleSignals, 0);
  if (stranded > 0) {
    factors.push('stranded_vehicles_reported');
    score += 0.15 * Math.min(stranded, 3);
  }

  if (primary && primary.size >= 3) {
    factors.push('geographic_cluster_density');
    score += 0.1;
  }

  const immediate = signals.filter((s) => s.intelligence?.requires_immediate_attention).length;
  if (immediate >= 2) {
    factors.push('multiple_immediate_attention_flags');
    score += 0.12;
  }

  if (crisisType === 'flood' || crisisType === 'infrastructure_failure') {
    factors.push('high_impact_crisis_class');
    score += 0.08;
  }

  score = Math.min(1, score);

  let level: EscalationRisk['level'] = 'low';
  if (score >= 0.82) level = 'imminent';
  else if (score >= 0.62) level = 'high';
  else if (score >= 0.4) level = 'medium';

  const predictedEscalationLevel = mapToEscalationLevel(level, crisisType);

  return {
    level,
    score: Math.round(score * 100) / 100,
    predictedEscalationLevel,
    factors,
    rationale: buildRationale(level, factors, stranded, congestion),
    timeHorizonMinutes: level === 'imminent' ? 15 : level === 'high' ? 45 : 120,
  };
}

function mapToEscalationLevel(
  risk: EscalationRisk['level'],
  crisisType: CrisisType
): EscalationLevel {
  if (risk === 'imminent') return 'critical';
  if (risk === 'high') {
    return crisisType === 'heatwave' ? 'operational' : 'critical';
  }
  if (risk === 'medium') return 'operational';
  return 'watch';
}

function buildRationale(
  level: EscalationRisk['level'],
  factors: string[],
  stranded: number,
  congestion: number
): string {
  return (
    `Escalation risk ${level}: ${factors.slice(0, 4).join(', ') || 'baseline monitoring'}. ` +
    `Stranded vehicle signals: ${stranded}. Congestion index: ${congestion.toFixed(2)}.`
  );
}

export function inferPreliminarySeverity(
  crisisType: CrisisType,
  escalation: EscalationRisk,
  clusters: SignalCluster[]
): 'low' | 'medium' | 'high' | 'critical' {
  const stranded = clusters.reduce((a, c) => a + c.strandedVehicleSignals, 0);

  if (escalation.level === 'imminent' || stranded >= 2) return 'critical';
  if (escalation.level === 'high' || crisisType === 'flood') return 'high';
  if (escalation.level === 'medium') return 'medium';
  return crisisType === 'heatwave' ? 'medium' : 'low';
}
