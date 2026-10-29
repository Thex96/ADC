Child Tracking Device (CTD)

A full-stack GPS tracker using ESP32 + GPS module, with user accounts, device registration, device pairing tokens, a live dashboard map, location history, and a protected GPS ingestion API.

Features
Account registration and login.
MongoDB Atlas persistence for users, devices, and location history.
Device registration with a unique device ID and a one-time-visible device API token.
Per-user device access control.
Dashboard with online/offline status, latest coordinates, speed, altitude, satellite count, and estimated accuracy when provided.
Leaflet map using OpenStreetMap tiles.
Device detail page and recent location history.

Register and connect a device

1. Register an account and sign in.
2. Open Devices and choose Add device.
3. Enter a friendly name and a unique device ID for your hardware.
4. Copy the device token shown after registration. It is shown only once.
5. Set the Wi-Fi credentials, API URL, device ID, and device token.
6. Flash the sketch to the ESP32. The device must be able to reach the backend over the network.
7. Place the GPS antenna outdoors with a clear view of the sky. Wait for a valid fix.

Accuracy notes

The website cannot improve the GPS receiver's underlying accuracy. The firmware sends the available coordinates, satellite count, speed, altitude, HDOP-derived estimated accuracy when available, and fix age. HDOP is an indicator and not a guaranteed error radius. Displayed coordinates are not more accurate just because they contain more decimal places.

The dashboard rejects stale fixes for live status. GPS performance depends on the module, antenna, sky visibility, multipath reflections, interference, and satellite geometry. For substantially better accuracy, use a capable multi-constellation/multi-band receiver; centimetre-level positioning generally requires RTK-capable hardware and correction data.
