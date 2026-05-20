# CityBrain API — Swagger UI

Interactive API docs and **Try it out** testing for the full REST surface.

## URLs

| Environment | Swagger UI | OpenAPI JSON |
|-------------|------------|--------------|
| API direct | http://localhost:4000/api-docs | http://localhost:4000/api-docs.json |
| Via nginx | http://localhost:8180/api-docs | http://localhost:8180/api-docs.json |

After `docker compose up --build -d`, open either URL in the browser.

## Senior demo flow (API testing)

1. **Authorize** (top right): set `X-Device-Id` = `swagger-test-device` for citizen endpoints.
2. **Demo** → `POST /demo/scenarios/{key}/run` → `karachi_flood` → copy `crisisId` from response.
3. **Crises** → `GET /crises/{id}/dossier` — paste `crisisId`.
4. **Dispatch** → `GET /crises/{id}/nearby-resources` → `POST /crises/{id}/dispatch` with body:
   ```json
   { "units": ["ambulance"], "note": "Swagger test dispatch" }
   ```
5. **Dispatch** → `GET /crises/{id}/dispatches` — verify log.
6. **Citizen path** (optional): `POST /citizen/reports` with fire/accident category + Karachi coords.

## Server selector

- **API direct** — `http://localhost:4000/api/v1` (recommended for Try it out).
- **Via nginx** — `http://localhost:8180/api/v1` (same routes, proxied).

## Not in Swagger

- **WebSocket** `ws://localhost:4000/ws` — real-time crisis/dispatch events.
- Root health: `GET http://localhost:4000/health` (outside `/api/v1`).

## Rebuild after spec changes

```bash
cd google_hacki/citybrain
docker compose up --build -d
```

Spec source: `services/api/src/swagger/openapi.ts`
