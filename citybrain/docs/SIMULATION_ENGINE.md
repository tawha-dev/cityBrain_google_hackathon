# CityBrain Simulation Engine

Deterministic crisis physics simulator with map overlays, WebSocket streaming, event replay, and before/after comparison.

---

## 1. Simulation architecture

```
CrisisRunState
    │
    ├─► runExecutionAgent()  (optional — real tool calls)
    │
    └─► runPhysicsSimulation()
            │
            ├─ world.ts — initial conditions
            ├─ models/ — traffic, flood, rescue, timing
            ├─ overlays.ts — map layers per frame
            ├─ animation.ts — frame + lerp
            ├─ transitions.ts — phase state machine
            ├─ timeline.ts — event log
            ├─ streamer.ts — WebSocket fan-out
            └─ replay.ts — in-memory replay buffer
```

**Code:** `services/api/src/simulator/`

---

## 2. Data models

`packages/shared/src/simulation.schema.ts`:

| Type | Purpose |
|------|---------|
| `SimulationFrame` | tick, metrics, overlays, units |
| `MapOverlay` | flood_zone, congestion_corridor, rescue_unit, reroute_path, alert_zone |
| `TimelineEvent` | category, label, simTime |
| `SimulationRun` | full run + before/after frames |

---

## 3. Map overlays

| Overlay | Visual |
|---------|--------|
| `flood_zone` | Pulsing circle (radius grows/recalls) |
| `congestion_corridor` | Weighted polyline (red/amber/teal) |
| `reroute_path` | Teal detour polyline |
| `rescue_unit` | Unit markers with status color |
| `alert_zone` | Amber coverage circle |

---

## 4. Animation system

- `worldToFrame()` — snapshot world → renderable frame
- `lerpFrames(a, b, t)` — smooth replay interpolation
- Configurable `tickDelayMs` (default 120ms) for real-time feel

---

## 5. State transitions

```
idle → crisis_active → response_deployed → mitigating → stabilized → replay
```

Triggered by execution results (reroute, dispatch, pumps) and metric thresholds.

---

## 6. Node.js implementation

```typescript
import { runSimulation, getReplayFrames, compareBeforeAfter } from './simulator';

const { executionResults, simulation } = await runSimulation(state, ctx, crisisId, {
  tickDelayMs: 120,
  stream: true,
});

const replay = getReplayFrames(crisisId, 0, 10, 2);
const diff = compareBeforeAfter(crisisId);
```

### API

| Endpoint | Description |
|----------|-------------|
| `GET /crises/:id/simulation` | Full run + before/after delta |
| `GET /crises/:id/simulation/replay?fromTick=0` | Frame replay + timeline |
| `POST /crises/:id/simulation/run` | Physics-only sim (skip execution) |

### WebSocket events

`simulation.started` → `simulation.tick` → `simulation.frame` + `map.delta` → `simulation.completed`

---

*Version 1.0*
