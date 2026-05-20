# CityBrain AI

**Autonomous Crisis Intelligence & Emergency Response Operating System**

CityBrain AI is a real-time, multi-agent emergency operations platform that ingests noisy multilingual crisis signals, reasons over severity and escalation, coordinates simulated city response, and adapts when outcomes fall short. 

Built specifically for the **Google Antigravity Hackathon — Challenge 3: Crisis Intelligence & Response Orchestrator (CIRO)**, it is designed as a mission-critical, unified command center that moves far beyond passive dashboards or basic chat interfaces.

---

## 🗺️ Project Navigation

This is a monorepo containing all components of the CityBrain AI platform. Use the links below to explore the codebase:

| Component | Path | Description |
|-----------|------|-------------|
| **Core API Service** | [services/api](file:///D:/cityBrain_google_hackathon/citybrain/services/api) | Express API gateway, WebSocket hub, 9-agent orchestrator, and simulation engine. |
| **Tactical Command Center** | [apps/mobile](file:///D:/cityBrain_google_hackathon/citybrain/apps/mobile) | Expo React Native / Web mobile operations command center UI. |
| **Citizen Companion App** | [apps/citizen_flutter](file:///D:/cityBrain_google_hackathon/citybrain/apps/citizen_flutter) | Flutter app for citizen incident reports and localized alerts. |
| **Antigravity Artifacts** | [antigravity](file:///D:/cityBrain_google_hackathon/citybrain/antigravity) | Antigravity workflows, prompts, and sample traces for submission. |
| **Detailed Documentation** | [docs](file:///D:/cityBrain_google_hackathon/citybrain/docs) | Complete architecture guides, database schema maps, and demo scripts. |

---

## 🚀 One-Command Deploy (Docker Compose)

The entire ecosystem (PostgreSQL, Redis, API Server, and Web Dashboard) is dockerized. To spin up the complete platform locally:

```bash
# Navigate to the citybrain directory
cd citybrain

# Copy env template and set credentials
cp .env.example .env

# Start all containers
docker compose up --build -d
```

Once running, access the following:
* **Tactical Command Center (Web)**: `http://localhost:8081` (Expo Web Build)
* **API Gateway**: `http://localhost:4000`
* **API Health Check**: `http://localhost:4000/health`
* **PostgreSQL Database**: `localhost:5432`

---

## 🌟 Hackathon Challenge Alignment (Challenge 3: CIRO)

Here is how CityBrain AI directly addresses the evaluation rubrics outlined in the [Google Antigravity Hackathon - Challenges.pdf](file:///D:/cityBrain_google_hackathon/docs/Google%20Antigravity%20Hackathon%20-%20Challenges.pdf):

| Evaluation Criteria | Requirement | CityBrain AI Implementation | Reference File |
|---------------------|-------------|----------------------------|----------------|
| **Google Antigravity Execution (25%)** | Antigravity used in core orchestration; reasoning/tool execution | Loads Antigravity workflow definitions and agent prompts at runtime. Maps every execution step to Antigravity trace schemas. | [citybrain-ciro.md](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/workflows/citybrain-ciro.md) |
| **Agentic Reasoning & Coordination (20%)** | Multi-agent interaction; logical reasoning; decision quality | 9 specialized agents running sequentially with conditional edges, structured JSON reasoning, and real-time state sharing. | [graph.ts](file:///D:/cityBrain_google_hackathon/citybrain/services/api/src/orchestrator/graph.ts) |
| **Situation Detection & Analysis (20%)** | Accuracy of event detection; quality of insights | Chain-of-thought analysis fusing weather alerts, traffic congestion spikes, and multilingual social reports. | [crisis-detection.md](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/crisis-detection.md) |
| **Action Planning & Simulation (15%)** | Coordinated actions; simulation of reroutes, dispatch, and alerts | Dedicated digital twin simulation engine running physics-based flood spreads, traffic rerouting, and rescue dispatches. | [engine.ts](file:///D:/cityBrain_google_hackathon/citybrain/services/api/src/simulator/engine.ts) |
| **Technical Implementation (10%)** | Clean architecture; robust edge case handling; API integrations | Modular workspaces, database recovery loops, parameterized raw SQL, and Gemini API error fallbacks. | [index.ts](file:///D:/cityBrain_google_hackathon/citybrain/services/api/src/index.ts) |
| **Innovation & UX (10%)** | Monospace telemetry; 7-tab mobile/web ops interface; multilingual Urdu | Palantir-grade tactical dashboard with live WebSocket feeds and support for English, Urdu, and Roman Urdu. | [apps/mobile](file:///D:/cityBrain_google_hackathon/citybrain/apps/mobile) |

---

## 📐 System Architecture

CityBrain AI is structured around a **Clean Architecture Monorepo** powered by npm workspaces. Rationale and structure are detailed in the [PROJECT_STRUCTURE.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/PROJECT_STRUCTURE.md).

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

## 🤖 The 9-Agent Autonomous Pipeline

CityBrain AI coordinates emergency response using nine specialized agent nodes executing in sequence, built as structured prompts mapped to the Antigravity workflow:

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

1. **[Signal Extraction](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/signal-extraction.md)**: Normalizes raw incoming text (supports English, Urdu, and Roman Urdu), extracts entities, and extracts geolocations.
2. **[Crisis Detection](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/crisis-detection.md)**: Performs spatial clustering of anomalies using a 9-step Chain-of-Thought (CoT) sequence to declare crisis candidates.
3. **[Severity Reasoning](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/severity-reasoning.md)**: Fuses weather data, traffic feeds, and citizen alerts to compute the escalating severity level (`watch` ➜ `advisory` ➜ `operational` ➜ `critical`).
4. **[Planning](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/planning.md)**: Generates a prioritized response plan based on Standard Operating Procedures (SOPs).
5. **[Resource Allocation](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/resource-allocation.md)**: Allocates ambulances, water pumps, tow trucks, and shelter resources from the city's available inventory.
6. **[Traffic Rerouting](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/traffic-routing.md)**: (Conditional) Computes detour paths and road closures if there is road-blocking crisis.
7. **[Citizen Alert](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/citizen-alert.md)**: Drafts localized Urdu & English safety alerts and targets them at coordinates.
8. **[Execution](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/execution.md)**: Invokes the physical tool registry (updating maps, notifying hospitals, dispatching teams) and records audit logs.
9. **[Reflection](file:///D:/cityBrain_google_hackathon/citybrain/antigravity/agents/reflection.md)**: Close the loop. Measures the simulated outcome of the response plan against safety objectives. If targets fall short, it triggers an adaptive replan (re-running the planning cycle with a plan v2).

---

## ⚡ Key Innovations

* **Multilingual Crisis Extraction**: Successfully processes informal/noisy social media feeds in Roman Urdu (e.g., *"sadak swimming pool ban gayi"*) and extracts structure.
* **Closed-Loop Adaptive Replanning**: If the congestion reduction is $<25\%$ or stranded vehicles are reduced by $<10\%$, the reflection agent triggers an autonomous replan, adjusting weights to deployment tasks.
* **Digital Twin Physics Sim**: Simulates vehicle speeds, flood expansion rates, and rescue movement frames, streaming overlay frames via WebSockets.
* **pgvector Long-Term Memory**: Stores past crises and corresponding lessons learned as embeddings, retrieving past SOP results to prevent systemic failures (e.g., matching historical flood bypasses).
* **Double-Safety Fallback**: Integrates Google Gemini structured JSON outputs, but falls back to deterministic SOP state logic if API limits or keys fail.

---

## 🎬 5-Minute Cinematic Judge Walkthrough

To demo the complete system end-to-end as a judge would:

### 1. Launch the Karachi Flood Demo Scenario
Using the Web Command Center or via `curl`:
```bash
curl -X POST http://localhost:4000/api/v1/demo/scenarios/karachi_flood/run
```

### 2. Live Telemetry Walkthrough
Follow the execution across the 7 command-center tabs:
* **MAP Tab**: Watch 6 raw signals (in Urdu and English) pin onto Clifton/Saddar. The crisis centroid calculation clusters them, triggering a red flood overlay.
* **AI TRACE Tab**: Review the 9-agent progression live. Inspect the Chain-of-Thought logs generated by each agent.
* **ASSETS Tab**: See water pumps and Edhi ambulances get allocated out of the live inventory.
* **ALERTS Tab**: Read the multilingual alerts dispatched to citizens (*"Saddar Underpass bilkul band hai..."*).
* **EXEC Tab**: Inspect the raw tool audit trail (`dispatchRescueTeams`, `updateTrafficRoutes`, etc.).
* **DELTA Tab**: View the Before/After metrics showing the reduction of stranded vehicles.
* **REPLAN Banner**: Watch the system realize the Kashmir highway remains overloaded, triggering the Plan v2 loop in real-time.

For the full narration script, see [docs/DEMO_KARACHI_CINEMATIC.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/DEMO_KARACHI_CINEMATIC.md).

---

## 🛠️ Local Development & Setup

If you prefer to run the workspaces outside of Docker:

### 1. Database Setup
Ensure you have PostgreSQL with the `vector` extension running:
```bash
# Start Postgres container only
docker compose up postgres redis -d

# Install dependencies from root
npm install

# Run database migrations and seed inventory
npm run db:migrate
npm run db:seed
```

### 2. Spin Up Workspaces
Run these commands in separate terminal sessions:
```bash
# Terminal 1: Start Express Backend API
npm run dev:api

# Terminal 2: Start Expo Command Center (web dashboard)
npm run dev:web

# Terminal 3: Start Citizen Flutter App
npm run dev:citizen:flutter
```

---

## 📘 Detailed Documentation Directory

For deep-dives into the codebase, check out the specialized markdown files in [docs](file:///D:/cityBrain_google_hackathon/citybrain/docs):
* **Architecture Deep-Dive**: [ARCHITECTURE.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/ARCHITECTURE.md)
* **Backend Database Models**: [DATABASE_ARCHITECTURE.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/DATABASE_ARCHITECTURE.md)
* **API Routing and WebSockets**: [BACKEND_ARCHITECTURE.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/BACKEND_ARCHITECTURE.md)
* **Simulation Engine Details**: [SIMULATION_ENGINE.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/SIMULATION_ENGINE.md)
* **Individual Agent Specs**: [SIGNAL_EXTRACTION_AGENT.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/SIGNAL_EXTRACTION_AGENT.md), [CRISIS_DETECTION_AGENT.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/CRISIS_DETECTION_AGENT.md), [EMERGENCY_PLANNING_AGENT.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/EMERGENCY_PLANNING_AGENT.md), [EXECUTION_AGENT.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/EXECUTION_AGENT.md), [REFLECTION_AGENT.md](file:///D:/cityBrain_google_hackathon/citybrain/docs/REFLECTION_AGENT.md).

---

## ⚖️ License
Built for the **Google Antigravity Hackathon 2026** (Challenge 3: CIRO).  
*CityBrain AI — The city posts chaos. CityBrain posts coordinates.*
