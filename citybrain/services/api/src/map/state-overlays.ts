import { v4 as uuid } from 'uuid';
import type { CrisisRunState, MapOverlay } from '@citybrain/shared';

/** Build typed map overlays from pipeline crisis state (execution / reroute snapshots). */
export function buildMapOverlaysFromState(
  state: CrisisRunState,
  after = false
): MapOverlay[] {
  const overlays: MapOverlay[] = [];
  const c = state.candidate?.centroid ?? { lat: 33.6844, lng: 73.0479 };
  const type = state.candidate?.type ?? 'flood';

  overlays.push({
    id: 'hotspot-centroid',
    type: 'emergency_hotspot',
    label: state.candidate?.title ?? 'Crisis epicenter',
    geometry: { kind: 'point', coordinates: [c] },
    style: { color: '#FF3B5C', opacity: 1, pulse: true },
    metadata: {
      severity: state.severity?.level,
      impactLevel: after ? 'reduced' : 'critical',
    },
  });

  if (type === 'flood') {
    overlays.push({
      id: 'flood-primary',
      type: 'flood_zone',
      label: after ? 'Flood — receding' : 'Flood — active',
      geometry: {
        kind: 'circle',
        coordinates: [c],
        radiusMeters: after ? 320 : 480,
      },
      style: {
        color: after ? '#00AA88' : '#0066FF',
        opacity: after ? 0.28 : 0.42,
        pulse: !after,
      },
    });
  }

  const congestion = state.severity?.estimatedImpact?.congestionIndex ?? 0.75;
  overlays.push({
    id: 'congestion-main',
    type: 'congestion_corridor',
    label: `Congestion ${(congestion * 100).toFixed(0)}%`,
    geometry: {
      kind: 'polyline',
      coordinates: [
        { lat: c.lat - 0.01, lng: c.lng - 0.015 },
        { lat: c.lat, lng: c.lng },
        { lat: c.lat + 0.008, lng: c.lng + 0.012 },
        { lat: c.lat + 0.015, lng: c.lng + 0.02 },
      ],
    },
    style: {
      color: congestion >= 0.8 ? '#FF3B5C' : congestion >= 0.55 ? '#FFB020' : '#00FFC6',
      opacity: 0.78,
      weight: 4 + congestion * 6,
    },
    metadata: { index: congestion },
  });

  for (const route of state.routes ?? []) {
    overlays.push({
      id: route.id ?? uuid(),
      type: 'reroute_path',
      label: 'Active detour',
      geometry: { kind: 'polyline', coordinates: route.alternatePolyline },
      style: { color: '#00FFC6', opacity: 0.92, weight: 5 },
      metadata: { congestionDelta: route.congestionDelta },
    });
  }

  if (type === 'road_blockage') {
    overlays.push({
      id: 'closed-segment',
      type: 'closed_road',
      label: 'Road closure',
      geometry: {
        kind: 'polyline',
        coordinates: [
          { lat: c.lat - 0.004, lng: c.lng - 0.006 },
          { lat: c.lat + 0.004, lng: c.lng + 0.006 },
        ],
      },
      style: { color: '#FF3B5C', opacity: 0.95, weight: 7 },
    });
  }

  for (const unit of state.resources ?? []) {
    overlays.push({
      id: unit.unitId ?? uuid(),
      type: 'rescue_unit',
      label: `${unit.type} — ${unit.task}`,
      geometry: {
        kind: 'point',
        coordinates: [{ lat: unit.lat, lng: unit.lng }],
      },
      style: {
        color: '#00FF88',
        opacity: 1,
      },
      metadata: { eta: unit.etaMinutes },
    });
  }

  const reach = state.alerts?.[0]?.reachEstimate ?? 0;
  if (reach > 0) {
    overlays.push({
      id: 'alert-coverage',
      type: 'alert_zone',
      label: 'Citizen alert coverage',
      geometry: {
        kind: 'circle',
        coordinates: [c],
        radiusMeters: 1200 + reach / 80,
      },
      style: { color: '#FFB020', opacity: 0.18, pulse: true },
      metadata: { reach },
    });
  }

  return overlays;
}

export function buildMapDeltaPayload(state: CrisisRunState, after = false) {
  const c = state.candidate?.centroid ?? { lat: 33.6844, lng: 73.0479 };
  const base = state.severity?.estimatedImpact;
  return {
    centroid: c,
    overlays: buildMapOverlaysFromState(state, after),
    routes: state.routes ?? [],
    resources: state.resources ?? [],
    alerts: state.alerts ?? [],
    metrics: {
      congestionIndex: base?.congestionIndex ?? 0.75,
      strandedVehicles: base?.strandedVehicles ?? 0,
      resourcesDeployed: state.resources?.length ?? 0,
    },
    impactLevel: after ? 'reduced' : 'critical',
  };
}
