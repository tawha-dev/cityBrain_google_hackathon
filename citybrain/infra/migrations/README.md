# Database migrations (Docker init)

Files in this folder run **in alphabetical order** on first Postgres start (`docker-entrypoint-initdb.d`).

| File | Purpose |
|------|---------|
| `001_init.sql` | **Active API schema** (v1) — used by `services/api` |
| `004_v1_compat_views.sql` | Placeholder / optional compat (mostly commented) |

**v2 enterprise schema** (`002`, `003`) lives in [`../migrations-v2/`](../migrations-v2/) and is **not** applied automatically. The runtime API still targets v1 tables (`crises`, `signals`, `resources`, etc.).

If you previously ran v2 init and see `relation "resources" does not exist`, reset the DB:

```bash
docker compose down -v
docker compose up --build -d
```
