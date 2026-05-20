import type { SimulationFrame } from '@citybrain/shared';
import type { SimulationWorld } from './world.js';
import { buildMapOverlays } from './overlays.js';
import { buildMetrics } from './world.js';

/** Produce a renderable frame from world state */
export function worldToFrame(world: SimulationWorld): SimulationFrame {
  const simMin = world.simTimeMs / 60000;
  world.metrics = buildMetrics(
    simMin,
    world.congestionIndex,
    world.strandedVehicles,
    world.crisisType,
    world.rescueUnits.filter((u) => u.status !== 'dispatched').length,
    world.rerouteAdoption,
    world.alertReach
  );

  return {
    tick: world.tick,
    simTimeMs: world.simTimeMs,
    phase: world.phase,
    metrics: world.metrics,
    overlays: buildMapOverlays(world),
    units: world.rescueUnits.map((u) => ({
      id: u.id,
      type: u.type,
      position: { lat: u.lat, lng: u.lng },
      heading: bearing(u.lat, u.lng, u.targetLat, u.targetLng),
      status: u.status,
    })),
  };
}

/** Interpolate between two frames for smooth replay (0–1) */
export function lerpFrames(
  a: SimulationFrame,
  b: SimulationFrame,
  t: number
): SimulationFrame {
  const clamp = Math.max(0, Math.min(1, t));
  return {
    tick: a.tick,
    simTimeMs: a.simTimeMs + (b.simTimeMs - a.simTimeMs) * clamp,
    phase: clamp < 0.5 ? a.phase : b.phase,
    metrics: {
      simTimeMinutes:
        a.metrics.simTimeMinutes +
        (b.metrics.simTimeMinutes - a.metrics.simTimeMinutes) * clamp,
      congestionIndex:
        a.metrics.congestionIndex +
        (b.metrics.congestionIndex - a.metrics.congestionIndex) * clamp,
      floodCoverageKm2:
        a.metrics.floodCoverageKm2 +
        (b.metrics.floodCoverageKm2 - a.metrics.floodCoverageKm2) * clamp,
      strandedVehicles: Math.round(
        a.metrics.strandedVehicles +
          (b.metrics.strandedVehicles - a.metrics.strandedVehicles) * clamp
      ),
      activeRescueUnits: b.metrics.activeRescueUnits,
      avgRescueEtaMinutes:
        a.metrics.avgRescueEtaMinutes +
        (b.metrics.avgRescueEtaMinutes - a.metrics.avgRescueEtaMinutes) * clamp,
      rerouteAdoptionPct: Math.round(
        a.metrics.rerouteAdoptionPct +
          (b.metrics.rerouteAdoptionPct - a.metrics.rerouteAdoptionPct) * clamp
      ),
      alertsReach: Math.round(
        a.metrics.alertsReach +
          (b.metrics.alertsReach - a.metrics.alertsReach) * clamp
      ),
    },
    overlays: clamp < 0.5 ? a.overlays : b.overlays,
    units: a.units.map((u, i) => {
      const v = b.units[i];
      if (!v) return u;
      return {
        ...u,
        position: {
          lat: u.position.lat + (v.position.lat - u.position.lat) * clamp,
          lng: u.position.lng + (v.position.lng - u.position.lng) * clamp,
        },
      };
    }),
  };
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
