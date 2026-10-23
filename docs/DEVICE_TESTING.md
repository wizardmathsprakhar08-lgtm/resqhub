# ResQHub Device & Field Testing Guide

## 1. Prerequisites

### Mobile Development
- Node.js >= 18 (installed: Node 22+)
- Android Studio with Android SDK Platform 34 or 35
- Android Virtual Device (AVD) with Google Play Services, or a physical Android test device
- Expo CLI (`npx expo`)
- Optional: EAS CLI (`npm install -g eas-cli`)

### Backend Environment
- Python 3.10+ (installed: Python 3.14)
- Virtual environment (`venv`)
- SQLite (built-in) or PostgreSQL instance
- ngrok or localtunnel (for exposing Twilio status callback webhooks during local testing)

---

## 2. Setting Up the Development Build

Because ResQHub uses native modules (`expo-sensors`, `expo-sqlite`, `expo-location`, `expo-contacts`, `expo-secure-store`), a custom Development Build (`expo-dev-client`) is recommended over standard Expo Go.

### 2.1 Installing Dependencies
From `resqhub/mobile`:
```bash
npm install
```

### 2.2 Prebuilding Native Android Project
To generate the native `android/` directory and configure AndroidManifest permissions:
```bash
npx expo prebuild --platform android
```

### 2.3 Running the Development Client
On an attached Android device with USB debugging enabled, or an active Android emulator:
```bash
npx expo run:android
```
Or start the Metro development server:
```bash
npx expo start --dev-client
```

---

## 3. Physical Device vs Emulator Capabilities

| Feature | Android Emulator | Physical Android Device |
|---------|------------------|-------------------------|
| **Accelerometer Shake Detection** | Requires Virtual Sensors slider in Extended Controls | Direct physical shake |
| **GPS Geolocation** | Simulated coordinates via Emulator Extended Controls | Real device GPS receiver |
| **SMS Composition (`sms:`)** | Opens mock SMS app | Opens default SMS app with SIM |
| **Phone Call (`tel:`)** | Opens mock dialer | Opens default phone dialer |
| **Device Contacts Picker** | Requires pre-populating emulator contacts | Reads real Google/SIM contacts |
| **Haptic Feedback / Vibration** | Emulated via console or silent | Physical device haptic motor |

---

## 4. End-to-End Test Scenarios

### Scenario A: First Run & Permission Education
1. Launch ResQHub.
2. Tap "Get Started" or view Onboarding.
3. Review Permission Education cards for Location, Contacts, and Sensors.
4. Verify contextual permission requests appear with clear explanations.

### Scenario B: Adding Emergency Contacts
1. Navigate to "Contacts" tab.
2. Verify empty state displays with "Add First Contact" callout.
3. Tap "+ Add Contact".
4. Enter Name "Jane Doe" and Phone "9876543210". Tap "Save Contact".
5. Verify contact is saved to SQLite and appears in the list.
6. Tap "Import from Phonebook" (after granting permission) and pick a contact.
7. Verify contact count updates (e.g. `2/5`).
8. Attempt to add a 6th contact; verify the 5-contact maximum limit alert is enforced.

### Scenario C: SOS Rapid Activation (500ms) & Graceful Abort (3s)
1. From Home screen, press and hold the SOS button for **0.5 seconds (500 ms)**.
2. The SOS state changes to `confirming` with an animated **3-second countdown timer**.
3. Releasing before 500 ms cancels immediately without activating the countdown.
4. While the 3-second countdown is active, tap "CANCEL SOS" before the timer reaches 0.
5. Verify the alert cancels cleanly and the modal dismisses. No backend dispatch or SMS is initiated.

### Scenario D: SOS Full Trigger & Automated Server SMS Dispatch
1. From Home screen, press and hold SOS for 500ms and allow the 3-second countdown to complete (or tap "Send Immediately").
2. The SOS state machine advances through:
   - `confirming` -> `locating`
   - GPS coordinates are fetched (rapid satellite fix with 8s bounded timeout, or labeled cached position fallback).
   - Message is assembled per Phase 7 specifications with full latitude, longitude, maps link, timestamp, timezone, and accuracy.
   - Transitions to `sending`.
   - Dispatches payload to FastAPI backend via `POST /api/v1/alerts`.
3. Screen transitions to `Active Alert Status`.
4. Shows recipient delivery status: `queued` -> `accepted` / `delivered`.
5. Background delivery polling updates recipient statuses automatically every 3 seconds.
6. Tap "I AM SAFE — RESOLVE ALERT" once help is secured.

### Scenario E: Physical Phone & Backend Server Testing
1. Connect phone and PC to the same Wi-Fi.
2. Ensure FastAPI is running on `0.0.0.0:8000`.
3. Open ResQHub Settings on phone -> expand "Developer & Server Settings".
4. Enter PC's LAN IP: `http://192.168.x.x:8000/api/v1`.
5. Tap "Save", then tap "Test Connection".
6. Verify status displays `Operational (xx ms)`.

### Scenario F: Offline Fallback & Native Dialer
1. Place phone in Airplane Mode (or enter invalid server URL).
2. Trigger SOS.
3. Server dispatch safely times out after 15s without freezing the UI.
4. App transitions to `failed` and surfaces:
   - Specific failure diagnosis explanation with configuration advice.
   - "Retry Server Dispatch" button.
   - "Compose SMS via SIM" button opening the native SMS app with pre-filled coordinates.
   - "Call Primary Emergency Line (112)" button opening device dialer.
