import uuid
from app.models.alert import Alert, AlertRecipient


def test_create_alert_unauthorized(client):
    payload = {
        "idempotency_key": str(uuid.uuid4()),
        "message": "Help needed!",
        "recipients": [{"contact_name": "Emergency Contact", "phone_number": "+919876543210"}],
    }
    response = client.post("/api/v1/alerts", json=payload, headers={"X-API-Key": "wrong-key"})
    assert response.status_code == 401


def test_create_alert_success(client, auth_headers):
    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "I am in DANGER, i need help. Please urgently reach me out.",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "map_url": "https://maps.google.com/maps?q=19.0760,72.8777",
        "sender_device_id": "test_device_01",
        "recipients": [
            {"contact_name": "Mom", "phone_number": "+919876543210"},
            {"contact_name": "Dad", "phone_number": "+919876543211"},
        ],
    }
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["idempotency_key"] == key
    # Truthful status: In mock SMS mode, alert is marked 'mock'
    assert data["status"] in ("mock", "sent")
    assert len(data["recipients"]) == 2
    assert data["recipients"][0]["contact_name"] == "Mom"
    assert data["recipients"][0]["delivery_status"] in ("mock", "sent")
    assert data["recipients"][0]["provider_message_sid"].startswith("SM_mock_")


def test_create_alert_idempotency(client, auth_headers):
    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "Emergency alert",
        "recipients": [{"contact_name": "Contact 1", "phone_number": "+919876543210"}],
    }
    resp1 = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert resp1.status_code == 201
    alert_id = resp1.json()["id"]

    # Re-send same payload
    resp2 = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert resp2.status_code == 200 or resp2.status_code == 201
    assert resp2.json()["id"] == alert_id


def test_create_alert_validation(client, auth_headers):
    # Empty recipients
    payload = {
        "idempotency_key": str(uuid.uuid4()),
        "message": "Emergency alert",
        "recipients": [],
    }
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 422

    # More than 5 recipients
    payload["recipients"] = [
        {"contact_name": f"Contact {i}", "phone_number": f"+91987654321{i}"} for i in range(6)
    ]
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 422

    # Invalid phone number
    payload["recipients"] = [{"contact_name": "Contact", "phone_number": "123"}]
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_get_alert_by_id(client, auth_headers):
    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "Emergency test",
        "recipients": [{"contact_name": "Contact", "phone_number": "+919876543210"}],
    }
    create_resp = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    alert_id = create_resp.json()["id"]

    get_resp = client.get(f"/api/v1/alerts/{alert_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == alert_id

    # Non-existent
    not_found = client.get(f"/api/v1/alerts/{uuid.uuid4()}", headers=auth_headers)
    assert not_found.status_code == 404


def test_list_alerts(client, auth_headers):
    # Query list
    response = client.get("/api/v1/alerts?limit=10", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_resolve_alert(client, auth_headers):
    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "Emergency test to resolve",
        "recipients": [{"contact_name": "Contact", "phone_number": "+919876543210"}],
    }
    create_resp = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    alert_id = create_resp.json()["id"]

    resolve_resp = client.post(
        f"/api/v1/alerts/{alert_id}/resolve",
        json={"reason": "Safe now, resolved by user"},
        headers=auth_headers,
    )
    assert resolve_resp.status_code == 200
    data = resolve_resp.json()
    assert data["status"] == "resolved"
    assert data["resolved_at"] is not None


def test_twilio_webhook(client, auth_headers):
    # 1. Create alert
    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "Webhook test alert",
        "recipients": [{"contact_name": "Webhook Recipient", "phone_number": "+919876543210"}],
    }
    create_resp = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    sid = create_resp.json()["recipients"][0]["provider_message_sid"]

    # 2. Simulate Twilio status callback webhook
    webhook_data = {
        "MessageSid": sid,
        "MessageStatus": "delivered",
    }
    webhook_resp = client.post("/api/v1/alerts/webhook/twilio", data=webhook_data)
    assert webhook_resp.status_code == 200
    assert "<Response>" in webhook_resp.text

    # 3. Verify recipient status updated
    alert_id = create_resp.json()["id"]
    get_resp = client.get(f"/api/v1/alerts/{alert_id}", headers=auth_headers)
    recipients = get_resp.json()["recipients"]
    assert recipients[0]["delivery_status"] == "delivered"


def test_create_alert_without_coordinates(client, auth_headers):
    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "RESQHUB SOS ALERT\n\nI need emergency assistance.\n\nLocation: Unavailable (GPS fix could not be acquired)",
        "latitude": None,
        "longitude": None,
        "map_url": None,
        "recipients": [{"contact_name": "Emergency Contact", "phone_number": "+919876543210"}],
    }
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["latitude"] is None
    assert data["longitude"] is None
    assert data["map_url"] is None
    assert data["status"] in ("mock", "sent", "sending")


def test_create_alert_partial_failure(client, auth_headers, monkeypatch):
    from app.services.sms import sms_service

    def mock_send(to_phone, recipient_name, message_body, map_url=None):
        if to_phone.endswith("11"):
            return {"success": False, "message_sid": None, "status": "failed", "error": "Provider carrier timeout"}
        return {"success": True, "message_sid": "SM_live_mock_123", "status": "sent", "mock_mode": False}

    monkeypatch.setattr(sms_service, "send_emergency_sms", mock_send)

    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "Partial failure test",
        "recipients": [
            {"contact_name": "Contact 1", "phone_number": "+919876543210"},
            {"contact_name": "Contact 2", "phone_number": "+919876543211"},
        ],
    }
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "partial_failure"
    assert data["recipients"][0]["delivery_status"] == "sent"
    assert data["recipients"][1]["delivery_status"] == "failed"
    assert data["recipients"][1]["error_message"] == "Provider carrier timeout"


def test_sms_diagnostics_endpoint(client, auth_headers):
    response = client.get("/api/v1/alerts/diagnostics/sms", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "mock_mode" in data
    assert "twilio_installed" in data
    assert "account_sid_configured" in data
    assert "configuration_status" in data
    assert "guidance" in data
    assert "auth_token" not in data  # Never expose secrets
    assert "TWILIO_AUTH_TOKEN" not in data


def test_create_alert_live_twilio_status_preservation(client, auth_headers, monkeypatch):
    from app.services.sms import sms_service

    # Simulate real Twilio returning 'queued'
    def mock_twilio_queued(to_phone, recipient_name, message_body, map_url=None):
        return {
            "success": True,
            "message_sid": "SM_twilio_real_queued_123",
            "status": "queued",
            "mock_mode": False,
        }

    monkeypatch.setattr(sms_service, "send_emergency_sms", mock_twilio_queued)

    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "Live Twilio test",
        "recipients": [{"contact_name": "Twilio Recipient", "phone_number": "+919876543210"}],
    }
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "sent"
    assert data["recipients"][0]["delivery_status"] == "queued"
    assert data["recipients"][0]["provider_message_sid"] == "SM_twilio_real_queued_123"


def test_create_alert_direct_sim_channel(client, auth_headers):
    key = str(uuid.uuid4())
    payload = {
        "idempotency_key": key,
        "message": "Direct SIM SMS test",
        "latitude": 19.076,
        "longitude": 72.877,
        "sender_device_id": "phone_sim_device",
        "channel": "sim",
        "recipients": [
            {
                "contact_name": "Emergency SIM Contact",
                "phone_number": "+919876543210",
                "delivery_status": "sent",
            }
        ],
    }
    response = client.post("/api/v1/alerts", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "sent"
    assert len(data["recipients"]) == 1
    assert data["recipients"][0]["delivery_status"] == "sent"
    assert data["recipients"][0]["provider_message_sid"].startswith("SIM_")
