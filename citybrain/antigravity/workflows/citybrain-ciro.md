# CityBrain CIRO — Antigravity Workflow

## Objective
Autonomous crisis intelligence pipeline for Islamabad smart city operations.

## Agent Graph (sequential with conditional branches)

1. **signal_extraction** — Normalize multilingual signals (EN/UR/Roman Urdu)
2. **crisis_detection** — Cluster anomalies → crisis candidate
3. **severity_reasoning** — Weather + traffic fusion → escalation level
4. **planning** — SOP-driven response plan
5. **resource_allocation** — Assign units from inventory
6. **traffic_rerouting** — (conditional) Alternate routes via Google Routes
7. **citizen_alert** — Zone alerts in 3 languages
8. **execution** — Simulate all planned actions
9. **reflection** — Score outcome; replan if congestion reduction < 25%

## Escalation Policy
- `watch` → monitoring only
- `advisory` → alerts prep
- `operational` → full pipeline auto-run
- `critical` → immediate execution + supervisor notify

## Tools
parse_signal, geocode, cluster_signals, query_memory, get_weather, get_traffic, load_sop, inventory_status, allocate_units, google_routes, apply_road_closure, draft_alert, segment_citizens, simulate_action, create_ticket, score_outcome, write_memory

## Demo Entry
`POST /api/v1/demo/scenarios/g10_flood/run`
