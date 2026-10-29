# TrackPoint GPS Tracker

A full-stack GPS tracker starter for ESP32 + GPS module, with user accounts, device registration, device pairing tokens, a live dashboard map, location history, and a protected GPS ingestion API.

## Features

- Account registration and login with JWT authentication.
- MongoDB persistence for users, devices, and location history.
- Device registration with a unique device ID and a one-time-visible device API token.
- Per-user device access control.
- Dashboard with online/offline status, latest coordinates, speed, altitude, satellite count, and estimated accuracy when provided.
- Leaflet map using OpenStreetMap tiles.
- Device detail page and recent location history.
- ESP32 Arduino sketch in `firmware/trackpoint_esp32.ino`.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB local instance or MongoDB Atlas connection string
- ESP32 board and GPS module for real tracking

## Setup

1. Install dependencies from this folder:

   ```bash
   npm install
   ```

2. Create `server/.env` from `server/.env.example` and set a strong `JWT_SECRET`, your MongoDB URI, and your client URL.

3. Start MongoDB, then run:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.

The frontend uses `VITE_API_URL=http://localhost:5000/api` by default. To change it, create `client/.env` based on `client/.env.example`.

## Register and connect a device

1. Register an account and sign in.
2. Open Devices and choose Add device.
3. Enter a friendly name and a unique device ID for your hardware.
4. Copy the device token shown after registration. It is shown only once.
5. Set the Wi-Fi credentials, API URL, device ID, and device token in `firmware/trackpoint_esp32.ino`.
6. Flash the sketch to the ESP32. The device must be able to reach the backend over the network.
7. Place the GPS antenna outdoors with a clear view of the sky. Wait for a valid fix.

For a remote deployment, the ESP32 API URL must be a publicly reachable HTTPS endpoint. A local `localhost` URL will not work from the ESP32.

## Accuracy notes

The website cannot improve the GPS receiver's underlying accuracy. The firmware sends the available coordinates, satellite count, speed, altitude, HDOP-derived estimated accuracy when available, and fix age. HDOP is an indicator and not a guaranteed error radius. Displayed coordinates are not more accurate just because they contain more decimal places.

The dashboard rejects stale fixes for live status. GPS performance depends on the module, antenna, sky visibility, multipath reflections, interference, and satellite geometry. For substantially better accuracy, use a capable multi-constellation/multi-band receiver; centimetre-level positioning generally requires RTK-capable hardware and correction data.

## API

- `POST /api/auth/register` — create an account
- `POST /api/auth/login` — sign in
- `GET /api/auth/me` — current account
- `GET /api/devices` — list devices owned by the signed-in user
- `POST /api/devices` — register a device
- `GET /api/devices/:id` — device details and recent history
- `DELETE /api/devices/:id` — delete a device
- `POST /api/telemetry/:deviceId` — device-authenticated location upload
- `GET /api/health` — backend health check

The telemetry endpoint uses the device token in the `x-device-token` header. User APIs use `Authorization: Bearer <JWT>`.

## Security and production checklist

This is a complete local-development starter, not a fully audited production service. Before public deployment, use HTTPS, configure strict CORS origins, use a strong secret, add rate limiting and email verification/password recovery, configure database backups, rotate device tokens if exposed, and review data retention and privacy requirements. Never commit `.env` or device tokens.
