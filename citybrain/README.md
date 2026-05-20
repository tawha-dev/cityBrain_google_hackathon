# CityBrain AI

**Autonomous Crisis Intelligence & Emergency Response Operating System**

CityBrain AI is a real-time, multi-agent emergency operations platform that ingests noisy multilingual crisis signals, reasons over severity and escalation, coordinates simulated city response, and adapts when outcomes fall short. It is built for **Google Antigravity Hackathon — Challenge 3 (CIRO)** and designed to feel like a live command center—not a chatbot, not a passive dashboard.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MOBILE COMMAND CENTER (Expo)          WEB OPS UI (Docker)              │
│  Live Map · AI Trace · Execution · Sim · Before/After                   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ REST + WebSocket
┌───────────────────────────────▼─────────────────────────────────────────┐
│  API GATEWAY (Express) — signals, crises, demo scenarios, WS hub        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 9-Agent       │     │ Simulation      │     │ PostgreSQL +    │
│ Orchestrator  │     │ Engine (twin)   │     │ pgvector memory │
│ Gemini + SOP  │     │ map overlays    │     │ audit traces    │
└───────────────┘     └─────────────────┘     └─────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Google Antigravity — workflows, agent prompts, trace export           │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Architecture Overview](#3-architecture-overview)
4. [Antigravity Orchestration](#4-antigravity-orchestration)
5. [Multi-Agent Workflow](#5-multi-agent-workflow)
6. [Reasoning Pipeline](#6-reasoning-pipeline)
7. [Simulation Engine](#7-simulation-engine)
8. [APIs & Tools Used](#8-apis--tools-used)
9. [Setup Instructions](#9-setup-instructions)
10. [Demo Explanation](#10-demo-explanation)
11. [Innovation Highlights](#11-innovation-highlights)
12. [Future Scalability](#12-future-scalability)

---

## 1. Project Overview

CityBrain AI closes the loop between **citizen-reported chaos** and **coordinated emergency action**. The system:

- Ingests signals from social media, weather, traffic, field reports, and sensors (English, Urdu, Roman Urdu)
- Runs a **nine-agent autonomous pipeline** with structured Gemini reasoning and deterministic fallbacks
- Executes response actions via a **tool registry** (traffic reroute, rescue dispatch, hospital notify, citizen alerts)
- Streams **live map overlays**, execution logs, and reasoning traces to a tactical mobile command center
- Runs a **physics-based simulation twin** to visualize flood spread, congestion, and rescue movement
- **Reflects** on outcomes and **replans** when mitigation thresholds are not met

**Deliverables:** Expo mobile/web command center · Node.js API · PostgreSQL + pgvector · Antigravity workflow artifacts · Docker one-command deploy.

| Document | Description |
|----------|-------------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Enterprise architecture deep-dive |
| [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md) | API, DB, agent graph |
| [`docs/DEMO_KARACHI_CINEMATIC.md`](docs/DEMO_KARACHI_CINEMATIC.md) | 5-minute judge demo script |
| [`docs/CRISIS_MAP_SYSTEM.md`](docs/CRISIS_MAP_SYSTEM.md) | Live map & overlay system |

---

## 2. Problem Statement

Modern cities generate crisis information faster than humans can fuse it:

| Pain | Impact |
|------|--------|
| **Fragmented signals** | Social posts, weather alerts, and traffic data live in silos |
| **Language friction** | Urdu and Roman Urdu reports are under-utilized in ops workflows |
| **Slow escalation** | Severity is debated while floodwater and congestion compound |
| **Uncoordinated response** | Reroute, rescue, and alerts are executed by separate teams without a shared plan |
| **No closed loop** | Cities rarely measure whether the response actually worked—and almost never replan in real time |

CityBrain treats emergency response as an **operating system problem**: observe → reason → plan → act → measure → adapt.

---

## 3. Architecture Overview

**Monorepo** (npm workspaces): shared types, agent tools, API service, Expo mobile app.

```
citybrain/
├── apps/mobile/              # Expo command center (7 crisis tabs + demo launcher)
├── services/api/             # Express REST + WebSocket + orchestrator + simulator
├── packages/
│   ├── shared/               # Zod schemas, WS events, agent types
│   └── agent-tools/          # TOOL_REGISTRY + execution tool definitions
├── infra/migrations/         # PostgreSQL schema (signals, crises, traces, memory)
├── antigravity/              # Workflows, agent prompts, demo traces
└── docs/                     # Architecture, agents, demo scripts
```

### Runtime services (Docker)

| Service | Port | Role |
|---------|------|------|
| `api` | 4000 | REST `/api/v1`, WebSocket `/ws`, agent pipeline |
| `web` | 8081 | Static command center (Expo web build) |
| `postgres` | 5432 | Crisis state, agent runs, reasoning traces, pgvector memory |
| `redis` | 6379 | Session/cache (ready for scale-out) |

### Data flow

1. **Ingest** — signals arrive via scenario seed or `POST /signals/ingest`
2. **Orchestrate** — `graph.ts` runs the nine-agent pipeline sequentially (with conditional reroute + replan branch)
3. **Persist** — `agent_runs`, `reasoning_traces`, `execution_logs`, `crisis_snapshots`
4. **Stream** — WebSocket fan-out: `signal.new`, `agent.step`, `map.delta`, `action.executed`, `simulation.*`
5. **Display** — mobile Zustand store + React Query hydrate the ops UI

---

## 4. Antigravity Orchestration

CityBrain uses a **hybrid model**: Antigravity for authoring, observability, and judge-visible traces; Node.js for reliable runtime execution.

| Layer | Location | Purpose |
|-------|----------|---------|
| **Workflow** | [`antigravity/workflows/citybrain-ciro.md`](antigravity/workflows/citybrain-ciro.md) | CIRO pipeline definition, escalation policy, tool list |
| **Agent prompts** | [`antigravity/agents/`](antigravity/agents/) | Per-agent SKILL files (signal extraction, crisis detection, planning, …) |
| **Sample trace** | [`antigravity/traces/sample-g10-flood.json`](antigravity/traces/sample-g10-flood.json) | Exportable run for submission |
| **Runtime bridge** | `services/api/src/antigravity/` | Loads prompts; logs identical schema to DB |

**Escalation policy**

| Level | Behavior |
|-------|----------|
| `watch` | Monitor only |
| `advisory` | Prepare alerts |
| `operational` | Full pipeline auto-run |
| `critical` | Immediate execution + supervisor notify |

**Demo entry:** `POST /api/v1/demo/scenarios/:key/run`

---

## 5. Multi-Agent Workflow

Nine specialized agents run in sequence. Each step emits `agent.step` WebSocket events and persists reasoning traces.

```
signal_extraction
       ↓
crisis_detection
       ↓
severity_reasoning
       ↓
planning (emergency planning — weighted decision matrix, phased actions)
       ↓
resource_allocation
       ↓
traffic_rerouting          ← conditional (flood, accident, road_blockage)
       ↓
citizen_alert
       ↓
execution                  ← tool-calling with retry + audit logs
       ↓
reflection                 ← outcome score; replan if threshold not met
       └──► planning (v2)  ← max one replan loop in demo
```

| Agent | Responsibility |
|-------|----------------|
| **Signal Extraction** | Normalize text, entities, geo, urgency (Gemini structured output + rule fallback) |
| **Crisis Detection** | Spatial clustering, crisis classification, confidence scoring (chain-of-thought) |
| **Severity Reasoning** | Weather + traffic fusion → severity level & escalation |
| **Planning** | Rank actions (life safety, congestion, reach); sequence immediate / containment / recovery |
| **Resource Allocation** | Assign ambulances, pumps, rescue units from inventory |
| **Traffic Rerouting** | Compute detours, road closures, `map.delta` broadcast |
| **Citizen Alert** | Draft EN/UR alerts, segment zones, estimate reach |
| **Execution** | Invoke tools: reroute, dispatch, notify hospitals, alerts, tickets, dashboard |
| **Reflection** | Score congestion/stranded reduction; trigger replan if &lt; 25% improvement (demo) |

---

## 6. Reasoning Pipeline

Reasoning is **structured, auditable, and replayable**—not free-form chat.

### Structured output

- **Gemini** `responseSchema` + **Zod** validation (3 retries per agent)
- Rule-based fallback when `GEMINI_API_KEY` is unset (deterministic SOP for demo reliability)

### Trace storage

Every agent step writes to:

- `reasoning_traces` — thought, latency, status
- `agent_runs` — agent name, input/output summary
- `execution_logs` — tool request/response pairs

### Key reasoning patterns

| Agent | Pattern |
|-------|---------|
| Signal Extraction | Schema-constrained extraction; multilingual entity grounding |
| Crisis Detection | 9-step chain-of-thought; geographic cluster fusion |
| Emergency Planning | Weighted decision matrix; phased action sequencing |
| Reflection | Mitigation analysis + risk scoring → `replanRequired` |

Mobile **AI TRACE** tab renders `AnimatedTraceRow` entries as the pipeline advances in real time.

---

## 7. Simulation Engine

A **deterministic digital twin** visualizes crisis physics and feeds the live map.

| Module | Role |
|--------|------|
| `simulator/world.ts` | Crisis state → simulation world (flood radius, congestion, units) |
| `simulator/models/` | Traffic, flood spread, rescue ETA, timing |
| `simulator/overlays.ts` | MapOverlay layers: flood_zone, congestion_corridor, reroute_path, rescue_unit, closed_road, emergency_hotspot |
| `simulator/streamer.ts` | WS: `simulation.started`, `tick`, `frame`, `completed` + `map.delta` |
| `simulator/replay.ts` | Buffer frames for replay endpoint |

**Endpoints**

- `GET /crises/:id/simulation` — latest run
- `GET /crises/:id/simulation/replay` — frame buffer
- `POST /crises/:id/simulation/run` — trigger sim (pipeline also runs sim on scenario execute)

The **SIM** tab shows tick metrics, scanline animation, and timeline events; the **MAP** tab renders overlays from `simulation.frame` and `map.delta`.

---

## 8. APIs & Tools Used

### External APIs

| API | Usage |
|-----|--------|
| **Google Gemini** | Structured JSON reasoning for agents (optional; SOP fallback) |
| **Google Maps** | Mobile map (native + embed); route concepts via `google_routes` tool |
| **PostgreSQL + pgvector** | Crisis persistence, semantic memory recall |

### REST API (`/api/v1`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/crises` | List active crises |
| `GET` | `/crises/:id` | Crisis dossier + signals |
| `GET` | `/crises/:id/traces` | Reasoning traces |
| `GET` | `/crises/:id/executions` | Execution logs |
| `GET` | `/crises/:id/state` | Before/after snapshots |
| `GET` | `/crises/:id/simulation` | Simulation run |
| `POST` | `/signals/ingest` | Ingest live signal |
| `POST` | `/crises/:id/analyze` | Run pipeline on crisis |
| `POST` | `/demo/scenarios/:key/run` | One-click demo scenario |
| `GET` | `/resources` | City resource inventory |
| `GET` | `/memory` | Vector memory search |

### WebSocket events

`signal.new` · `agent.step` · `action.executed` · `map.delta` · `escalation.changed` · `execution.*` · `simulation.*` · `dashboard.updated` · `pipeline.complete` · `pipeline.replan`

### Agent tool registry (sample)

`parse_signal` · `geocode` · `cluster_signals` · `get_weather` · `get_traffic` · `load_sop` · `allocate_units` · `google_routes` · `draft_alert` · `segment_citizens` · `simulate_action` · `score_outcome` · `query_memory`

**Execution tools:** `updateTrafficRoutes` · `dispatchRescueTeams` · `sendEmergencyAlerts` · `notifyHospitals` · `createEmergencyTicket` · `updateDashboard`

---

## 9. Setup Instructions

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (local dev only)
- Optional: `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`

### One-command deploy (recommended)

```bash
cd citybrain
cp .env.example .env
# Optional: add GEMINI_API_KEY and GOOGLE_MAPS_API_KEY to .env

docker compose up --build -d
```

| Service | URL |
|---------|-----|
| API | http://localhost:4000 |
| Command Center | http://localhost:8081 |
| Health | http://localhost:4000/health |

### Local development

```bash
npm install
docker compose up postgres redis -d
npm run db:migrate
npm run dev:api          # terminal 1 — API on :4000
npm run dev:mobile       # terminal 2 — Expo command center (operators)
npm run dev:citizen:flutter   # terminal 3 — Flutter citizen app (see apps/citizen_flutter)
```

Configure mobile env in `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_WS_URL=ws://localhost:4000/ws
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
```

Citizen Flutter app: copy `apps/citizen_flutter/env/dev.json.example` → `env/dev.json` and set `API_BASE_URL` / `WS_URL` (use `10.0.2.2` on Android emulator).

### Build

```bash
npm run build
```

---

## 10. Demo Explanation

### Recommended: Karachi flood (5-minute cinematic)

1. Open **http://localhost:8081** → **Demo Control**
2. Tap **★ Karachi Heavy Rain Flood**
3. Follow the seven-tab command center as the pipeline runs autonomously

```bash
curl -X POST http://localhost:4000/api/v1/demo/scenarios/karachi_flood/run
```

**Full narration script:** [`docs/DEMO_KARACHI_CINEMATIC.md`](docs/DEMO_KARACHI_CINEMATIC.md)

| Act | What happens | UI tab |
|-----|----------------|--------|
| Citizens report flooding | 6 multilingual signals pin Clifton/Saddar | MAP |
| AI extracts & detects flood | Traces populate | TRACE |
| Severity → CRITICAL | Escalation badge, flood overlay | MAP |
| Reroute + rescue + alerts | Tool logs stream | EXEC / ASSETS / ALERTS |
| Outcomes measured | Before/after metrics | DELTA |
| Adaptive replan | Second plan version | TRACE |

### Alternate scenarios

| Key | Crisis |
|-----|--------|
| `karachi_flood` | **Karachi** — heavy rain, Clifton/Saddar urban flood (judge demo) |
| `g10_flood` | Islamabad G-10 urban flood |
| `margalla_heat` | Extreme heatwave |
| `srinagar_accident` | Multi-vehicle accident |
| `i9_grid` | Grid / infrastructure failure |
| `faiz_road_block` | Road blockage |

---

## 11. Innovation Highlights

| Innovation | Why it matters |
|------------|----------------|
| **Autonomous ops loop** | Full pipeline runs without human-in-the-loop for demo; humans supervise |
| **Multilingual signal fusion** | Roman Urdu + English + sensor data in one structured model |
| **Chain-of-thought crisis detection** | Explainable clustering, not keyword alerts |
| **Weighted emergency planning** | Life-safety-first action ranking with phased deployment |
| **Tool execution with retry** | Production-shaped audit trail for every city action |
| **Live map overlay system** | Flood zones, congestion corridors, detours, rescue units via WebSocket |
| **Simulation twin** | Tick-based physics with replay—not a static screenshot |
| **Reflection + replan** | System measures its own response and adapts (v2 plan) |
| **Antigravity-native** | Workflows, prompts, and exportable traces for CIRO submission |
| **Palantir-grade UX** | Tactical command center: monospace telemetry, live link pulse, 7 ops tabs |

---

## 12. Future Scalability

| Dimension | Path |
|-----------|------|
| **Multi-city** | Scenario registry per metro; centroid + SOP packs; tenant isolation in DB |
| **Ingest scale** | Dedicated ingest workers + Redis Streams / Kafka event bus |
| **Orchestrator** | Extract `services/orchestrator` for horizontal agent workers |
| **Real integrations** | Live Google Routes, SMS/push gateways, CAD/911 adapters |
| **Memory** | Expand pgvector crisis memory for cross-event pattern recall |
| **Auth & RBAC** | Ops roles: viewer, coordinator, supervisor; audit per action |
| **v2 schema** | [`infra/migrations/002_v2_schema.sql`](infra/migrations/002_v2_schema.sql) — Prisma-ready enterprise model |
| **Observability** | OpenTelemetry traces aligned with `agent_runs` IDs |

CityBrain is architected as a **platform**, not a single-city demo: shared schemas, tool contracts, and event types are stable extension points.

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React Native (Expo 52), Expo Router, NativeWind, TanStack Query, Zustand, react-native-maps |
| **Backend** | Node.js, Express, WebSockets, Zod |
| **Data** | PostgreSQL 16, pgvector, Redis |
| **AI** | Google Gemini (structured output), rule-based SOP fallback |
| **Orchestration** | Google Antigravity workflows + agent prompts |
| **Deploy** | Docker Compose multi-stage build |

---

## License & Hackathon

Built for **Google Antigravity Hackathon — Challenge 3 (CIRO)**.  
CityBrain AI — *The city posts chaos. CityBrain posts coordinates.*
