# CityBrain AI — Demo Scripts

## Primary (5-min cinematic — Karachi flood)

**Full scene-by-scene script:** [`DEMO_KARACHI_CINEMATIC.md`](./DEMO_KARACHI_CINEMATIC.md)

- Scenario: `karachi_flood` — heavy rainfall, Clifton/Saddar urban flooding
- Launch: Demo Control → **★ Karachi Heavy Rain Flood**
- Includes: narration, UI transitions, traces, execution logs, map beats, 6 judge wow moments

## Quick reference (Islamabad G-10)

**Setup:** `docker compose up --build -d` → http://localhost:8080

| Time | Action |
|------|--------|
| 0:00 | Hook — autonomous ops OS, not a chatbot |
| 0:30 | Demo → G-10 Urban Flood |
| 1:00 | TRACE — extraction → detection → severity |
| 2:30 | EXEC — reroute, rescue, alerts |
| 3:15 | DELTA — before/after metrics |
| 3:45 | TRACE — reflection replan |
| 4:45 | Close |

## API

```bash
# Karachi (judge demo)
curl -X POST http://localhost:4000/api/v1/demo/scenarios/karachi_flood/run

# Islamabad fallback
curl -X POST http://localhost:4000/api/v1/demo/scenarios/g10_flood/run
```