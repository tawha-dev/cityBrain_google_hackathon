import type { SimulationWorld } from '../world.js';
import type { SimulationPhase } from '@citybrain/shared';

const TICK_MINUTES = 2;

export function advanceSimClock(world: SimulationWorld): number {
  world.tick += 1;
  world.simTimeMs += TICK_MINUTES * 60 * 1000;
  return TICK_MINUTES;
}

export function computeResponseTiming(world: SimulationWorld): {
  timeToFirstUnitMinutes: number;
  timeToStabilizeEstimate: number;
} {
  const enRoute = world.rescueUnits.filter((u) => u.status !== 'dispatched');
  const firstUnit = world.rescueUnits.reduce(
    (min, u) => Math.min(min, u.etaMinutes * (1 - u.progress)),
    999
  );

  const stabilize =
    world.phase === 'stabilized'
      ? world.metrics.simTimeMinutes
      : world.metrics.simTimeMinutes +
        world.congestionIndex * 25 +
        (world.crisisType === 'flood' ? world.floodRadiusM / 100 : 10);

  return {
    timeToFirstUnitMinutes: firstUnit === 999 ? 0 : Math.round(firstUnit),
    timeToStabilizeEstimate: Math.round(stabilize),
  };
}

export function inferPhaseFromProgress(
  world: SimulationWorld,
  actionIndex: number,
  totalActions: number
): SimulationPhase {
  if (world.tick === 0) return 'crisis_active';
  if (actionIndex > 0 && actionIndex < totalActions) return 'response_deployed';
  if (world.congestionIndex < 0.45 && world.floodRadiusM < 800) return 'stabilized';
  if (actionIndex >= totalActions || world.tick > totalActions * 3) return 'mitigating';
  return 'response_deployed';
}
