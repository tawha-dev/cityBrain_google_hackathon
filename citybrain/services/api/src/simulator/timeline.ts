import { v4 as uuid } from 'uuid';
import type { TimelineEvent } from '@citybrain/shared';
import type { SimulationWorld } from './world.js';

export class SimulationTimeline {
  private events: TimelineEvent[] = [];

  push(
    world: SimulationWorld,
    category: TimelineEvent['category'],
    label: string,
    payload?: Record<string, unknown>
  ): TimelineEvent {
    const ev: TimelineEvent = {
      id: uuid(),
      tick: world.tick,
      simTimeMs: world.simTimeMs,
      category,
      label,
      payload,
    };
    this.events.push(ev);
    return ev;
  }

  getEvents(): TimelineEvent[] {
    return [...this.events];
  }

  getAtTick(tick: number): TimelineEvent[] {
    return this.events.filter((e) => e.tick === tick);
  }

  toJSON(): TimelineEvent[] {
    return this.getEvents();
  }
}
