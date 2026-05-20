# backend/

API gateway, domain services, and database.

| Subfolder | Purpose |
|-----------|---------|
| `api-gateway/` | Express REST + WebSocket — thin controllers |
| `core/` | Business logic by feature (crisis, signals, memory) |
| `database/` | Migrations, seeds, connection pool |

**Imports:** `shared`, `ai-agents`, `simulation-engine`.  
**Must not import:** `frontend`.

See [docs/PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md).
