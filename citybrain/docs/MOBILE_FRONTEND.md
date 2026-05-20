# CityBrain Mobile Frontend (Legacy Ops)

> **Note:** Authority dashboard is now **web-only** — see [WEB_DASHBOARD.md](./WEB_DASHBOARD.md).  
> Citizens use the Expo app — see [CITIZEN_APP.md](./CITIZEN_APP.md).

> Palantir-inspired tactical ops center — React Native (Expo) + WebSocket + Zustand.

---

## 1. Frontend architecture

```
app/                    Expo Router screens
components/             Feature + UI components
  ui/                   Design system primitives
  map/                  Live crisis map
  timeline/             AI reasoning
  execution/            Tool logs
  resources/            Asset grid
  alerts/               Citizen feed
  simulation/           Physics viewport
  analysis/             Before/after
hooks/                  useWebSocket, useCrisisDetail
lib/                    api.ts, store.ts (Zustand)
theme/                  tokens.ts
```

**Stack:** Expo 52 · Expo Router · TanStack Query · Zustand · NativeWind · RN Animated

---

## 2. Navigation flow

```
/index (Ops Command)
  ├─ /demo (Scenario launcher)
  └─ /crisis/[id] (Tab navigator — 7 screens)
        ├─ index      Live Crisis Map
        ├─ timeline   AI Reasoning Timeline
        ├─ execution  Emergency Execution Logs
        ├─ resources  Resource Deployment
        ├─ alerts     Citizen Alert Feed
        ├─ simulation Crisis Simulation
        └─ analysis   Before vs After
```

---

## 3. Component hierarchy

```
OpsHeader
├── StatusPulse (WS link)
└── Escalation badge

TacticalPanel
├── LiveCrisisMap → overlay chips
├── ReasoningTimeline → AnimatedTraceRow[]
├── ExecutionLogFeed
├── ResourceDashboard
├── CitizenAlertFeed
├── SimulationViewport (scanline anim)
└── BeforeAfterAnalysis → MetricTile[]
```

---

## 4. State management

| Store slice | Source |
|-------------|--------|
| `traces` | WS `agent.step` |
| `executionLogs` | WS `action.executed` |
| `mapOverlays` | WS `map.delta` / `simulation.frame` |
| `simulationFrame` | WS `simulation.*` |
| `timelineEvents` | WS `simulation.tick` |
| `beforeMetrics` / `afterMetrics` | WS `dashboard.updated` |
| `escalationLevel` | WS `escalation.changed` |

REST via React Query: crises, traces, executions, state, resources.

---

## 5. WebSocket integration

`hooks/useWebSocket.ts` — single connection, reconnect every 3s, fan-in to Zustand.

Events handled: `signal.new`, `agent.step`, `action.executed`, `map.delta`, `simulation.*`, `dashboard.updated`, `escalation.changed`, `pipeline.*`

---

## 6. Animation strategy

| Effect | Implementation |
|--------|----------------|
| Trace slide-in | `AnimatedTraceRow` opacity + translateX spring |
| Link pulse | `StatusPulse` opacity loop |
| Sim scanline | `SimulationViewport` vertical sweep |
| Pull-to-refresh | Native `RefreshControl` (accent tint) |

No Reanimated dependency — uses RN `Animated` API for web compatibility.

---

## 7. UI design system

**Aesthetic:** Industrial utilitarian + cyber ops terminal (DFII 12/15)

| Token | Value |
|-------|-------|
| Void | `#05080C` |
| BG | `#0B0F14` |
| Accent | `#00FFC6` (tactical cyan) |
| Danger | `#FF3B5C` |
| Warn | `#FFB020` |
| Type | Monospace labels, bold metrics |

**Differentiation anchor:** Left-border accent panels + monospace telemetry + pulsing link indicator.

---

## Run

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:4000 EXPO_PUBLIC_WS_URL=ws://localhost:4000/ws npm run web
```

---

*Version 1.0*
