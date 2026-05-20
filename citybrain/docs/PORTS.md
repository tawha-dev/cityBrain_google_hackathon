# CityBrain port map

Dedicated ports so CityBrain does not clash with local Postgres (`5432`) or other Docker stacks (`5433` cibeg, etc.).

| Service | Host port | Notes |
|---------|-----------|--------|
| PostgreSQL | **5434** | `citybrain` / `citybrain` / `citybrain` |
| Redis | **6380** | |
| API | **4000** | `npm run dev:api` |
| Web (Vite dev) | **5174** | `npm run dev:web` |
| Web (Docker nginx) | **8180** | `docker compose up` |

## Local dev startup

```powershell
cd citybrain
docker compose up postgres redis -d
npm run dev:api
```

## Phone testing (Expo)

Replace `localhost` with your PC LAN IP, keep port **4000**:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:4000
EXPO_PUBLIC_WS_URL=ws://192.168.x.x:4000/ws
```
