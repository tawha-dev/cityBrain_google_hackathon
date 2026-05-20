import type { SimulationFrame, TimelineEvent } from '@citybrain/shared';
import { broadcast } from '../ws/hub.js';

export interface StreamOptions {
  crisisId: string;
  streamFrames?: boolean;
  streamTicks?: boolean;
}

export function streamSimulationStarted(
  crisisId: string,
  payload: { totalTicks: number; crisisType: string }
): void {
  broadcast({
    type: 'simulation.started',
    crisisId,
    timestamp: new Date().toISOString(),
    payload,
  });
}

export function streamSimulationTick(
  crisisId: string,
  payload: { tick: number; simTimeMs: number; phase: string; metrics: unknown }
): void {
  broadcast({
    type: 'simulation.tick',
    crisisId,
    timestamp: new Date().toISOString(),
    payload,
  });
}

export function streamSimulationFrame(crisisId: string, frame: SimulationFrame): void {
  broadcast({
    type: 'simulation.frame',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: frame,
  });

  broadcast({
    type: 'map.delta',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: {
      overlays: frame.overlays,
      units: frame.units,
      metrics: frame.metrics,
      phase: frame.phase,
    },
  });
}

export function streamTimelineEvent(crisisId: string, event: TimelineEvent): void {
  broadcast({
    type: 'simulation.tick',
    crisisId,
    timestamp: new Date().toISOString(),
    payload: { timelineEvent: event },
  });
}

export function streamSimulationCompleted(
  crisisId: string,
  payload: { totalTicks: number; durationMs: number; phase: string }
): void {
  broadcast({
    type: 'simulation.completed',
    crisisId,
    timestamp: new Date().toISOString(),
    payload,
  });
}
