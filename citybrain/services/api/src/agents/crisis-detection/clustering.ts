import { v4 as uuid } from 'uuid';
import type { Signal } from '@citybrain/shared';
import type { SignalCluster } from '@citybrain/shared';
import type { ExtractedSignalIntelligence } from '@citybrain/shared';

export interface EnrichedSignal extends Signal {
  intelligence?: ExtractedSignalIntelligence;
}

const CLUSTER_RADIUS_KM = 2.5;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function spreadKm(signals: EnrichedSignal[]): number {
  if (signals.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < signals.length; i++) {
    for (let j = i + 1; j < signals.length; j++) {
      const a = signals[i].location;
      const b = signals[j].location;
      if (a && b) max = Math.max(max, haversineKm(a, b));
    }
  }
  return Math.round(max * 100) / 100;
}

function centroidOf(signals: EnrichedSignal[]): { lat: number; lng: number } {
  const withLoc = signals.filter((s) => s.location?.lat != null && s.location?.lng != null);
  if (withLoc.length === 0) return { lat: 33.6844, lng: 73.0479 };
  const lat = withLoc.reduce((a, s) => a + s.location!.lat, 0) / withLoc.length;
  const lng = withLoc.reduce((a, s) => a + s.location!.lng, 0) / withLoc.length;
  return { lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4 };
}

function dominantEventType(signals: EnrichedSignal[]): string {
  const counts = new Map<string, number>();
  for (const s of signals) {
    const t = s.intelligence?.event_type ?? 'unknown';
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  let best = 'unknown';
  let max = 0;
  for (const [k, v] of counts) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function countRepeatedComplaints(signals: EnrichedSignal[]): number {
  const byArea = new Map<string, number>();
  for (const s of signals) {
    const key = (
      s.intelligence?.location ||
      s.areaLabel ||
      s.intelligence?.event_type ||
      'general'
    ).toLowerCase();
    byArea.set(key, (byArea.get(key) ?? 0) + 1);
  }
  return [...byArea.values()].filter((c) => c >= 2).reduce((a, c) => a + c, 0);
}

function hasStrandedIndicators(s: EnrichedSignal): boolean {
  const text = s.rawText.toLowerCase();
  const intel = s.intelligence;
  if (intel?.requires_immediate_attention) return true;
  if (intel?.affected_entities?.includes('vehicles')) return true;
  return /\b(stuck|trapped|phans|stranded|cars?\s+stuck)\b/i.test(text);
}

/**
 * Geographic clustering + complaint repetition + channel indicators.
 */
export function analyzeSignalClusters(signals: EnrichedSignal[]): SignalCluster[] {
  if (signals.length === 0) return [];

  const unassigned = [...signals];
  const clusters: SignalCluster[] = [];

  while (unassigned.length > 0) {
    const seed = unassigned.shift()!;
    const group: EnrichedSignal[] = [seed];
    const seedLoc = seed.location ?? { lat: 33.6844, lng: 73.0479 };

    for (let i = unassigned.length - 1; i >= 0; i--) {
      const s = unassigned[i];
      const sameArea =
        seed.areaLabel &&
        s.areaLabel &&
        seed.areaLabel.toLowerCase() === s.areaLabel.toLowerCase();
      const near =
        s.location && haversineKm(seedLoc, s.location) <= CLUSTER_RADIUS_KM;
      const sameIntelArea =
        seed.intelligence?.location &&
        s.intelligence?.location &&
        seed.intelligence.location.toLowerCase() === s.intelligence.location.toLowerCase();

      if (sameArea || near || sameIntelArea) {
        group.push(s);
        unassigned.splice(i, 1);
      }
    }

    const areaLabel =
      group.find((s) => s.areaLabel)?.areaLabel ??
      group.find((s) => s.intelligence?.location)?.intelligence?.location ??
      'Unknown zone';

    const sources = [...new Set(group.map((s) => s.source))];
    const weatherCount = group.filter((s) => s.source === 'weather').length;
    const trafficCount = group.filter((s) => s.source === 'traffic').length;
    const strandedCount = group.filter(hasStrandedIndicators).length;

    clusters.push({
      id: uuid(),
      areaLabel,
      centroid: centroidOf(group),
      signalIds: group.map((s) => s.id!).filter(Boolean),
      size: group.length,
      dominantEventType: dominantEventType(group),
      geographicSpreadKm: spreadKm(group),
      repeatedComplaintCount: countRepeatedComplaints(group),
      avgConfidence:
        group.reduce((a, s) => a + (s.confidence ?? s.intelligence?.confidence_score ?? 0.5), 0) /
        group.length,
      sources,
      hasWeatherAlert: weatherCount > 0,
      hasCongestionSpike:
        trafficCount > 0 ||
        group.some((s) => /\b(congestion|jam|standstill|stuck)\b/i.test(s.rawText)),
      strandedVehicleSignals: strandedCount,
    });
  }

  return clusters.sort((a, b) => b.size - a.size);
}
