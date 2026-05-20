# CityBrain Citizen (Flutter)

Citizen emergency reporting app: submit alerts, watch live AI validation, view results dashboard.

## Prerequisites

- Flutter 3.16+ / Dart 3.11+
- CityBrain API running (`npm run dev:api` from `citybrain/`)
- Postgres + Redis (see main README)

## Configure API URL (important for physical phone)

Edit **`assets/config/api_config.json`** (main source — loaded every run):

```json
{
  "API_BASE_URL": "http://YOUR_PC_LAN_IP:4000",
  "WS_URL": "ws://YOUR_PC_LAN_IP:4000/ws"
}
```

Run `ipconfig` on Windows and use your Wi‑Fi IPv4 (e.g. `192.168.18.6`).

- **Physical phone:** use LAN IP — **not** `10.0.2.2`
- **Android emulator only:** `http://10.0.2.2:4000`

Optional: `env/dev.json` + `flutter run --dart-define-from-file=env/dev.json` overrides the asset file.

Optional Google Maps (location picker + route map):

- Add `GOOGLE_MAPS_API_KEY=...` to `android/local.properties`
- Pass the same key via `--dart-define=GOOGLE_MAPS_API_KEY=...`

## Run

```bash
cd apps/citizen_flutter
flutter pub get
flutter run --dart-define-from-file=env/dev.json
```

After changing `AndroidManifest.xml` or `env/dev.json`, run `flutter clean` then a full `flutter run` (not hot reload).

## Android HTTP (LAN dev API)

The app uses `http://` to your PC. `AndroidManifest.xml` sets `usesCleartextTraffic` and `res/xml/network_security_config.xml`. Maps key must be in **both** `env/dev.json` and `android/local.properties` as `GOOGLE_MAPS_API_KEY`.

From monorepo root:

```bash
npm run dev:citizen:flutter
```

## Flow

1. **Home** — Report Now + past reports
2. **Report** — Category, description, language, map pin
3. **Submit** — `POST /api/v1/citizen/reports`
4. **Dashboard** — WebSocket progress + validation score + dossier
5. **Safe route** — Polyline + open in Google Maps
