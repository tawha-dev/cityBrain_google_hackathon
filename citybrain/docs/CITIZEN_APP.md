# CityBrain Citizen App (Flutter)

Flutter mobile app for citizens to report emergencies with live AI validation progress and a results dashboard.

## Stack

- Flutter 3 · Riverpod · go_router · Dio · web_socket_channel
- geolocator · google_maps_flutter · flutter_secure_storage

## Run

```bash
cd citybrain
npm install
npm run dev:api

# New terminal
cd apps/citizen_flutter
cp env/dev.json.example env/dev.json
# Edit API_BASE_URL — LAN IP on physical device; 10.0.2.2:4000 on Android emulator

flutter pub get
flutter run --dart-define-from-file=env/dev.json
```

Or from monorepo root:

```bash
npm run dev:citizen:flutter
```

## Flow

1. **Home** — Report Now + past reports (by anonymous `deviceId`)
2. **Report** — Category, description, language
3. **Location** — GPS pin on map
4. **Submit** — `POST /api/v1/citizen/reports` (202)
5. **Dashboard** — WebSocket `citizen.progress` + validation score + dossier
6. **Route** — `GET /api/v1/citizen/reports/:id/route` + Google Maps deep link

## API

| Endpoint | Purpose |
|----------|---------|
| `POST /citizen/reports` | Submit alert |
| `GET /citizen/reports` | List device reports |
| `GET /citizen/reports/:id` | Status + timeline |
| `GET /crises/:id/dossier` | Validation breakdown + crisis summary |
| `GET /citizen/reports/:id/route` | Safe route polyline |

Header: `X-Device-Id` (UUID in secure storage)

WebSocket: subscribe `{ "role": "citizen", "reportId": "...", "crisisId": "..." }`
