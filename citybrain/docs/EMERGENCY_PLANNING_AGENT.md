# Emergency Planning Agent

> Adapted from [decision-frameworks](../../antigravity-awesome-skills/skills/energy-procurement/references/decision-frameworks.md): weighted evaluation matrices, decision trees, layered sequencing, and adaptive replan triggers.

---

## 1. Planning system

```
CrisisRunState + severity + inventory + traffic
        │
        ▼
┌─────────────────────────────────────┐
│  SOP load + action catalog (by type) │
│  Decision tree → viable actions      │
│  Prioritization matrix → rankScore   │
│  Sequencing engine → phased order    │
│  Impact estimator → aggregate Δ      │
│  Adaptive layer (planVersion > 1)    │
└─────────────────────────────────────┘
        │
        ▼
EmergencyPlanReport + ResponsePlan (pipeline)
```

**Code:** `services/api/src/agents/emergency-planning/`

---

## 2. Prioritization engine

`prioritization.ts` — composite score per action:

```
rankScore =
  0.35 × lifeSafety +
  0.25 × congestionRelief +
  0.15 × resourceAvailability +
  0.15 × speedToEffect +
  0.10 × escalationAlignment
```

Congestion ≥ 0.75 boosts reroute/close actions. Low pump inventory penalizes `allocate_pumps`.

---

## 3. Action ranking

`ranking.ts` sorts by `rankScore` descending; assigns `priority` 1–10 and per-criterion breakdown in `criteriaScores`.

---

## 4. Execution sequencing

`sequencing.ts` — staggered phases (like staggered startup protocols):

| Phase | Typical actions |
|-------|-----------------|
| immediate | rescue, hospitals, pumps |
| containment | close roads, reroute |
| recovery | alerts |

`state.plan.actions` ordered by `sequenceOrder` for simulator execution.

---

## 5. Impact estimation

`impact.ts` per action:

- `congestionDelta` (negative = improvement)
- `strandedReduction` (0–1)
- `livesRiskReduction`
- `etaMinutes`

`aggregateImpact` combines with compound stranded relief formula.

---

## 6. Adaptive planning

`adaptive.ts` when `planVersion > 1`:

- +18 rank to secondary reroute
- +10 close-road on floods
- Inject "Kashmir Hwy spillover" reroute if missing

Triggered by pipeline replan edge after reflection.

---

## 7. Node.js implementation

```typescript
import { runEmergencyPlanningAgent, applyEmergencyPlanningToState } from './agents/emergency-planning';

const result = await runEmergencyPlanningAgent(state, toolCtx);
applyEmergencyPlanningToState(state, result);
// result.plan → ResponsePlan for execution agent
// result.rankedActions → full audit trail
```

**Orchestration:** `graph.ts` `runPlanning()` delegates to agent.

**Test:** `node services/api/scripts/test-emergency-planning.mjs`

---

*Version 1.0*
