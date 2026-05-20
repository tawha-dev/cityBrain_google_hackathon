import type { SimulationFrame, SimulationRun, TimelineEvent } from '@citybrain/shared';
import { lerpFrames } from './animation.js';

const replayStore = new Map<string, SimulationRun>();

export function storeSimulationRun(run: SimulationRun): void {
  replayStore.set(run.crisisId, run);
}

export function getSimulationRun(crisisId: string): SimulationRun | undefined {
  return replayStore.get(crisisId);
}

export function listReplayCrisisIds(): string[] {
  return [...replayStore.keys()];
}

/** Replay frames from tick range with optional interpolation sub-steps */
export function getReplayFrames(
  crisisId: string,
  fromTick = 0,
  toTick?: number,
  interpolateSteps = 0
): SimulationFrame[] {
  const run = replayStore.get(crisisId);
  if (!run) return [];

  const maxTick = toTick ?? run.frames[run.frames.length - 1]?.tick ?? 0;
  const slice = run.frames.filter((f) => f.tick >= fromTick && f.tick <= maxTick);

  if (interpolateSteps <= 0) return slice;

  const out: SimulationFrame[] = [];
  for (let i = 0; i < slice.length - 1; i++) {
    out.push(slice[i]);
    for (let s = 1; s <= interpolateSteps; s++) {
      out.push(lerpFrames(slice[i], slice[i + 1], s / (interpolateSteps + 1)));
    }
  }
  if (slice.length > 0) out.push(slice[slice.length - 1]);
  return out;
}

export function getTimelineReplay(
  crisisId: string,
  fromSimTimeMs = 0
): TimelineEvent[] {
  const run = replayStore.get(crisisId);
  if (!run) return [];
  return run.timeline.filter((e) => e.simTimeMs >= fromSimTimeMs);
}

export function compareBeforeAfter(crisisId: string): {
  before: SimulationFrame | undefined;
  after: SimulationFrame | undefined;
  delta: Record<string, number>;
} | null {
  const run = replayStore.get(crisisId);
  if (!run?.before || !run?.after) return null;

  const b = run.before.metrics;
  const a = run.after.metrics;
  return {
    before: run.before,
    after: run.after,
    delta: {
      congestionIndex: a.congestionIndex - b.congestionIndex,
      floodCoverageKm2: a.floodCoverageKm2 - b.floodCoverageKm2,
      strandedVehicles: a.strandedVehicles - b.strandedVehicles,
      rerouteAdoptionPct: a.rerouteAdoptionPct - b.rerouteAdoptionPct,
    },
  };
}
