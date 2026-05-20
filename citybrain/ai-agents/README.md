# ai-agents/

Multi-agent orchestration, LLM integration, and tool-calling.

| Subfolder | Purpose |
|-----------|---------|
| `orchestrator/` | 9-agent pipeline graph + replan loop |
| `tools/` | Tool registry (geocode, routes, memory, …) |
| `prompts/` | Antigravity SKILL files + workflows |
| `bridge/` | Load prompts; export traces for submission |

**Imports:** `shared`, `simulation-engine` (via tools).  
**Must not import:** `frontend`.

See [docs/PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md).
