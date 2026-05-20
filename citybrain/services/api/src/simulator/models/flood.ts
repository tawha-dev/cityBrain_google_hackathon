import type { SimulationWorld } from '../world.js';

/** Flood spread from centroid — radius grows until pumps/mitigation */
export function stepFlood(world: SimulationWorld, dtMinutes: number): void {
  if (world.crisisType !== 'flood') return;

  const mitigating = world.phase === 'mitigating' || world.phase === 'stabilized';
  const pumpUnits = world.rescueUnits.filter((u) => u.type === 'pump' && u.progress > 0.5).length;

  if (mitigating && pumpUnits > 0) {
    world.floodRadiusM = Math.max(200, world.floodRadiusM - 80 * dtMinutes);
  } else {
    world.floodRadiusM = Math.min(2200, world.floodRadiusM + 120 * dtMinutes);
  }
}

export function floodSpreadRate(world: SimulationWorld): 'expanding' | 'stable' | 'receding' {
  if (world.crisisType !== 'flood') return 'stable';
  if (world.floodRadiusM > 1800) return 'expanding';
  if (world.floodRadiusM < 600) return 'receding';
  return 'stable';
}
