import type { SimulationWorld } from '../world.js';

/** Rescue unit movement toward targets */
export function stepRescue(world: SimulationWorld, dtMinutes: number): void {
  const speed = 0.12 * dtMinutes;

  for (const unit of world.rescueUnits) {
    if (unit.progress >= 1) {
      unit.status = 'on_scene';
      continue;
    }

    unit.progress = Math.min(1, unit.progress + speed / Math.max(1, unit.etaMinutes / 10));
    unit.lat = unit.lat + (unit.targetLat - unit.lat) * speed;
    unit.lng = unit.lng + (unit.targetLng - unit.lng) * speed;

    if (unit.progress >= 0.95) unit.status = 'on_scene';
    else if (unit.progress > 0.2) unit.status = 'en_route';
  }
}

export function dispatchSecondaryTeams(world: SimulationWorld): void {
  const c = world.centroid;
  world.rescueUnits.push({
    id: `RES-${world.rescueUnits.length + 1}`,
    type: 'rescue',
    lat: c.lat - 0.025,
    lng: c.lng - 0.02,
    targetLat: c.lat,
    targetLng: c.lng,
    progress: 0,
    etaMinutes: 12,
    status: 'dispatched',
  });
}
