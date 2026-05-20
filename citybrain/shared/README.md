# shared/

Cross-cutting contracts used by all packages.

| Subfolder | Purpose |
|-----------|---------|
| `types/` | Domain TypeScript types |
| `schemas/` | Zod validation |
| `events/` | WebSocket event envelopes |
| `constants/` | Agent pipeline, escalation levels |

**Must not import** any other CityBrain package.

See [docs/PROJECT_STRUCTURE.md](../docs/PROJECT_STRUCTURE.md).
