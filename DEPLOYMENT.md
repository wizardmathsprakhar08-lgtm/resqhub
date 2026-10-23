# 🚀 ResQHub Deployment Guide: Website & Mobile Application

This guide provides end-to-end instructions for deploying the **ResQHub Emergency Safety & Rapid SOS Platform** as both a **live Web Application & Command Center** and a **Native Android Mobile Application (APK)**.

---

## 🏗️ Architecture Overview

ResQHub is structured as a dual-tier emergency response system:

```
                  ┌──────────────────────────────────────────────┐
                  │          ResQHub Cloud Web Server            │
                  │       (FastAPI + SQLite + Web Portal)        │
                  │   - Live Incident Map (OpenStreetMap/Leaflet)│
                  │   - Emergency Dispatch Ledger                │
                  │   - Twilio SMS Multi-Channel Gateway         │
                  └──────────────▲────────────────▲──────────────┘
                                 │                │
            HTTPS / REST API     │                │  Web Browser (Any Device)
            (Alert Dispatch)     │                │  (Evaluation & Operations)
                                 │                │
                  ┌──────────────┴──────────┐   ┌─┴────────────────────────┐
                  │    ResQHub Mobile App   │   │  Web Command Center UI   │
                  │  (Android Standalone/   │   │  (http://localhost:8000/ │
                  │     Expo SDK 57)        │   │         dashboard)       │
                  │  - 0.5s Hold SOS Trigger│   │  - Live Map Pins         │
                  │  - GPS & Reverse Geocode│   │  - SOS Simulator         │
                  │  - Direct SIM & Twilio  │   │  - Incident Resolution   │
                  └─────────────────────────┘   └──────────────────────────┘
```

---

## 🌐 Part 1: Deploy as a Website

ResQHub includes a built-in **Emergency Operations & Command Center Web Dashboard** directly served by the backend at `/dashboard` (and `/` for web browsers).

### Option A: Local & LAN Demonstration (Immediate)

1. Double-click **`backend/run_server.bat`** (or execute in terminal):
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
2. Your browser will open **`http://localhost:8000/dashboard`**.
3. **What you will see on the Website**:
   - 🗺️ **Interactive Incident Map**: Live Leaflet map with victim GPS markers.
   - 📋 **Live Dispatch Ledger**: Real-time incoming SOS feeds with status badges (`SENT`, `MOCK`, `RESOLVED`).
   - 🧪 **Interactive SOS Simulator**: Test dispatching emergency alerts directly from your browser with real GPS coordinates without needing a phone.
   - 🩺 **System Diagnostics**: Real-time latency, Twilio gateway status, and SQLite database health.
   - 📑 **Swagger API Docs**: One-click access to `http://localhost:8000/api/v1/docs`.

---

### Option B: Free 24/7 Cloud Web Hosting on Render.com (Recommended)

Render offers free cloud hosting for FastAPI web applications with persistent HTTPS (`https://resqhub-xxx.onrender.com`).

#### Steps to Deploy:
1. Push your repository to **GitHub** (or create a new GitHub repo):
   ```bash
   git init
   git add .
   git commit -m "feat: complete ResQHub with web portal and mobile app"
   git remote add origin https://github.com/<your-username>/resqhub.git
   git push -u origin main
   ```
2. Go to [https://render.com](https://render.com) and sign in.
3. Click **New +** &rarr; **Web Service**.
4. Select your `resqhub` GitHub repository.
5. Configure the service settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
6. Under **Environment Variables**, add:
   - `MOCK_SMS_PROVIDER` = `true` (or `false` with your Twilio credentials)
   - `PROJECT_NAME` = `ResQHub Emergency Platform`
   - `ALLOWED_ORIGINS` = `*`
7. Click **Deploy Web Service**.
8. In ~2 minutes, your website is live worldwide at `https://<your-app>.onrender.com/dashboard`!

*(Note: `backend/render.yaml` and `backend/Dockerfile` are pre-configured in the repository for automated deployment).*

---

### Option C: Container Deployment with Docker

Run the entire web command portal in a single command using Docker:
```bash
cd backend
docker compose up -d
```
Access at `http://localhost:8000/dashboard`.

---

## 📱 Part 2: Deploy as a Mobile Application

The ResQHub mobile app is built with React Native and Expo SDK 57 for Android.

### Option A: Standalone Android APK Build (via EAS Build)

To generate an installable `.apk` file that can be distributed to examiners, friends, or installed on any physical Android smartphone:

1. Open PowerShell in `mobile`:
   ```powershell
   cd mobile
   ```

2. Log in or create a free Expo account (takes 30 seconds):
   ```powershell
   npx eas-cli login
   ```

3. Configure your project with your Expo username:
   ```powershell
   npx eas-cli project:init
   ```

4. Trigger the cloud APK build:
   ```powershell
   npm run build:apk
   ```
   *(This executes `eas build --platform android --profile preview` using the pre-configured `eas.json`)*.

5. EAS will build the `.apk` on cloud servers. When finished, it prints a **direct download link** and a **QR code**. Scan the QR code or download the `.apk` directly to install on your phone!

---

### Option B: Instant On-Device Testing with Expo Go (No Build Required)

To run the mobile app immediately on your Android phone without waiting for an APK build:

1. Install **Expo Go** from Google Play Store on your Android phone.
2. Ensure your phone and PC are connected to the **same Wi-Fi network**.
3. Double-click **`mobile/run_mobile.bat`** (or run `npx expo start` in `mobile`).
4. Scan the displayed QR code with the Expo Go app.
5. The application will bundle and launch instantly on your device!

---

## 🔗 Connecting the Mobile App to the Web Server

1. **If Running Locally on Wi-Fi**:
   - Run `ipconfig` on your PC to find your IPv4 address (e.g., `192.168.1.105`).
   - Open ResQHub on your mobile phone &rarr; **Settings** &rarr; **Developer & Server Settings**.
   - Set **FastAPI Server URL** to `http://192.168.1.105:8000/api/v1`.
   - Tap **Save** &rarr; **Test Connection** (turns green: `Operational`).

2. **If Deployed to Cloud (Render / Railway)**:
   - In mobile app Settings, set the server URL to your live HTTPS domain:
     `https://<your-app>.onrender.com/api/v1`
   - Now the mobile app works from anywhere in the world over cellular 4G/5G!

---

## 🎬 Recommended Major Project Demonstration Flow

When demonstrating this project to evaluators:

1. **Show the Web Command Center**:
   - Open `http://localhost:8000/dashboard` on the presentation screen.
   - Highlight the real-time Incident Map, E.164 normalization, and Twilio status badge.

2. **Trigger an Emergency SOS from the Mobile App**:
   - Long-press the SOS button for **0.5 seconds** (demonstrates intentional press safeguard).
   - Show the **3-second abort countdown** (demonstrates accidental trigger prevention).
   - Let the timer expire: watch the app acquire high-precision GPS coordinates and human-readable reverse-geocoded address.
   - Show the dual dispatch (Twilio server-mediated SMS + local cellular fallback).

3. **Live Sync to Web Command Center**:
   - Within 5 seconds, watch the emergency alert appear live on the Web Incident Map with a red ping.
   - Click the map pin to reveal victim coordinates, address, and Google Maps link.
   - Click **"Resolve Incident"** on the dashboard to demonstrate full incident lifecycle management.

4. **Show Code Quality & Automated Tests**:
   - Backend: `25/25 Pytest unit tests passed` (`pytest -v`)
   - Mobile: `60/60 Jest unit tests passed` (`npm test`)
   - TypeScript: `0 strict compile errors` (`npx tsc --noEmit`)
