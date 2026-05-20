import type { SimulationPhase } from '@citybrain/shared';
import type { SimulationWorld } from './world.js';

const ALLOWED: Record<SimulationPhase, SimulationPhase[]> = {
  idle: ['crisis_active'],
  crisis_active: ['response_deployed', 'mitigating'],
  response_deployed: ['mitigating', 'stabilized'],
  mitigating: ['stabilized'],
  stabilized: ['replay'],
  replay: ['replay'],
};

export function canTransition(from: SimulationPhase, to: SimulationPhase): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transitionPhase(
  world: SimulationWorld,
  to: SimulationPhase,
  reason: string
): boolean {
  if (!canTransition(world.phase, to) && world.phase !== to) {
    if (to === 'mitigating' && world.phase === 'response_deployed') {
      world.phase = to;
      return true;
    }
    return false;
  }
  world.phase = to;
  return true;
}

export function applyExecutionTransition(
  world: SimulationWorld,
  actionType: string,
  success: boolean
): SimulationPhase {
  if (!success) return world.phase;

  if (actionType === 'traffic_reroute') {
    transitionPhase(world, 'mitigating', 'reroute_applied');
  } else if (actionType === 'dispatch_emergency' || actionType === 'deploy_pumps') {
    transitionPhase(world, 'response_deployed', 'units_dispatched');
  } else if (actionType === 'citizen_alert') {
    /* alerts don't change phase alone */
  }

  if (world.congestionIndex < 0.42 && world.floodRadiusM < 700) {
    transitionPhase(world, 'stabilized', 'thresholds_met');
  }

  return world.phase;
}
