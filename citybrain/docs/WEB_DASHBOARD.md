# CityBrain Authority Web Dashboard

Vite + React command center for emergency operators (web-only).

## Run (development)

```bash
cd citybrain
npm install
npm run dev:api
npm run dev:web
```

Open http://localhost:5174

Env (optional): `VITE_API_URL`, `VITE_WS_URL` in `.env` (default API **4000**)

## Production (Docker)

```bash
docker compose up --build
```

- API: http://localhost:4000
- Dashboard: http://localhost:8180 (nginx proxies `/api` and `/ws`)
- Postgres: localhost:5434 · Redis: localhost:6380

## Features

- **Crisis inbox** — all active crises
- **Citizen dossier** — report text, map coords, validation score breakdown
- **Dispatch console** — `POST /crises/:id/dispatch` (ambulance, rescue, pumps)
- **Live WS** — agent steps, signals, pipeline events (subscribe as `authority`)

## Key routes

| Page | API |
|------|-----|
| Inbox | `GET /crises` |
| Crisis detail | `GET /crises/:id/dossier` |
| Dispatch | `POST /crises/:id/dispatch` |
