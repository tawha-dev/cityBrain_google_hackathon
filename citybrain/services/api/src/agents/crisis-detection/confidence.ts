import type { CrisisDetectionReport, SignalCluster } from '@citybrain/shared';
import type { EnrichedSignal } from './clustering.js';

export interface DetectionConfidenceFactors {
  clusterCohesion: number;
  typeAgreement: number;
  sourceDiversity: number;
  evidenceStrength: number;
  memoryBoost: number;
}

export function scoreDetectionConfidence(
  report: Omit<CrisisDetectionReport, 'confidence'>,
  clusters: SignalCluster[],
  signals: EnrichedSignal[],
  hasMemoryMatch: boolean
): { score: number; factors: DetectionConfidenceFactors } {
  const primary = clusters[0];

  const clusterCohesion = primary
    ? Math.min(1, primary.size / 4) * (primary.geographicSpreadKm < 3 ? 1 : 0.7)
    : 0.4;

  const types = new Set(
    signals.map((s) => s.intelligence?.event_type).filter((t) => t && t !== 'unknown')
  );
  const typeAgreement =
    types.size <= 1 ? 0.9 : types.size === 2 ? 0.65 : 0.45;

  const allSources = new Set(signals.map((s) => s.source));
  const sourceDiversity = Math.min(1, allSources.size / 3) * 0.85 + 0.15;

  let evidenceStrength = 0.5;
  if (primary?.hasWeatherAlert) evidenceStrength += 0.15;
  if (primary?.hasCongestionSpike) evidenceStrength += 0.15;
  if (primary && primary.repeatedComplaintCount >= 2) evidenceStrength += 0.1;
  if (primary && primary.strandedVehicleSignals > 0) evidenceStrength += 0.1;
  evidenceStrength = Math.min(1, evidenceStrength);

  const memoryBoost = hasMemoryMatch ? 0.08 : 0;

  const factors: DetectionConfidenceFactors = {
    clusterCohesion,
    typeAgreement,
    sourceDiversity,
    evidenceStrength,
    memoryBoost,
  };

  let score =
    0.3 * clusterCohesion +
    0.25 * typeAgreement +
    0.2 * sourceDiversity +
    0.2 * evidenceStrength +
    0.05 * (memoryBoost > 0 ? 1 : 0.5);

  if (!report.candidate) score = Math.min(score, 0.45);
  if (report.verified) score = Math.min(1, score + 0.05);
  if (report.method === 'cot_rules') score *= 0.94;

  return { score: Math.round(Math.min(1, Math.max(0, score)) * 100) / 100, factors };
}
