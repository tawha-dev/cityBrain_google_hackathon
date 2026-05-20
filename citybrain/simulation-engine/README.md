# simulation-engine/

Deterministic execution of crisis response actions.

| Subfolder | Purpose |
|-----------|---------|
| `src/actions/` | One handler per action type (reroute, alert, dispatch, …) |
| `src/state/` | Before/after city snapshots |
| `src/adapters/` | Google Routes (live) vs mock (demo) |

**Rules:** No LLM calls. Idempotent. Always emit `state_delta` + execution logs.

See [docs/PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md).
