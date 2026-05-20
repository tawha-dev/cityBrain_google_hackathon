import type { SimulationWorld } from '../world.js';

/** Traffic congestion diffusion along crisis corridor */
export function stepTraffic(world: SimulationWorld, dtMinutes: number): void {
  const mitigating = world.phase === 'mitigating' || world.phase === 'stabilized';
  const rerouteHelp = world.rerouteAdoption * 0.35;

  if (mitigating) {
    world.congestionIndex = Math.max(
      0.28,
      world.congestionIndex - (0.04 + rerouteHelp) * dtMinutes
    );
  } else if (world.crisisType === 'flood' || world.crisisType === 'road_blockage') {
    world.congestionIndex = Math.min(
      0.98,
      world.congestionIndex + 0.015 * dtMinutes
    );
  }

  world.strandedVehicles = Math.max(
    0,
    Math.round(
      world.strandedVehicles -
        (mitigating ? 3 * dtMinutes * (1 + rerouteHelp) : 0.5 * dtMinutes)
    )
  );
}

export function activateRerouteImpact(world: SimulationWorld, congestionDelta: number): void {
  world.rerouteAdoption = Math.min(1, world.rerouteAdoption + 0.35);
  world.congestionIndex = Math.max(
    0.25,
    world.congestionIndex + congestionDelta
  );
  for (const r of world.routes) {
    r.active = true;
  }
}
