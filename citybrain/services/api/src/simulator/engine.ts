import type { CrisisRunState, ExecutionResult, SimulationRun } from '@citybrain/shared';
import { SimulationRunSchema } from '@citybrain/shared';
import type { ToolContext } from '@citybrain/agent-tools';
import {
  runExecutionAgent,
  applyExecutionToState,
} from '../agents/execution/index.js';
import { createWorld, type SimulationWorld } from './world.js';
import { worldToFrame } from './animation.js';
import { SimulationTimeline } from './timeline.js';
import { storeSimulationRun, getSimulationRun } from './replay.js';
import {
  streamSimulationStarted,
  streamSimulationTick,
  streamSimulationFrame,
  streamSimulationCompleted,
} from './streamer.js';
import { stepTraffic, activateRerouteImpact } from './models/traffic.js';
import { stepFlood } from './models/flood.js';
import { stepRescue } from './models/rescue.js';
import { advanceSimClock, inferPhaseFromProgress, computeResponseTiming } from './models/timing.js';
import { applyExecutionTransition } from './transitions.js';
import * as repo from '../db/repository.js';

export interface SimulationOptions {
  tickDelayMs?: number;
  ticksPerAction?: number;
  stream?: boolean;
  skipExecution?: boolean;
}

const DEFAULT_TICK_DELAY = 120;
const DEFAULT_TICKS_PER_ACTION = 3;

/**
 * Full crisis simulation: optional execution + physics ticks + WS stream + replay store.
 */
export async function runSimulation(
  state: CrisisRunState,
  ctx: ToolContext,
  crisisId: string,
  options: SimulationOptions = {}
): Promise<{
  executionResults: ExecutionResult[];
  simulation: SimulationRun;
}> {
  const tickDelay = options.tickDelayMs ?? DEFAULT_TICK_DELAY;
  const ticksPerAction = options.ticksPerAction ?? DEFAULT_TICKS_PER_ACTION;
  const stream = options.stream !== false;

  let executionResults: ExecutionResult[] = [];

  if (!options.skipExecution) {
    const exec = await runExecutionAgent(state, ctx, crisisId);
    applyExecutionToState(state, exec);
    executionResults = exec.results;
  }

  const simulation = await runPhysicsSimulation(
    state,
    crisisId,
    executionResults,
    { tickDelayMs: tickDelay, ticksPerAction, stream }
  );

  return { executionResults, simulation };
}

/** Deterministic physics + overlay simulation (traffic, flood, rescue, reroute, timing) */
export async function runPhysicsSimulation(
  state: CrisisRunState,
  crisisId: string,
  executionResults: ExecutionResult[] = [],
  options: Pick<SimulationOptions, 'tickDelayMs' | 'ticksPerAction' | 'stream'> = {}
): Promise<SimulationRun> {
  const tickDelay = options.tickDelayMs ?? DEFAULT_TICK_DELAY;
  const ticksPerAction = options.ticksPerAction ?? DEFAULT_TICKS_PER_ACTION;
  const stream = options.stream !== false;
  const startedAt = new Date().toISOString();

  const world = createWorld(state, crisisId);
  const timeline = new SimulationTimeline();
  const frames: SimulationRun['frames'] = [];

  const before = worldToFrame({ ...world, phase: 'crisis_active' });
  frames.push(before);
  timeline.push(world, 'phase', 'Before response — crisis active', { metrics: before.metrics });

  if (stream) {
    streamSimulationStarted(crisisId, {
      totalTicks: Math.max(6, (state.plan?.actions.length ?? 3) * ticksPerAction),
      crisisType: world.crisisType,
    });
    streamSimulationFrame(crisisId, before);
  }

  const actions = state.plan?.actions ?? [];
  const totalTicks = Math.max(6, actions.length * ticksPerAction + 4);
  let actionIdx = 0;

  for (let t = 1; t <= totalTicks; t++) {
    const dt = advanceSimClock(world);

    if (actionIdx < actions.length && t % ticksPerAction === 0) {
      const action = actions[actionIdx];
      const result = executionResults[actionIdx];
      applyActionToWorld(world, action, result);
      timeline.push(world, 'execution', `Executed: ${action.title}`, {
        actionType: action.type,
        status: result?.status,
      });
      applyExecutionTransition(world, action.type, result?.status !== 'failed');
      actionIdx += 1;
    }

    world.phase = inferPhaseFromProgress(world, actionIdx, actions.length);
    stepFlood(world, dt);
    stepTraffic(world, dt);
    stepRescue(world, dt);

    if (t % 2 === 0) {
      timeline.push(world, 'traffic', `Congestion ${(world.congestionIndex * 100).toFixed(0)}%`, {
        index: world.congestionIndex,
      });
    }
    if (world.crisisType === 'flood' && t % 3 === 0) {
      timeline.push(world, 'flood', `Flood radius ${world.floodRadiusM}m`, {
        radiusM: world.floodRadiusM,
      });
    }

    const frame = worldToFrame(world);
    frames.push(frame);

    if (stream) {
      streamSimulationTick(crisisId, {
        tick: frame.tick,
        simTimeMs: frame.simTimeMs,
        phase: frame.phase,
        metrics: frame.metrics,
      });
      streamSimulationFrame(crisisId, frame);
      await sleep(tickDelay);
    }
  }

  transitionPhaseFinal(world);
  const after = worldToFrame(world);
  frames.push(after);

  const timing = computeResponseTiming(world);
  timeline.push(world, 'reroute', 'Simulation complete', timing);

  const run = SimulationRunSchema.parse({
    crisisId,
    scenarioKey: state.scenarioKey,
    crisisType: world.crisisType,
    phase: world.phase,
    totalTicks: frames.length,
    tickDelayMs: tickDelay,
    frames,
    timeline: timeline.toJSON(),
    before,
    after,
    startedAt,
    completedAt: new Date().toISOString(),
  });

  storeSimulationRun(run);

  await repo.createSnapshot(crisisId, 'before', before.metrics, {
    overlays: before.overlays,
    units: before.units,
    phase: 'before',
  });
  await repo.createSnapshot(crisisId, 'after', after.metrics, {
    overlays: after.overlays,
    units: after.units,
    phase: 'after',
    timeline: timeline.toJSON(),
    compare: {
      congestionDelta: after.metrics.congestionIndex - before.metrics.congestionIndex,
      strandedDelta: after.metrics.strandedVehicles - before.metrics.strandedVehicles,
    },
  });

  if (stream) {
    streamSimulationFrame(crisisId, after);
    streamSimulationCompleted(crisisId, {
      totalTicks: run.totalTicks,
      durationMs: Date.now() - new Date(startedAt).getTime(),
      phase: run.phase,
    });
  }

  return run;
}

function applyActionToWorld(
  world: SimulationWorld,
  action: { type: string; payload?: Record<string, unknown> },
  result?: ExecutionResult
): void {
  const payload = (action.payload ?? {}) as Record<string, unknown>;

  switch (action.type) {
    case 'traffic_reroute':
      activateRerouteImpact(world, Number(payload.congestionDelta ?? -0.32));
      if (payload.closeRoad) {
        world.congestionIndex = Math.min(0.95, world.congestionIndex + 0.05);
      }
      break;
    case 'deploy_pumps':
      for (const u of world.rescueUnits.filter((x) => x.type === 'pump')) {
        u.progress = Math.min(1, u.progress + 0.4);
      }
      world.phase = 'mitigating';
      break;
    case 'citizen_alert':
      world.alertReach = Math.max(world.alertReach, 12000);
      break;
    case 'dispatch_emergency':
      for (const u of world.rescueUnits) {
        u.progress = Math.min(1, u.progress + 0.25);
      }
      break;
    default:
      break;
  }

  if (result?.status === 'failed') {
    world.congestionIndex = Math.min(0.99, world.congestionIndex + 0.03);
  }
}

function transitionPhaseFinal(world: SimulationWorld): void {
  if (world.congestionIndex < 0.5) {
    world.phase = 'stabilized';
  } else {
    world.phase = 'mitigating';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export { getSimulationRun, storeSimulationRun };
export { getReplayFrames, compareBeforeAfter, getTimelineReplay } from './replay.js';
export { runPhysicsSimulation as runVisualSimulation };
