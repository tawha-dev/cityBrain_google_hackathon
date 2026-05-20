# CityBrain AI — Complete Project Folder Structure

> **Architecture style:** Clean Architecture + Feature-based modules + Monorepo  
> **Goal:** Scalable crisis intelligence platform where *AI autonomously manages city emergencies*

---

## Top-Level Layout

```
citybrain/
├── frontend/                 # All client applications (Expo mobile + web command center)
├── backend/                  # API gateway, persistence, real-time transport
├── ai-agents/                # Agent definitions, orchestration graph, prompts
├── simulation-engine/          # Deterministic crisis action simulation
├── shared/                   # Cross-cutting types, schemas, contracts, utils
├── docs/                     # Architecture, ADRs, runbooks, demo scripts
│
├── infra/                    # Docker, migrations, nginx, CI (platform)
├── antigravity/              # Antigravity IDE artifacts (workflows, traces)
├── scripts/                  # Dev tooling, seed runners, codegen
│
├── package.json              # Workspace root
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

### Why this split (architecture rationale)

| Principle | How it applies |
|-----------|----------------|
| **Separation of concerns** | UI never imports DB; agents never import React; simulator never calls Gemini directly from UI |
| **Feature cohesion** | Crisis, signals, agents, execution grouped by domain inside each layer |
| **Dependency rule** | Dependencies point inward: `frontend` → `shared` ← `backend` ← `ai-agents` / `simulation-engine` |
| **Replaceability** | Swap Gemini for another LLM inside `ai-agents` without touching `frontend` |
| **Demo reliability** | `simulation-engine` runs deterministically even when `ai-agents` LLM is down |
| **Hackathon + enterprise** | Clear boundaries for team parallel work and future microservice extraction |

---

## 1. `frontend/` — Client Applications

```
frontend/
├── mobile/                           # Expo React Native (MUST deliverable)
│   ├── app/                          # expo-router screens (feature routes)
│   │   ├── _layout.tsx
│   │   ├── index.tsx                 # Ops overview
│   │   ├── demo.tsx                  # Scenario launcher
│   │   └── crisis/
│   │       └── [id].tsx              # Crisis dossier
│   │
│   ├── src/
│   │   ├── features/                 # Feature-based UI modules
│   │   │   ├── ops-overview/
│   │   │   │   ├── components/
│   │   │   │   ├── hooks/
│   │   │   │   └── index.ts
│   │   │   ├── crisis-dossier/
│   │   │   ├── agent-trace/
│   │   │   ├── execution-theater/
│   │   │   ├── crisis-map/
│   │   │   ├── demo-control/
│   │   │   └── memory-vault/
│   │   │
│   │   ├── components/             # Shared UI primitives (Panel, Badge, Metric)
│   │   ├── hooks/                  # useWebSocket, useCrisisSubscription
│   │   ├── lib/                    # api-client, theme tokens
│   │   ├── stores/                 # Zustand slices
│   │   └── types/                  # Frontend-only view models (optional)
│   │
│   ├── assets/
│   ├── app.json
│   ├── package.json
│   └── tailwind.config.js
│
├── web/                              # Web command center (Expo export or Vite)
│   ├── src/
│   │   ├── features/               # Same feature names as mobile where possible
│   │   └── ...
│   └── package.json
│
└── README.md                         # Frontend setup, env vars, design tokens
```

### Responsibilities

| Path | Responsibility |
|------|----------------|
| `frontend/mobile` | Primary hackathon deliverable; live ops UI |
| `frontend/web` | Judge-friendly browser demo; Docker-served fallback |
| `features/*` | One feature = one crisis capability (map, trace, demo) |
| `stores/` | Ephemeral live state from WebSocket |
| `lib/api-client` | Typed REST calls using `shared` contracts |

### Current code mapping

| Today | Target |
|-------|--------|
| `apps/mobile/` | `frontend/mobile/` |

---

## 2. `backend/` — API & Platform Services

```
backend/
├── api-gateway/                      # Express HTTP + WebSocket entry
│   ├── src/
│   │   ├── index.ts                  # Bootstrap
│   │   ├── config/                   # env, cors, ports
│   │   ├── middleware/               # error-handler, request-id, rate-limit
│   │   ├── routes/
│   │   │   ├── health.routes.ts
│   │   │   ├── crises.routes.ts
│   │   │   ├── signals.routes.ts
│   │   │   ├── demo.routes.ts
│   │   │   └── memory.routes.ts
│   │   └── websocket/
│   │       ├── hub.ts                # Connection manager
│   │       ├── broadcaster.ts        # Event fan-out
│   │       └── handlers.ts           # Subscribe / unsubscribe (v2)
│   └── package.json
│
├── core/                             # Domain services (framework-agnostic)
│   ├── src/
│   │   ├── features/
│   │   │   ├── crisis/
│   │   │   │   ├── crisis.service.ts
│   │   │   │   ├── crisis.repository.ts
│   │   │   │   └── crisis.types.ts
│   │   │   ├── signals/
│   │   │   │   ├── signal.service.ts
│   │   │   │   └── signal.ingest.ts
│   │   │   ├── agents/
│   │   │   │   └── pipeline-trigger.service.ts
│   │   │   ├── execution/
│   │   │   │   └── execution-log.service.ts
│   │   │   └── memory/
│   │   │       └── crisis-memory.service.ts
│   │   └── index.ts
│   └── package.json
│
├── database/
│   ├── migrations/
│   │   ├── 001_init.sql
│   │   └── 002_add_hnsw_index.sql
│   ├── seeds/
│   │   ├── resources.seed.ts
│   │   └── scenarios.seed.ts
│   ├── src/
│   │   ├── pool.ts
│   │   └── migrate.ts
│   └── README.md
│
└── README.md
```

### Responsibilities

| Path | Responsibility |
|------|----------------|
| `api-gateway` | HTTP/WS only; thin controllers |
| `core` | Business rules, orchestration triggers, repository interfaces |
| `database` | Schema, migrations, seeds — single source of truth for SQL |

### Dependency rule

```
api-gateway → core → database
api-gateway → shared (types)
api-gateway → ai-agents (trigger pipeline)
api-gateway → simulation-engine (indirect via agents)
```

### Current code mapping

| Today | Target |
|-------|--------|
| `services/api/src/index.ts` | `backend/api-gateway/src/index.ts` |
| `services/api/src/routes/` | `backend/api-gateway/src/routes/` |
| `services/api/src/ws/` | `backend/api-gateway/src/websocket/` |
| `services/api/src/db/` | `backend/database/` + `backend/core/` |
| `infra/migrations/` | `backend/database/migrations/` |

---

## 3. `ai-agents/` — Orchestration & Intelligence

```
ai-agents/
├── orchestrator/                     # Runtime graph execution
│   ├── src/
│   │   ├── graph/
│   │   │   ├── pipeline.ts           # Main runPipeline()
│   │   │   ├── state.ts              # CrisisRunState factory
│   │   │   └── edges.ts              # Conditional routing
│   │   ├── nodes/                    # One file per agent
│   │   │   ├── signal-extraction.node.ts
│   │   │   ├── crisis-detection.node.ts
│   │   │   ├── severity-reasoning.node.ts
│   │   │   ├── planning.node.ts
│   │   │   ├── resource-allocation.node.ts
│   │   │   ├── traffic-rerouting.node.ts
│   │   │   ├── citizen-alert.node.ts
│   │   │   ├── execution.node.ts
│   │   │   └── reflection.node.ts
│   │   ├── llm/
│   │   │   ├── gemini.client.ts
│   │   │   └── sop-fallback.ts
│   │   └── index.ts
│   └── package.json
│
├── tools/                            # Agent-callable tools
│   ├── src/
│   │   ├── registry.ts
│   │   ├── geo/
│   │   │   ├── geocode.tool.ts
│   │   │   └── cluster-signals.tool.ts
│   │   ├── intel/
│   │   │   ├── get-weather.tool.ts
│   │   │   └── get-traffic.tool.ts
│   │   ├── ops/
│   │   │   ├── allocate-units.tool.ts
│   │   │   └── draft-alert.tool.ts
│   │   └── memory/
│   │       ├── query-memory.tool.ts
│   │       └── write-memory.tool.ts
│   └── package.json
│
├── prompts/                          # Antigravity-aligned agent prompts
│   ├── agents/
│   │   ├── signal-extraction.md
│   │   ├── crisis-detection.md
│   │   └── ... (9 total)
│   ├── workflows/
│   │   └── citybrain-ciro.md
│   └── schemas/                      # JSON schema per agent output
│       ├── crisis-candidate.schema.json
│       └── severity-report.schema.json
│
├── bridge/                           # Load Antigravity exports at runtime
│   ├── src/
│   │   └── antigravity-bridge.ts
│   └── package.json
│
└── README.md
```

### Responsibilities

| Path | Responsibility |
|------|----------------|
| `orchestrator` | State graph, agent sequencing, replan loop |
| `tools` | Side-effecting capabilities (DB, APIs, simulator calls) |
| `prompts` | Human-editable SKILL files for Antigravity IDE |
| `bridge` | Sync prompts ↔ runtime; trace export format |

### Current code mapping

| Today | Target |
|-------|--------|
| `services/api/src/orchestrator/` | `ai-agents/orchestrator/` |
| `packages/agent-tools/` | `ai-agents/tools/` |
| `antigravity/agents/` | `ai-agents/prompts/agents/` |
| `services/api/src/antigravity/` | `ai-agents/bridge/` |

---

## 4. `simulation-engine/` — Action Execution & City State

```
simulation-engine/
├── src/
│   ├── engine/
│   │   ├── simulation.engine.ts      # runSimulation()
│   │   └── action-dispatcher.ts
│   ├── actions/                      # One handler per action type
│   │   ├── traffic-reroute.handler.ts
│   │   ├── dispatch-emergency.handler.ts
│   │   ├── citizen-alert.handler.ts
│   │   ├── deploy-pumps.handler.ts
│   │   ├── heat-shelter-open.handler.ts
│   │   └── infrastructure-isolate.handler.ts
│   ├── state/
│   │   ├── city-state.builder.ts     # before/after metrics
│   │   └── snapshot.service.ts
│   ├── adapters/
│   │   ├── google-routes.adapter.ts  # Optional live API
│   │   └── mock-routes.adapter.ts    # Demo deterministic
│   └── index.ts
├── tests/
│   ├── engine.test.ts
│   └── handlers/
│       └── traffic-reroute.test.ts
├── package.json
└── README.md
```

### Responsibilities

| Path | Responsibility |
|------|----------------|
| `engine` | Execute plan actions in priority order |
| `actions/*` | Deterministic handler per `ActionType` |
| `state` | Before/after snapshots for dossier UI |
| `adapters` | External API integration (swappable) |

### Design rules

- **No LLM calls** inside simulation-engine
- **Idempotent** handlers keyed by `action_id`
- **Always log** `state_delta` for execution theater

### Current code mapping

| Today | Target |
|-------|--------|
| `services/api/src/simulator/` | `simulation-engine/src/` |

---

## 5. `shared/` — Contracts & Cross-Cutting Code

```
shared/
├── types/                            # TypeScript domain types
│   ├── crisis.types.ts
│   ├── signal.types.ts
│   ├── agent.types.ts
│   └── index.ts
│
├── schemas/                          # Zod validation (runtime + LLM output)
│   ├── signal.schema.ts
│   ├── crisis-run-state.schema.ts
│   ├── response-plan.schema.ts
│   └── index.ts
│
├── events/                           # WebSocket + domain events
│   ├── ws-events.ts
│   └── payloads/
│       ├── agent-step.payload.ts
│       └── signal-new.payload.ts
│
├── constants/
│   ├── agent-pipeline.ts             # AGENT_PIPELINE order
│   ├── escalation-levels.ts
│   └── crisis-types.ts
│
├── utils/
│   ├── geo.ts
│   └── id.ts
│
├── package.json                      # @citybrain/shared
└── README.md
```

### Responsibilities

| Path | Responsibility |
|------|----------------|
| `types` | Compile-time contracts |
| `schemas` | Runtime validation at API and agent boundaries |
| `events` | Single WS envelope definition for frontend + backend |
| `constants` | Shared enums — never duplicate in features |

### Who may import `shared`

| Consumer | Allowed |
|----------|---------|
| frontend | ✅ types, events, constants |
| backend | ✅ all |
| ai-agents | ✅ schemas, types, constants |
| simulation-engine | ✅ types, constants |
| shared | ❌ must not import other packages |

### Current code mapping

| Today | Target |
|-------|--------|
| `packages/shared/` | `shared/` (root-level package) |

---

## 6. `docs/` — Documentation

```
docs/
├── ARCHITECTURE.md                   # System design (15 sections)
├── PROJECT_STRUCTURE.md              # This file
├── DEMO_SCRIPT.md                    # 3–5 min judge walkthrough
├── api/
│   └── openapi.yaml                  # REST contract (v2)
├── adr/                              # Architecture Decision Records
│   ├── 001-monorepo.md
│   ├── 002-hybrid-antigravity-runtime.md
│   └── 003-pgvector-memory.md
├── diagrams/
│   ├── system-context.mmd
│   ├── agent-pipeline.mmd
│   └── event-flow.mmd
└── runbooks/
    ├── local-dev.md
    ├── docker-deploy.md
    └── demo-troubleshooting.md
```

---

## 7. Supporting Roots (Platform)

```
infra/
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── nginx.conf
├── k8s/                              # Future
│   └── deployment.yaml
└── compose/
    └── docker-compose.yml

antigravity/                          # Submission exports (symlink or copy from ai-agents/prompts)
├── traces/
│   └── sample-g10-flood.json
└── README.md

scripts/
├── dev.sh
├── migrate.sh
├── seed-islamabad.sh
└── export-traces.sh

seed/
└── scenarios/
    ├── g10-flood.ts
    ├── margalla-heat.ts
    └── ...
```

---

## File Naming Conventions

### General rules

| Rule | Example |
|------|---------|
| **kebab-case** for folders | `crisis-dossier/`, `agent-trace/` |
| **kebab-case** for multi-word files | `crisis.service.ts`, `signal-extraction.node.ts` |
| **PascalCase** for React components | `CrisisMap.tsx`, `AgentTraceLine.tsx` |
| **camelCase** for functions/variables | `runPipeline`, `createCrisis` |
| **SCREAMING_SNAKE** for env vars | `GEMINI_API_KEY`, `DATABASE_URL` |
| **Suffix by role** | `.service.ts`, `.repository.ts`, `.handler.ts`, `.node.ts`, `.tool.ts`, `.routes.ts` |

### Backend

```
{feature}.{layer}.ts

Layers:
  .routes.ts      → HTTP handlers only
  .service.ts     → business logic
  .repository.ts  → SQL / persistence
  .middleware.ts  → Express middleware
```

### AI agents

```
{agent-name}.node.ts     → graph node implementation
{tool-name}.tool.ts      → tool registry entry
{agent-name}.md          → Antigravity prompt (prompts/agents/)
```

### Frontend features

```
features/{feature-name}/
  components/{ComponentName}.tsx
  hooks/use{FeatureName}.ts
  index.ts                 → public exports
```

### Database

```
migrations/{NNN}_{description}.sql    → 001_init.sql, 002_hnsw_index.sql
seeds/{entity}.seed.ts
```

### Tests (enterprise)

```
{unit}.test.ts           → colocated or in __tests__/
{feature}.e2e.ts         → backend/tests/e2e/
```

---

## Package Boundaries (npm workspaces)

```json
{
  "workspaces": [
    "frontend/mobile",
    "frontend/web",
    "backend/api-gateway",
    "backend/core",
    "ai-agents/orchestrator",
    "ai-agents/tools",
    "ai-agents/bridge",
    "simulation-engine",
    "shared"
  ]
}
```

### Import aliases (recommended)

| Package | Name |
|---------|------|
| shared | `@citybrain/shared` |
| orchestrator | `@citybrain/orchestrator` |
| tools | `@citybrain/tools` |
| simulation | `@citybrain/simulation` |
| api-gateway | `@citybrain/api` |

---

## Feature-Based Domain Map

All layers organize around these **domains**:

| Domain | frontend feature | backend feature | ai-agents node | simulation handler |
|--------|------------------|-----------------|----------------|-------------------|
| **Signals** | ops-overview ticker | `signals/` | signal-extraction | — |
| **Crisis** | crisis-dossier | `crisis/` | crisis-detection, severity | — |
| **Planning** | dossier plan card | `crisis/` | planning, resource-allocation | — |
| **Mobility** | crisis-map | — | traffic-rerouting | traffic-reroute |
| **Alerts** | execution-theater | — | citizen-alert | citizen-alert |
| **Execution** | execution-theater | `execution/` | execution | all handlers |
| **Memory** | memory-vault | `memory/` | reflection | — |
| **Demo** | demo-control | `demo.routes` | — | — |

---

## Scalability Path (folder → service)

When load grows, extract folders to independent deployables:

```
ai-agents/orchestrator/     →  orchestrator-service (K8s)
simulation-engine/          →  simulator-service
backend/api-gateway/        →  api-gateway (+ Redis pub/sub)
backend/core/               →  crisis-service
```

Folder structure **stays the same** — only deployment boundary changes.

---

## Quick Reference: Where to Put New Code

| I need to… | Put it in… |
|------------|------------|
| Add a new screen | `frontend/mobile/src/features/{name}/` |
| Add REST endpoint | `backend/api-gateway/src/routes/` + `backend/core/src/features/` |
| Add a 10th agent | `ai-agents/orchestrator/src/nodes/` + `ai-agents/prompts/agents/` |
| Add simulated action | `simulation-engine/src/actions/` |
| Add WS event type | `shared/events/` |
| Add DB table | `backend/database/migrations/` |
| Add Islamabad scenario | `seed/scenarios/` + `backend/database/seeds/` |

---

*Version 1.0 — canonical target structure. See migration map above for current `apps/` / `services/` / `packages/` layout.*
