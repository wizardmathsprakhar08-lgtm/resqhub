# 🚨 ResQHub — Emergency Safety & Rapid SOS Platform

ResQHub is a complete, production-grade Android personal safety and emergency dispatch application built with **React Native (Expo SDK 57)**, **TypeScript (Strict)**, and a **Python (FastAPI)** backend.

It is inspired by and references the functional requirements of native Android SOS Emergency Apps, completely re-engineered from the ground up with an original design system, server-mediated SMS delivery via Twilio, accelerometer shake detection, offline fallbacks, and SQLite persistence.

---

## 📸 Key Architecture & UI/UX Design

- **Trustworthy & Modern Visual Identity**: Midnight Navy (`#0A192F`), Deep Teal (`#0D9488`), and Coral / Warm Red (`#EF4444`) reserved exclusively for emergency actions.
- **Rapid Deliberate SOS Activation**: **0.5-second (500 ms)** press-and-hold interaction with haptic ticks and animated visual progress prevents accidental emergency triggers while maintaining rapid response.
- **3-Second Graceful Abort Countdown**: Audible and haptic countdown allows instant cancellation before dispatching alerts to emergency contacts.
- **Foreground GPS & Reverse-Geocoded Location Engine**:
  - Educational permission rationale dialogs with recovery link to device settings (`Linking.openSettings()`).
  - GPS status checking (`hasServicesEnabledAsync()`).
  - Rapid satellite fix strategy using `Accuracy.Balanced` with an 8-second bounded timeout.
  - Transparent last-known position fallback explicitly labeled as cached with timestamp and accuracy.
  - **Reverse Geocoding**: Automatically converts raw latitude and longitude into human-readable details (Locality / Area, City / District, State, PIN code, Country) with strict 2.5s bounded execution so it never blocks or delays SOS dispatch.
  - Home dashboard Real-Time Location Card with live address, coordinates, accuracy in metres, and a refresh button.
  - Active alert status screen with live readable address and a manual **Retry GPS Fix** button.
- **Full Location-Bearing Emergency Messages**:
  - Formatted message containing user custom text, precise latitude & longitude, human-readable address, Google Maps URL (`https://maps.google.com/?q=lat,lng`), local timestamp, timezone, and horizontal accuracy.
  - Transparently marked if coordinates are cached.
  - Explicit notification if GPS coordinates were unavailable (no fake map links).
- **Hybrid Multi-Channel Dispatch & Twilio Server Integration**:
  - *Server-Mediated SMS via Twilio*: Dispatches alert payload to FastAPI backend which formats phone numbers to standard E.164 (+91 for India) and sends via Twilio.
  - *Twilio Configuration Safeguard*: Automatically distinguishes Mock Mode (`MOCK_SMS_PROVIDER=true`) from Live Mode (`MOCK_SMS_PROVIDER=false`). If live mode is selected with missing or dummy credentials, reports an explicit "Twilio not configured" error per recipient rather than crashing or pretending to send.
  - *Emergency Offline Fallback*: Native on-device SMS composition (`sms:`) prefilled with location coordinates and one-tap emergency calling (`tel:112`, `108`, `100`) if network or server is unavailable.
- **Class-Based Contacts Integration**:
  - Fully migrated to Expo SDK 57's modern class-based `expo-contacts` API (`Contact.presentPicker()`, `getFullName()`, `getPhones()`, `getPermissionsAsync()`, `requestPermissionsAsync()`).
  - Eliminates legacy deprecated runtime errors (`Use the new class-based API from expo-contacts`).
  - Contacts are stored safely in local SQLite and SOS dispatch loads directly from local database without requiring device phonebook access during an emergency.
- **Safe Emergency Calling**:
  - Configurable primary emergency line (default: `112`).
  - Compliant with Android security policies using the system dialer (`ACTION_DIAL` via `Linking.openURL('tel:...')`) to ensure emergency lines are dialed reliably with user confirmation on keypad.
- **Backend Server Settings UX (Phase 8)**:
  - Developer & Server Settings section with live connection status badge (`Operational`, `Testing...`, `Unreachable`).
  - Built-in "Test Connection" tool measuring real-time latency to `/health`.
  - Comprehensive URL normalization and validation preventing double-slashes or missing `/api/v1` prefixes.
  - Quick presets for Android Emulator (`http://10.0.2.2:8000/api/v1`) and Localhost.
- **SQLite Persistence**: Contacts, local audit ledger, and app preferences stored in WAL-mode SQLite via `expo-sqlite`.
- **Sensitive Security**: `expo-secure-store` used for device identity and API authentication; zero API keys or Twilio secrets bundled into the mobile client.

---

## 🛠️ Project Structure

```
resqhub/
├── mobile/                        # React Native / Expo Mobile Application (SDK 57)
│   ├── app/                       # Expo Router navigation (Tabs & Stacks)
│   │   ├── (tabs)/                # Bottom Tab Bar: Emergency, Contacts, Helplines, Settings
│   │   │   ├── index.tsx          # Home dashboard with Location Card & 0.5s SOS Button
│   │   │   ├── contacts.tsx       # Emergency contacts management
│   │   │   ├── helplines.tsx      # Verified national emergency numbers
│   │   │   └── settings.tsx       # Settings, Developer Server Config, Test Connection
│   │   ├── alert/active.tsx       # Active SOS tracking, GPS maps link, delivery ledger, retry
│   │   ├── contacts/add.tsx       # Device phonebook picker & manual contact entry
│   │   ├── guides/index.tsx       # First aid safety instructions (offline accessible)
│   │   ├── instructions/index.tsx # User manual & safety guide
│   │   └── settings/              # Emergency message, history, permissions
│   ├── src/
│   │   ├── components/            # CurrentLocationCard, SosButton, CountdownModal, Card, Button
│   │   ├── constants/timing.ts    # Single source of truth for 500ms hold & 3s countdown
│   │   ├── features/              # Alerts, Contacts, Location, Settings
│   │   │   ├── alerts/            # useSosMonitor, alertService (dispatch, poll, retry)
│   │   │   ├── location/          # locationService, messageFormatter (Phase 7 payload)
│   │   │   └── settings/          # settingsService, urlUtils (normalize, validate)
│   │   ├── database/db.ts         # expo-sqlite CRUD with 5-contact max limit
│   │   ├── theme/                 # Colors, Spacing, Typography
│   │   └── types/                 # TypeScript interfaces
│   ├── app.json                   # Permissions and Expo plugins configuration
│   └── package.json
│
├── backend/                       # Python 3 FastAPI Backend
│   ├── app/
│   │   ├── api/v1/endpoints/      # /health, /alerts, /webhook/twilio
│   │   ├── core/                  # Configuration, API key auth, Twilio signature validator
│   │   ├── db/session.py          # SQLAlchemy 2.0 session & Base
│   │   ├── models/alert.py        # Alert & AlertRecipient models
│   │   ├── schemas/alert.py       # Pydantic v2 schemas
│   │   ├── services/sms.py        # Twilio client & mock dispatch service (Phase 7 formatted)
│   │   └── main.py                # Application entrypoint & CORS middleware
│   ├── tests/                     # Pytest test suite (12/12 passing tests)
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
│
├── docs/
│   ├── REFERENCE_FEATURE_AUDIT.md # Detailed audit of reference app vs ResQHub
│   ├── ARCHITECTURE.md            # System design & data flow specifications
│   ├── API.md                     # REST API contract and webhook specifications
│   └── DEVICE_TESTING.md          # Physical device and Android emulator testing guide
│
├── README.md
└── .gitignore
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v22.20.0)
- **Python**: 3.10+ (tested on Python 3.14.2)
- **Git**

---

### 2. Backend Setup & Startup

1. Navigate to the backend directory:
   ```bash
   cd resqhub/backend
   ```

2. Activate virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Linux / macOS**:
     ```bash
     source venv/bin/activate
     ```

3. Run Backend Tests:
   ```bash
   pytest -v
   ```
   *Result: 20/20 tests passed!*

4. Start the FastAPI server (listening on all interfaces):
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   - **Interactive API Docs (Swagger)**: [http://localhost:8000/api/v1/docs](http://localhost:8000/api/v1/docs)
   - **Health Check**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### 3. Mobile Client Setup & Startup

1. Navigate to the mobile directory:
   ```bash
   cd resqhub/mobile
   ```

2. Run TypeScript and Unit Tests:
   ```bash
   npx tsc --noEmit
   npm test
   ```
   *Results: 0 TypeScript errors, 38/38 tests passed across 4 test suites!*

3. Verify Expo Doctor:
   ```bash
   npx expo-doctor
   ```
   *Result: 21/21 checks passed!*

4. Launch with Expo Go or Development Build:
   - **Expo Go (Immediate on-device UI testing)**:
     ```bash
     npx expo start --go
     ```
   - **Development Build (Hardware sensor testing)**:
     ```bash
     npx expo start --dev-client
     ```

---

## 📱 Physical Device Networking Guide

> [!IMPORTANT]
> When testing on a **physical Android phone** over Wi-Fi, the default emulator address `10.0.2.2` will **NOT** work because `10.0.2.2` is a special loopback interface reserved exclusively for Android Virtual Devices (AVDs).

### How to Connect a Physical Device:
1. Ensure your PC and Android phone are connected to the **same Wi-Fi network**.
2. Find your PC's local IP address:
   - **Windows**: Run `ipconfig` in PowerShell and find `IPv4 Address` (e.g. `192.168.1.105`).
   - **macOS / Linux**: Run `ifconfig` or `ip a` (e.g. `192.168.1.105`).
3. Ensure FastAPI is running with `--host 0.0.0.0`:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
4. Open **ResQHub Settings** on your phone:
   - Expand **Developer & Server Settings**.
   - Set **FastAPI Server URL** to `http://<your-pc-ip>:8000/api/v1` (e.g., `http://192.168.1.105:8000/api/v1`).
   - Tap **Save** and then tap **Test Connection**.
   - Verify the status badge turns green: `Operational (xx ms)`.

---

## 🧪 Automated Test Results Summary

| Test Suite | Framework | Tests | Result |
| :--- | :--- | :--- | :--- |
| **Backend API & SMS** | Pytest 9.1 | 20 | **20 Passed** (100%) |
| **Contacts Class API & Normalization** | Jest / ts-jest | 14 | **14 Passed** (100%) |
| **Shake Sensor Logic** | Jest / ts-jest | 4 | **4 Passed** (100%) |
| **Timing, URL & Reverse Geocoding** | Jest / ts-jest | 13 | **13 Passed** (100%) |
| **SOS Dispatch & Reliability** | Jest / ts-jest | 7 | **7 Passed** (100%) |
| **TypeScript Strictness** | `tsc --noEmit` | N/A | **0 Errors** |
| **Expo Environment Health** | `expo-doctor` | 21 checks | **21/21 Passed** |

---

## 📄 License & Attribution

This project is licensed under the **MIT License**.
Based on functional specifications from `SOS-Emergency-App` (Copyright (c) 2024-2026 Samir Suroshe).
ResQHub is an original rewrite with original branding, TypeScript architecture, and server-side infrastructure.
