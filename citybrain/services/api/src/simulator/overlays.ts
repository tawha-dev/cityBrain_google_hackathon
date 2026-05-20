import { v4 as uuid } from 'uuid';
import type { MapOverlay } from '@citybrain/shared';
import type { SimulationWorld } from './world.js';
import { floodSpreadRate } from './models/flood.js';

/** Build map overlay layers for a simulation frame */
export function buildMapOverlays(world: SimulationWorld): MapOverlay[] {
  const overlays: MapOverlay[] = [];
  const c = world.centroid;

  overlays.push({
    id: 'hotspot-centroid',
    type: 'emergency_hotspot',
    label: world.areaLabel,
    geometry: { kind: 'point', coordinates: [c] },
    style: { color: '#FF3B5C', opacity: 1, pulse: true },
    metadata: { crisisType: world.crisisType, phase: world.phase },
  });

  if (world.crisisType === 'flood' && world.floodRadiusM > 0) {
    const spread = floodSpreadRate(world);
    overlays.push({
      id: uuid(),
      type: 'flood_zone',
      label: `Flood — ${spread}`,
      geometry: {
        kind: 'circle',
        coordinates: [c],
        radiusMeters: world.floodRadiusM,
      },
      style: {
        color: spread === 'expanding' ? '#0066FF' : '#00AA88',
        opacity: spread === 'expanding' ? 0.45 : 0.3,
        pulse: spread === 'expanding',
      },
      metadata: { spread, radiusM: world.floodRadiusM },
    });
  }

  overlays.push({
    id: uuid(),
    type: 'congestion_corridor',
    label: `Congestion ${(world.congestionIndex * 100).toFixed(0)}%`,
    geometry: {
      kind: 'polyline',
      coordinates: buildCongestionCorridor(c),
    },
    style: {
      color: congestionColor(world.congestionIndex),
      opacity: 0.75,
      weight: 4 + world.congestionIndex * 6,
    },
    metadata: { index: world.congestionIndex },
  });

  for (const route of world.routes.filter((r) => r.active)) {
    overlays.push({
      id: uuid(),
      type: 'reroute_path',
      label: 'Active detour',
      geometry: { kind: 'polyline', coordinates: route.polyline },
      style: { color: '#00FFC6', opacity: 0.9, weight: 5 },
      metadata: { congestionDelta: route.congestionDelta },
    });
  }

  if (world.alertReach > 0) {
    overlays.push({
      id: uuid(),
      type: 'alert_zone',
      label: 'Alert coverage',
      geometry: {
        kind: 'circle',
        coordinates: [c],
        radiusMeters: 1500 + world.alertReach / 50,
      },
      style: { color: '#FFB020', opacity: 0.2, pulse: true },
    });
  }

  if (world.crisisType === 'road_blockage') {
    overlays.push({
      id: uuid(),
      type: 'closed_road',
      label: 'Blocked corridor',
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

  for (const unit of world.rescueUnits) {
    overlays.push({
      id: uuid(),
      type: 'rescue_unit',
      label: `${unit.id} (${unit.status})`,
      geometry: {
        kind: 'point',
        coordinates: [{ lat: unit.lat, lng: unit.lng }],
      },
      style: {
        color: unit.status === 'on_scene' ? '#00FF88' : '#FF3B5C',
        opacity: 1,
      },
      metadata: { unitType: unit.type, eta: unit.etaMinutes },
    });
  }

  return overlays;
}

function buildCongestionCorridor(c: { lat: number; lng: number }) {
  return [
    { lat: c.lat - 0.01, lng: c.lng - 0.015 },
    { lat: c.lat, lng: c.lng },
    { lat: c.lat + 0.008, lng: c.lng + 0.012 },
    { lat: c.lat + 0.015, lng: c.lng + 0.02 },
  ];
}

function congestionColor(index: number): string {
  if (index >= 0.8) return '#FF3B5C';
  if (index >= 0.55) return '#FFB020';
  return '#00FFC6';
}
