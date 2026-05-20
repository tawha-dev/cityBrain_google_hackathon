# Antigravity Demo Artifact — Karachi Flood (Cinematic)

**Workflow:** `citybrain-ciro`  
**Scenario key:** `karachi_flood`  
**Duration:** 5:00  

## Launch

```http
POST /api/v1/demo/scenarios/karachi_flood/run
```

## Agent sequence (autonomous)

1. `signal_extraction` — 6 signals EN / Roman Urdu / sensor
2. `crisis_detection` — urban flood cluster Clifton–Saddar
3. `severity_reasoning` — CRITICAL escalation
4. `planning` — phased emergency plan v1
5. `resource_allocation` — rescue + pump units
6. `traffic_rerouting` — detour + closure
7. `citizen_alert` — EN/UR segmented alerts
8. `execution` — tool calls with retry + WS logs
9. `reflection` — outcome score → replan if threshold

## Judge moments

| # | Moment |
|---|--------|
| 1 | Multilingual signals fuse without human ETL |
| 2 | CoT crisis detection — not keyword flood |
| 3 | Escalation triggers autonomous execution |
| 4 | Full execution audit trail |
| 5 | Measured before/after outcomes |
| 6 | Adaptive replan v2 while crisis live |

## Full script

See `docs/DEMO_KARACHI_CINEMATIC.md`.
