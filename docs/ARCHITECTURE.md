# ResQHub System Architecture

## 1. High-Level Overview

ResQHub is a modern emergency safety and dispatch ecosystem comprising:
1. **A React Native / Expo Client (Android & iOS capable)** with strict TypeScript, Expo Router, offline SQLite persistence, accelerometer shake detection, GPS geolocation, and an SOS state machine.
2. **A Python FastAPI Backend** with Pydantic v2 schemas, SQLAlchemy 2.x persistence, Twilio SMS integration, delivery status webhooks, and rate-limiting.
3. **Hybrid Dispatch Pipeline**:
   - **Primary Dispatch Path**: Server-mediated dispatch through the FastAPI backend and Twilio. This path delivers carrier-independent SMS to emergency contacts, tracks provider delivery statuses via webhooks, and maintains an auditable alert ledger.
   - **Emergency Fallback Path**: If device connectivity is lost or the backend server is unreachable, the client transitions to direct on-device emergency triggers: direct phone dialer invocation (`tel:`) and native SMS composition (`sms:`).

```
                      +----------------------------------+
                      |       ResQHub Mobile Client      |
                      |   (React Native / Expo SDK 52)   |
                      +-----------------+----------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
     [Primary: Online Path]                       [Fallback: Offline Path]
                 |                                             |
                 v                                             v
    +-------------------------+                  +---------------------------+
    |   ResQHub FastAPI API   |                  | Native Android Telephony  |
    |  POST /api/v1/alerts    |                  |  - Dial Emergency Helplines|
    +------------+------------+                  |  - Native SMS Composer    |
                 |                               +---------------------------+
                 v
    +-------------------------+
    |    Twilio SMS Gateway   |
    +------------+------------+
                 |
        +--------+--------+
        |                 |
        v                 v
  Emergency SMS     Webhook Status
   to Contacts    (/alerts/webhook/twilio)
```

---

## 2. Mobile Architecture

### Directory Structure
```
resqhub/mobile/
  app/
    _layout.tsx            # Global layout, SQLite provider, Theme provider
    (tabs)/
      _layout.tsx          # Tab bar navigation with custom styling
      index.tsx            # Dashboard with SOS primary action & quick shortcuts
      contacts.tsx         # Emergency contacts list with dialer & delete
      helplines.tsx        # Emergency services directory (Ambulance, Police, etc.)
      settings.tsx         # App settings, shake configuration, message edit
    contacts/
      add.tsx              # Manual contact form & phonebook contact picker
    alert/
      active.tsx           # Active alert status, countdown, map link, resolve
    guides/
      index.tsx            # First Aid guides (Burns, Fractures, Bleeding)
    instructions/
      index.tsx            # App user manual and onboarding steps
  src/
    components/            # Design system buttons, cards, countdown, badges
    features/
      alerts/              # SOS state machine, alert service, shake listener
      contacts/            # Contact validation, SQLite repositories
      location/            # Geolocation provider, coordinate formatting
      helplines/           # Helplines catalog & direct dialer
      settings/            # App preferences & secure storage
    database/
      db.ts                # expo-sqlite initialization, migrations, queries
    theme/
      colors.ts            # Midnight Navy, Deep Teal, Coral palette
      typography.ts        # Typography scale
      spacing.ts           # Spacing constants
    types/
      index.ts             # Shared TypeScript interfaces
```

### SOS State Machine
The client SOS feature strictly avoids instantaneous, irreversible triggers without grace period. The state machine progresses through:

```
[IDLE]
  |
  |--- (Press & Hold SOS / Shake Detected)
  v
[CONFIRMING] (5-second cancelable countdown with haptics & audio cues)
  |
  |--- (User presses Cancel) ---> [IDLE]
  |
  |--- (Countdown reaches 0)
  v
[LOCATING] (Contextual GPS high-accuracy retrieval, 10s timeout)
  |
  |--- (Location retrieved or timeout expired)
  v
[SENDING] (Dispatches to Backend /api/v1/alerts with idempotency key)
  |
  +---> [SENT] (Backend accepted, SMS queued / sent to contacts)
  |
  +---> [PARTIAL_FAILURE] (Some contact messages succeeded, some failed)
  |
  +---> [FAILED] (Network or server unreachable -> prompt Native Fallback)
```

---

## 3. Backend Architecture

### Directory Structure
```
resqhub/backend/
  app/
    main.py                # FastAPI factory, middleware, CORS, routing
    api/
      v1/
        api.py             # Router aggregation
        endpoints/
          health.py        # Health & readiness probe
          alerts.py        # Alert creation, retrieval, history, resolve
          webhook.py       # Twilio delivery status webhook handler
    core/
      config.py            # Pydantic Settings loading from .env
      security.py          # API key verification & Twilio signature validator
    db/
      session.py           # SQLAlchemy 2.0 engine, SessionLocal, Base
    models/
      alert.py             # Alert, AlertRecipient, AuditLog ORM models
    schemas/
      alert.py             # AlertCreate, AlertResponse, RecipientStatus schemas
    services/
      sms.py               # Twilio client wrapper & mock fallback provider
  tests/
    conftest.py            # Test database fixture, mock Twilio fixtures
    test_health.py         # Health endpoint tests
    test_alerts.py         # SOS creation, validation, idempotency, webhook tests
  alembic/                 # Migration environment
  requirements.txt
  .env.example
```

### Data Schema
- **alerts**:
  - `id` (UUID string, primary key)
  - `idempotency_key` (Unique string to prevent duplicate sends)
  - `status` (`pending`, `sending`, `sent`, `partially_delivered`, `failed`, `resolved`, `cancelled`)
  - `message` (Text of emergency message)
  - `latitude` (Float, optional)
  - `longitude` (Float, optional)
  - `map_url` (String, Google Maps link)
  - `sender_device_id` (String)
  - `created_at` (DateTime UTC)
  - `updated_at` (DateTime UTC)
  - `resolved_at` (DateTime UTC, nullable)
- **alert_recipients**:
  - `id` (UUID string, primary key)
  - `alert_id` (Foreign key to alerts.id)
  - `contact_name` (String)
  - `phone_number` (String, E.164 normalized)
  - `provider_message_sid` (String, Twilio SID)
  - `delivery_status` (`queued`, `sent`, `delivered`, `undelivered`, `failed`)
  - `error_message` (String, nullable)
  - `updated_at` (DateTime UTC)

---

## 4. Security & Privacy Architecture
1. **Zero Secret Mobile Client**: No Twilio credentials, API master keys, or cloud secrets are ever packaged into the React Native binary. All sensitive operations go through the backend.
2. **Contact Privacy**: Device contacts are accessed strictly upon user selection via `expo-contacts`. The app never uploads or syncs the full device address book.
3. **Location on Demand**: Foreground location is acquired strictly upon emergency trigger with a 10s timeout, avoiding continuous user background tracking without necessity.
4. **Webhook Signature Verification**: Twilio delivery callbacks are cryptographically verified using Twilio's X-Twilio-Signature HMAC-SHA1 to prevent forgery.
