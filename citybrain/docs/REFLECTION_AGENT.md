# Reflection Agent

> Implements [`antigravity/agents/reflection.md`](../antigravity/agents/reflection.md) — post-execution CoT, adaptive replan, crisis memory.

---

## 1. Reflection architecture

```
executionResults + executionReport + severity
        │
        ▼
┌─────────────────────────────────────────┐
│ effectiveness → metrics & outcome score  │
│ mitigation-analysis → failed actions     │
│ risk-analysis → unresolved risks         │
│ adaptive-response → directives + replan  │
│ reasoning → 5-step CoT trace             │
│ autonomous → apply severity + replan flag│
│ escalation → workflow record               │
└─────────────────────────────────────────┘
        │
        ▼
ReflectionAnalysis + ReflectionReport + write_memory
```

**Code:** `services/api/src/agents/reflection/`

---

## 2. Adaptive planning logic

Replan when (and `planVersion < 2`):

- `congestionReduction < 0.25` OR
- `strandedReduction < 0.10` OR
- `outcomeScore < 0.55` OR
- Any **critical** unresolved risk

Pipeline re-runs `planning` → `execution` → reflection (replan pass).

---

## 3. Secondary response generation

`generateAdaptiveDirectives()` emits:

| Directive | Trigger |
|-----------|---------|
| `escalate_severity` | Critical risks / low outcome |
| `expand_rerouting` | Congestion still rising |
| `dispatch_secondary_teams` | Rescue delay / flood spread |
| `broaden_alerts` | Multiple risks / low reach |

Consumed by Emergency Planning Agent on `planVersion > 1`.

---

## 4. Escalation workflows

`escalation.ts` bumps `severity.level` and `escalationLevel` (max `critical`), logs `escalationWorkflow`, broadcasts `escalation.changed`.

---

## 5. Autonomous adjustment system

`autonomous.ts` applies directives to `CrisisRunState`:

- Severity / escalation update
- `replanRequired` flag
- `state.reflectionAnalysis` + `adaptiveDirectives` for downstream agents

---

## 6. Node.js implementation

```typescript
import { runReflectionAgent, applyReflectionToState } from './agents/reflection';

const result = await runReflectionAgent(state, toolCtx, crisisId, false);
applyReflectionToState(state, result);
```

**Orchestration:** `graph.ts` `runReflection()`; replan loop on `replanRequired`.

**Test:** `node services/api/scripts/test-reflection-agent.mjs`

---

*Version 1.0*
