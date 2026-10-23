# ResQHub REST API Specification

**Base URL**: `/api/v1`  
**Protocol**: HTTPS (Production) / HTTP (Local Development)  
**Content-Type**: `application/json`

---

## 1. Authentication & Security Headers

All requests to protected endpoints require an API Key header:
```http
X-API-Key: <your-client-api-key>
```
*Note: The API key authenticates legitimate client app instances. Detailed rate limiting is applied per IP address / device identifier.*

---

## 2. Endpoints

### 2.1 Health Check

#### `GET /health`
Returns the status of the server and database connectivity.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "development",
  "database": "connected"
}
```

---

### 2.2 Create Emergency Alert

#### `POST /alerts`
Triggered by the mobile client when an SOS alert is confirmed.

**Headers**:
- `X-API-Key`: string (required)

**Request Body**:
```json
{
  "idempotency_key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "sender_device_id": "device_xyz_987",
  "message": "I am in DANGER, i need help. Please urgently reach me out.",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "map_url": "https://maps.google.com/maps?q=19.0760,72.8777",
  "recipients": [
    {
      "contact_name": "Mom",
      "phone_number": "+919876543210"
    },
    {
      "contact_name": "Emergency Backup",
      "phone_number": "+919876543211"
    }
  ]
}
```

**Field Validation Rules**:
- `idempotency_key`: Non-empty string (UUID recommended). Re-submitting the same key returns the existing alert record without re-sending duplicate SMS.
- `recipients`: Between 1 and 5 recipients.
- `phone_number`: Must conform to E.164 phone number standard (`+` followed by digits).

**Response `201 Created`** (or `200 OK` if idempotent replay):
```json
{
  "id": "e4f8b2c1-8461-46ab-a982-127e826b1a99",
  "idempotency_key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "sending",
  "message": "I am in DANGER, i need help. Please urgently reach me out.",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "map_url": "https://maps.google.com/maps?q=19.0760,72.8777",
  "sender_device_id": "device_xyz_987",
  "created_at": "2026-10-19T07:30:00Z",
  "updated_at": "2026-10-19T07:30:01Z",
  "resolved_at": null,
  "recipients": [
    {
      "id": "18f9e2b1-1234-4567-8901-abcdef123456",
      "contact_name": "Mom",
      "phone_number": "+919876543210",
      "provider_message_sid": "SM_twilio_sid_1",
      "delivery_status": "queued",
      "error_message": null
    },
    {
      "id": "28f9e2b1-1234-4567-8901-abcdef123457",
      "contact_name": "Emergency Backup",
      "phone_number": "+919876543211",
      "provider_message_sid": "SM_twilio_sid_2",
      "delivery_status": "queued",
      "error_message": null
    }
  ]
}
```

**Response `400 Bad Request`**:
```json
{
  "detail": "At least one recipient must be specified (maximum 5)."
}
```

**Response `401 Unauthorized`**:
```json
{
  "detail": "Invalid or missing API key."
}
```

---

### 2.3 Get Alert Details

#### `GET /alerts/{alert_id}`
Retrieves live status of an alert and all recipient delivery statuses.

**Response `200 OK`**:
```json
{
  "id": "e4f8b2c1-8461-46ab-a982-127e826b1a99",
  "idempotency_key": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "sent",
  "message": "I am in DANGER, i need help. Please urgently reach me out.",
  "latitude": 19.0760,
  "longitude": 72.8777,
  "map_url": "https://maps.google.com/maps?q=19.0760,72.8777",
  "sender_device_id": "device_xyz_987",
  "created_at": "2026-10-19T07:30:00Z",
  "updated_at": "2026-10-19T07:30:05Z",
  "resolved_at": null,
  "recipients": [
    {
      "id": "18f9e2b1-1234-4567-8901-abcdef123456",
      "contact_name": "Mom",
      "phone_number": "+919876543210",
      "provider_message_sid": "SM_twilio_sid_1",
      "delivery_status": "delivered",
      "error_message": null
    }
  ]
}
```

---

### 2.4 List Alert History

#### `GET /alerts?device_id={device_id}&limit=20&offset=0`
Retrieves past alert records for the authorized device.

**Response `200 OK`**:
```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "id": "e4f8b2c1-8461-46ab-a982-127e826b1a99",
      "status": "resolved",
      "created_at": "2026-10-19T07:30:00Z",
      "resolved_at": "2026-10-19T07:45:00Z",
      "recipients_count": 2
    }
  ]
}
```

---

### 2.5 Resolve / Cancel Alert

#### `POST /alerts/{alert_id}/resolve`
Marks an active alert as resolved or safely cancelled by the user.

**Request Body**:
```json
{
  "reason": "False alarm / Safe now",
  "sender_device_id": "device_xyz_987"
}
```

**Response `200 OK`**:
```json
{
  "id": "e4f8b2c1-8461-46ab-a982-127e826b1a99",
  "status": "resolved",
  "resolved_at": "2026-10-19T07:45:00Z"
}
```

---

### 2.6 Twilio Delivery Webhook

#### `POST /alerts/webhook/twilio`
Receives Twilio status callbacks (`queued`, `sent`, `delivered`, `undelivered`, `failed`).

**Headers**:
- `X-Twilio-Signature`: HMAC-SHA1 signature (verified in production)

**Form-Encoded Body Parameters**:
- `MessageSid`: Twilio Message SID
- `MessageStatus`: Current delivery status
- `ErrorCode`: Error code if delivery failed (optional)
- `ErrorMessage`: Error text if delivery failed (optional)

**Response `200 OK`**:
```xml
<Response></Response>
```
