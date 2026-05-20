# CityBrain AI — Cinematic 5-Minute Hackathon Demo

**Scenario:** Heavy rainfall causes severe urban flooding in **Karachi** (Clifton → Saddar corridor).  
**Scenario key:** `karachi_flood`  
**Launch:** Demo Control → **★ Karachi Heavy Rain Flood** — or `POST /api/v1/demo/scenarios/karachi_flood/run`

**Tone:** Palantir ops floor × autonomous crisis AI × high-stakes city command.  
**Structure:** Scene-by-scene (adapted from hackathon demo-script template — timing, talk track, UI choreography).

---

## Pre-flight (T−2 min, off-camera)

| Check | Action |
|-------|--------|
| Stack | `docker compose up --build -d` |
| UI | http://localhost:8080 (web) or Expo mobile |
| API | `curl http://localhost:4000/api/v1/health` |
| Maps | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` set (optional, embed works without) |
| Display | Full-screen browser, dark room, monospace zoom 110% |
| Audio | Low synth pad optional under narration (mute for Q&A) |

**Do not click launch until Scene 1 narration ends** — signals should *appear* as you speak.

---

## Act map (5:00 total)

| Time | Act | Demo step | Screen |
|------|-----|-----------|--------|
| 0:00–0:25 | **I — The Storm** | Citizens post reports | MAP + signal ticker |
| 0:25–0:55 | **II — Extraction** | AI extracts signals | TRACE |
| 0:55–1:25 | **III — Detection** | AI detects urban flood | TRACE |
| 1:25–1:55 | **IV — Severity** | AI reasons severity | TRACE |
| 1:55–2:15 | **V — Escalation** | AI predicts escalation | MAP (escalation badge) |
| 2:15–2:45 | **VI — Reroute** | AI reroutes traffic | MAP + EXEC |
| 2:45–3:15 | **VII — Rescue** | AI dispatches teams | ASSETS + EXEC |
| 3:15–3:40 | **VIII — Alerts** | AI alerts citizens | ALERTS |
| 3:40–4:10 | **IX — Outcomes** | AI evaluates results | DELTA + SIM |
| 4:10–4:45 | **X — Adaptation** | AI adapts strategy | TRACE (replan) |
| 4:45–5:00 | **Close** | Judge wow + ask | MAP or home |

---

## Scene 1 — The Storm (0:00–0:25)

**Demo step 1:** Citizens post crisis reports.

### Narration

> *"Karachi, 2:47 AM. Not a single operations center could read every cry for help — until now. Watch the city speak."*

### UI choreography

1. Open **Demo Control** (`/demo`).
2. Pause — let judges see the tactical UI.
3. **Do not launch yet.** Optionally show ops home with `StatusPulse` disconnected → connected.

### On launch (end of line)

- Tap **★ Karachi Heavy Rain Flood**.
- Auto-navigate to `/crisis/{id}` → **MAP** tab.
- **StatusPulse** → `connected`. Pipeline status → `detecting`.

### What appears (live)

- WS `signal.new` ×6: Roman Urdu Clifton post, English Saddar, PMD alert, traffic spike, Edhi field report, drain sensor.
- **Map hotspots** pin Clifton, Saddar, Korangi.
- HUD: `CONGESTION` climbing.

### Judge wow #1

> *"Six independent signals — three languages — one operational picture. No human pasted them."*

---

## Scene 2 — Signal Extraction (0:25–0:55)

**Demo step 2:** AI extracts structured signals.

### Narration

> *"CityBrain doesn't read tweets. It extracts operational intelligence — entities, geo, urgency, confidence — in milliseconds."*

### UI transition

- Swipe to **TRACE** tab.
- Scroll to newest trace: `signal_extraction` → **completed**.

### Reasoning trace (on screen / read aloud)

```
AGENT: signal_extraction
STATUS: completed
THOUGHT: Normalized 6 multilingual signals — entities: Clifton, Saddar, MA Jinnah Rd,
         Korangi; 2 critical urgency flags; drain gauge breach confirmed.
LATENCY: ~1.2s
```

### Execution log

*Not yet — stay on TRACE. Mention logs incoming.*

### Interaction point

> *"Every signal is structured before any human sees a map."*

---

## Scene 3 — Crisis Detection (0:55–1:25)

**Demo step 3:** AI detects urban flooding.

### Narration

> *"Separate posts are noise. A flood is a pattern. Nine-step chain-of-thought — cluster, correlate, classify."*

### UI

- TRACE: `crisis_detection` completes.
- Optional: tap crisis title in header — **Urban Flooding — Karachi**.

### Reasoning trace

```
AGENT: crisis_detection
THOUGHT: Fused 4-signal spatial cluster along Clifton–Saddar corridor. Event type: flood.
         Confidence 0.91. Primary hazard: urban inundation + stranded vehicles.
         Hypothesis: monsoon drain capacity exceeded — not isolated ponding.
```

### UI transition

- Quick swipe **MAP** — flood circle + congestion polyline should begin rendering.
- Point at legend chips: `HOTSPOT` `FLOOD` `CONGESTION`.

### Judge wow #2

> *"It didn't keyword-match 'flood.' It fused weather, traffic, social, and sensor proof."*

---

## Scene 4 — Severity Reasoning (1:25–1:55)

**Demo step 4:** AI reasons about severity.

### Narration

> *"How bad is it — really? Severity isn't a feeling. It's weather fusion, traffic physics, and life-safety impact."*

### UI

- TRACE: `severity_reasoning` completed.
- Header escalation badge: **WATCH → OPERATIONAL → CRITICAL** (as WS fires).

### Reasoning trace

```
AGENT: severity_reasoning
THOUGHT: Severity CRITICAL. Congestion index 0.87. Estimated 120+ stranded vehicles.
         Hospital access risk on MA Jinnah corridor. Escalation: CRITICAL — full auto-response authorized.
```

### Map animation

- Flood zone **pulse** (expanding blue circle).
- Congestion corridor thickens red.

---

## Scene 5 — Escalation Prediction (1:55–2:15)

**Demo step 5:** AI predicts escalation.

### Narration

> *"The system doesn't wait for the water to win. It predicts escalation windows — and pre-positions response."*

### UI

- **MAP** tab — point to escalation chip in `OpsHeader`.
- Metrics strip: `CONGESTION 87%` · `STRANDED 120` · `FLOOD 0.48 km²` (sim metrics as pipeline runs).

### Reasoning trace (planning preview on TRACE)

```
AGENT: planning
THOUGHT: Emergency plan v1 — phased: IMMEDIATE reroute + rescue dispatch;
         CONTAINMENT pump allocation; RECOVERY citizen comms. Replan threshold armed.
```

### Judge wow #3

> *"Escalation isn't an alert level — it's a trigger for autonomous execution."*

---

## Scene 6 — Traffic Reroute (2:15–2:45)

**Demo step 6:** AI reroutes traffic.

### Narration

> *"Every minute on a flooded corridor costs lives. CityBrain computes detours — and pushes them to the map in real time."*

### UI transition

- **MAP** — cyan **dashed reroute polyline** appears (`reroute_path`).
- Swipe **EXEC** — execution logs streaming.

### Execution log (read 2–3 lines)

```
TOOL: updateTrafficRoutes
STATUS: success
RESPONSE: Alternate route MA Jinnah → Boat Basin → Khayaban-e-Iqbal; congestionDelta -0.34

TOOL: apply_road_closure
STATUS: success
RESPONSE: Closed submerged segment Saddar underpass approach
```

### Map animation

- Reroute path draws (cyan dashed).
- Closed road segment (red) on Saddar approach.

### Talk track

> *"This is a simulated city twin — same APIs we'd use for live traffic management integrations."*

---

## Scene 7 — Rescue Dispatch (2:45–3:15)

**Demo step 7:** AI dispatches rescue teams.

### Narration

> *"Alerts don't save people in water. Assets do. Watch rescue units move on the map."*

### UI transition

- **ASSETS** tab — resource grid populates.
- **MAP** — green `rescue_unit` markers; count in HUD `RESCUE 4`.

### Reasoning trace

```
AGENT: resource_allocation
THOUGHT: Allocated 4 units — 2 water rescue (Clifton), 1 ambulance (Saddar), 1 pump team (drain KHI-07).

AGENT: execution
THOUGHT: dispatch_emergency ×2 success; deploy_pumps success; createEmergencyTicket KHI-FLOOD-001
```

### Execution log

```
TOOL: dispatchRescueTeams
STATUS: success
RESPONSE: Units R-12, R-15 en route Clifton Block 5 — ETA 6 min

TOOL: notifyHospitals
STATUS: success
RESPONSE: Jinnah Postgraduate notified — surge protocol activated
```

### Judge wow #4

> *"Plan → allocate → execute → log. Fully traced. Fully auditable. Zero black box."*

---

## Scene 8 — Citizen Alerts (3:15–3:40)

**Demo step 8:** AI sends citizen alerts.

### Narration

> *"A city that only helps drivers fails its citizens. Multilingual alerts — English and Urdu — segmented by flood zone."*

### UI transition

- **ALERTS** tab.
- Show reach estimate + preview text.

### Reasoning trace

```
AGENT: citizen_alert
THOUGHT: Drafted EN/UR alerts for Clifton + Saddar zones. Reach ~84,000 citizens.
         Segment: high-risk low-elevation blocks first.
```

### Execution log

```
TOOL: sendEmergencyAlerts
STATUS: success
RESPONSE: SMS/push simulation — 84,200 recipients; languages: en, ur
```

### Map

- Amber `alert_zone` ring pulses on MAP.

---

## Scene 9 — Outcome Evaluation (3:40–4:10)

**Demo step 9:** AI evaluates outcomes.

### Narration

> *"Most systems stop at 'we sent help.' CityBrain measures whether the city is actually getting better."*

### UI transition

- **DELTA** tab (Before vs After Analysis).
- **SIM** tab — simulation viewport, scanline, tick counter.

### Metrics (target on screen)

| Metric | Before | After |
|--------|--------|-------|
| Congestion | ~87% | ~52% |
| Stranded vehicles | ~120 | ~45 |
| Flood coverage | 0.48 km² | 0.31 km² |
| Alerts reach | 0 | 84,200 |

### Reasoning trace

```
AGENT: reflection
THOUGHT: Outcome score 0.71. Congestion reduction 35%. Stranded reduction 62%.
         Lessons: Saddar underpass still bottleneck; Korangi access degraded.
         REPLAN REQUIRED: corridor saturation above threshold.
```

### Judge wow #5

> *"It scored its own response — and found what didn't work."*

---

## Scene 10 — Adaptive Strategy (4:10–4:45)

**Demo step 10:** AI adapts response strategy.

### Narration

> *"This is the moment. CityBrain doesn't celebrate partial wins. It replans — version two — while the crisis is still live."*

### UI transition

- **TRACE** — scroll to `pipeline.replan` / second `planning` pass.
- **MAP** — updated reroute v2, additional rescue marker.
- Escalation holds **CRITICAL**.

### Reasoning trace

```
AGENT: reflection → planning (v2)
THOUGHT: Replan triggered — MA Jinnah partial recovery insufficient.
         v2 actions: extend detour via Korangi Creek Road; dispatch 2nd pump team;
         narrow alert to Korangi enclave. Adaptive loop closed in <90s.
```

### Execution log

```
PIPELINE: replan
TOOL: updateTrafficRoutes (v2)
STATUS: success

TOOL: dispatchRescueTeams
STATUS: success — R-18 Korangi Creek enclave
```

### Judge wow #6 (closer)

> *"Nine agents. One autonomous loop. Observe → decide → act → measure → adapt. That's not a copilot. That's an operating system for crisis."*

---

## Scene 11 — Close (4:45–5:00)

### Narration

> *"CityBrain AI — autonomous crisis intelligence for cities that can't afford to guess. Built on Google Antigravity, Gemini structured reasoning, and a full simulation twin. Karachi tonight. Any city tomorrow."*

### Optional flash

- `antigravity/traces/sample-g10-flood.json` (same pipeline shape; mention Karachi trace after hackathon).
- Architecture slide: 9-agent graph from `docs/BACKEND_ARCHITECTURE.md`.

### Ask

> *"What would you want CityBrain to coordinate next — heatwave, grid failure, or multi-city?"*

---

## UI transition cheat sheet

```
/demo
  └─ tap ★ Karachi Heavy Rain Flood
       └─ /crisis/[id]/index     MAP      ← Acts 1, 5, 6, 7, 10
            ├─ timeline           TRACE    ← Acts 2–4, 10
            ├─ execution          EXEC     ← Acts 6–8, 10
            ├─ resources          ASSETS   ← Act 7
            ├─ alerts             ALERTS   ← Act 8
            ├─ simulation         SIM      ← Act 9
            └─ analysis             DELTA    ← Act 9
```

**Swipe rhythm:** MAP → TRACE → MAP → EXEC → ASSETS → ALERTS → DELTA → SIM → TRACE → MAP.

---

## WebSocket events to narrate (optional callouts)

| Event | Say |
|-------|-----|
| `signal.new` | *"Another citizen report — structured instantly."* |
| `agent.step` | *"Agent {name} thinking..."* |
| `map.delta` | *"Map layers updating — no refresh."* |
| `action.executed` | *"Tool confirmed in the field."* |
| `simulation.frame` | *"Digital twin advancing."* |
| `dashboard.updated` | *"Before snapshot locked — measuring impact."* |
| `pipeline.replan` | *"Adaptive intelligence engaged."* |

---

## Backup lines (if something breaks)

| Issue | Line |
|-------|------|
| Gemini slow | *"Live reasoning — watch the trace populate."* |
| WS disconnect | *"Failsafe reconnect — ops centers don't drop feeds."* |
| Map blank web | *"Native build shows full polygons; embed shows satellite + HUD."* |
| Replan doesn't fire | *"Reflection threshold configurable — demo shows v1 outcome metrics regardless."* |

---

## API one-liner (for technical judges)

```bash
curl -X POST http://localhost:4000/api/v1/demo/scenarios/karachi_flood/run
```

---

## Antigravity submission hook

Reference workflow: `antigravity/workflows/citybrain-ciro.md`  
Agent prompts: `antigravity/agents/*.md`  
Map system: `docs/CRISIS_MAP_SYSTEM.md`

**Tagline for slide:** *"The city posts chaos. CityBrain posts coordinates."*
