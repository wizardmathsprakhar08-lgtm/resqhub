import pytest
from app.services.sms import normalize_to_e164, is_placeholder_or_empty, SMSService
from app.core.config import settings


def test_normalize_to_e164_indian_10_digit():
    assert normalize_to_e164("9876543210") == "+919876543210"
    assert normalize_to_e164("  (987) 654-3210  ") == "+919876543210"
    assert normalize_to_e164("98765-43210") == "+919876543210"


def test_normalize_to_e164_indian_leading_zero():
    assert normalize_to_e164("09876543210") == "+919876543210"


def test_normalize_to_e164_indian_with_country_code():
    assert normalize_to_e164("+919876543210") == "+919876543210"
    assert normalize_to_e164("919876543210") == "+919876543210"
    assert normalize_to_e164("+91 98765 43210") == "+919876543210"


def test_normalize_to_e164_international():
    assert normalize_to_e164("+1-500-555-0006") == "+15005550006"
    assert normalize_to_e164("+44 20 7946 0958") == "+442079460958"


def test_normalize_to_e164_empty():
    assert normalize_to_e164("") == ""
    assert normalize_to_e164("   ") == ""


def test_is_placeholder_or_empty():
    assert is_placeholder_or_empty("") is True
    assert is_placeholder_or_empty(None) is True
    assert is_placeholder_or_empty("AC_dummy_account_sid_placeholder_12345") is True
    assert is_placeholder_or_empty("dummy_auth_token_placeholder_67890") is True
    assert is_placeholder_or_empty("your_auth_token") is True
    assert is_placeholder_or_empty("VALID_REAL_SID_STRING") is False


def test_sms_service_mock_mode():
    svc = SMSService()
    settings.MOCK_SMS_PROVIDER = True

    result = svc.send_emergency_sms(
        to_phone="9876543210",
        recipient_name="Mom",
        message_body="Test emergency",
        map_url="https://maps.google.com/?q=12.9716,77.5946",
    )

    assert result["success"] is True
    assert result["message_sid"].startswith("SM_mock_")
    assert result["status"] == "mock"
    assert result["error"] is None
    assert result.get("mock_mode") is True


def test_sms_service_live_mode_with_unconfigured_credentials():
    svc = SMSService()
    # Temporarily set live mode
    prev_mock = settings.MOCK_SMS_PROVIDER
    prev_sid = settings.TWILIO_ACCOUNT_SID
    try:
        settings.MOCK_SMS_PROVIDER = False
        settings.TWILIO_ACCOUNT_SID = "AC_dummy_placeholder"

        result = svc.send_emergency_sms(
            to_phone="9876543210",
            recipient_name="Emergency Contact",
            message_body="Help needed",
        )

        assert result["success"] is False
        assert result["message_sid"] is None
        assert result["status"] == "failed"
        assert "Twilio not configured" in result["error"]
    finally:
        settings.MOCK_SMS_PROVIDER = prev_mock
        settings.TWILIO_ACCOUNT_SID = prev_sid


def test_twilio_error_572006_template_lock_translation(monkeypatch):
    from twilio.base.exceptions import TwilioRestException
    from app.services.sms import SMSService

    svc = SMSService()
    settings.MOCK_SMS_PROVIDER = False

    class DummyClient:
        class DummyMessages:
            def create(self, **kwargs):
                raise TwilioRestException(
                    status=400,
                    uri="/2010-04-01/Accounts/ACxxx/Messages.json",
                    msg="Invalid template name. Trial accounts can only use predefined SMS templates.",
                    code=572006,
                )
        messages = DummyMessages()

    svc.client = DummyClient()
    monkeypatch.setattr(svc, "validate_twilio_configuration", lambda: None)

    res = svc.send_emergency_sms(
        to_phone="+916388202866",
        recipient_name="Self",
        message_body="Test alert",
    )

    assert res["success"] is False
    assert res["status"] == "failed"
    assert res["error_code"] == 572006
    assert "Trial Template Lock" in res["error"]
    assert "cannot send custom SMS text to Indian numbers" in res["error"]


def test_twilio_error_572002_unverified_recipient_translation(monkeypatch):
    from twilio.base.exceptions import TwilioRestException
    from app.services.sms import SMSService

    svc = SMSService()
    settings.MOCK_SMS_PROVIDER = False

    class DummyClient:
        class DummyMessages:
            def create(self, **kwargs):
                raise TwilioRestException(
                    status=400,
                    uri="/2010-04-01/Accounts/ACxxx/Messages.json",
                    msg="No Twilio trial phone number is assigned for messaging to this destination number.",
                    code=572002,
                )
        messages = DummyMessages()

    svc.client = DummyClient()
    monkeypatch.setattr(svc, "validate_twilio_configuration", lambda: None)

    res = svc.send_emergency_sms(
        to_phone="+917045162636",
        recipient_name="Friend",
        message_body="Test alert",
    )

    assert res["success"] is False
    assert res["status"] == "failed"
    assert res["error_code"] == 572002
    assert "Unverified Recipient" in res["error"]
    assert "Verified Caller IDs" in res["error"]
