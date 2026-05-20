# Execution Agent

> Built with [agent-tool-builder](../../antigravity-awesome-skills/plugins/antigravity-awesome-skills-claude/skills/agent-tool-builder/SKILL.md): rich tool descriptions, validation gates, informative errors, retry loops.

---

## 1. Execution architecture

```
ResponsePlan.actions[]
        │
        ▼
┌────────────────────────────────────────┐
│  resolver.ts → tool call list per action │
│  retry.ts → executeWithRetry (max 3)     │
│  tools.ts → 6 execution handlers         │
│  agent.ts → orchestration + WS + DB      │
└────────────────────────────────────────┘
        │
        ▼
execution_logs + executionReport + state.executionResults
```

**Code:** `services/api/src/agents/execution/`

---

## 2. Tool-calling system

Definitions: `packages/agent-tools/src/execution-tool-definitions.ts`  
Handlers: `services/api/src/agents/execution/tools.ts`

Each handler returns `ToolResult` → JSON with `success`, `content`, `errorType`, `suggestions`, `data`.

---

## 3. Execution logs

Every tool invocation writes to `execution_logs` via `ctx.logExecution`:

- `tool` name
- `actionId` (DB action row)
- `request` / `response` JSON
- `stateDelta`
- `status`: success | failed

---

## 4. Retry logic

`retry.ts`:

```typescript
executeWithRetry(fn, { maxRetries: 3, delayMs: 400 })
```

Retryable: `rate_limit`, `timeout`, `external_service`

---

## 5. Failure handling

- Per-action: `success` | `partial` | `failed` (multi-tool actions)
- Critical failures (`dispatch_emergency`, `deploy_pumps`) emit `execution.failed`
- Pipeline continues unless all actions fail
- Crisis status: `reflecting` or `monitoring` on total failure

---

## 6. WebSocket updates

| Event | When |
|-------|------|
| `execution.started` | Plan execution begins |
| `execution.progress` | Each action starts |
| `action.executed` | Action completes |
| `dashboard.updated` | Metrics/map sync |
| `execution.completed` | All actions done |
| `execution.failed` | Critical action failed |
| `map.delta` | Final map state |

---

## 7. Node.js implementation

```typescript
import { runExecutionAgent, applyExecutionToState } from './agents/execution';

const result = await runExecutionAgent(state, toolCtx, crisisId);
applyExecutionToState(state, result);
```

**Orchestration:** `graph.ts` `runExecution()` → agent (snapshots handled inside agent).

**Test:** `node services/api/scripts/test-execution-agent.mjs`

---

*Version 1.0*
