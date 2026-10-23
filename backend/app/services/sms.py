import logging
import uuid
import re
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("resqhub.sms")

# Conditionally import Twilio
try:
    from twilio.rest import Client as TwilioClient
    from twilio.base.exceptions import TwilioRestException
except ImportError:
    TwilioClient = None
    TwilioRestException = Exception


def normalize_to_e164(phone: str, default_country_code: str = "+91") -> str:
    """
    Normalizes a phone number to standard international E.164 format.
    Handles Indian numbers (10 digits -> +91XXXXXXXXXX, 0XXXXXXXXXX -> +91XXXXXXXXXX)
    and international numbers starting with '+'.
    """
    cleaned = re.sub(r"[\s\-\(\)\.]", "", phone.strip())
    if not cleaned:
        return ""
    if cleaned.startswith("+"):
        return cleaned
    if cleaned.startswith("0") and len(cleaned) == 11:
        return default_country_code + cleaned[1:]
    if len(cleaned) == 10:
        return default_country_code + cleaned
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return "+" + cleaned
    return "+" + cleaned


def is_placeholder_or_empty(val: Optional[str]) -> bool:
    """
    Checks if a configuration value is missing, empty, or contains dummy/placeholder text.
    """
    if not val or not val.strip():
        return True
    lower = val.strip().lower()
    return any(p in lower for p in ["dummy", "placeholder", "your_", "example", "changeme", "xxx"])


class SMSService:
    def __init__(self):
        self.mock_mode = settings.MOCK_SMS_PROVIDER
        self.client = None

        if not self.mock_mode:
            self._init_twilio_client()

    def _init_twilio_client(self):
        """Initializes Twilio client if credentials are valid."""
        if TwilioClient is None:
            logger.warning("Twilio library is not installed.")
            return

        if (
            is_placeholder_or_empty(settings.TWILIO_ACCOUNT_SID)
            or is_placeholder_or_empty(settings.TWILIO_AUTH_TOKEN)
            or not settings.TWILIO_ACCOUNT_SID.startswith("AC")
        ):
            logger.warning("Twilio credentials are unconfigured or placeholder.")
            return

        try:
            self.client = TwilioClient(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        except Exception as e:
            logger.error(f"Failed to initialize Twilio client: {e}")
            self.client = None

    def validate_twilio_configuration(self) -> Optional[str]:
        """
        Validates Twilio settings when MOCK_SMS_PROVIDER=False.
        Returns None if valid, or a descriptive error string if invalid.
        """
        if TwilioClient is None:
            return "Twilio library not installed in environment"
        if is_placeholder_or_empty(settings.TWILIO_ACCOUNT_SID):
            return "Twilio not configured: missing or placeholder TWILIO_ACCOUNT_SID"
        if not settings.TWILIO_ACCOUNT_SID.startswith("AC"):
            return "Twilio not configured: TWILIO_ACCOUNT_SID must start with 'AC'"
        if is_placeholder_or_empty(settings.TWILIO_AUTH_TOKEN):
            return "Twilio not configured: missing or placeholder TWILIO_AUTH_TOKEN"
        if is_placeholder_or_empty(settings.TWILIO_FROM_NUMBER):
            return "Twilio not configured: missing or placeholder TWILIO_FROM_NUMBER"
        return None

    def send_emergency_sms(
        self,
        to_phone: str,
        recipient_name: str,
        message_body: str,
        map_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sends an emergency SMS. In mock mode, simulates successful dispatch.
        In live mode (MOCK_SMS_PROVIDER=False), verifies credentials and dispatches via Twilio.
        """
        formatted_phone = normalize_to_e164(to_phone)
        sanitized_phone = (
            formatted_phone[:3] + "..." + formatted_phone[-4:]
            if len(formatted_phone) > 7
            else "***"
        )

        if "RESQHUB SOS ALERT" in message_body:
            formatted_message = f"🚨 RESQHUB ALERT for {recipient_name}\n\n{message_body}"
        else:
            formatted_message = f"🚨 EMERGENCY (ResQHub)\nHey {recipient_name},\n{message_body}"
            if map_url and map_url not in message_body:
                formatted_message += f"\n\nLocation: {map_url}"

        # 1. Mock Mode
        if settings.MOCK_SMS_PROVIDER:
            mock_sid = f"SM_mock_{uuid.uuid4().hex[:16]}"
            logger.info(
                f"[MOCK SMS MODE] Simulated delivery to {sanitized_phone} ({formatted_phone}), SID: {mock_sid}"
            )
            return {
                "success": True,
                "message_sid": mock_sid,
                "status": "mock",
                "error": None,
                "mock_mode": True,
            }

        # 2. Live Twilio Mode: Validate configuration
        config_error = self.validate_twilio_configuration()
        if config_error:
            logger.error(
                f"[LIVE SMS FAILED] Cannot deliver to {sanitized_phone}: {config_error}"
            )
            return {
                "success": False,
                "message_sid": None,
                "status": "failed",
                "error": config_error,
                "mock_mode": False,
            }

        if not self.client:
            self._init_twilio_client()

        if not self.client:
            return {
                "success": False,
                "message_sid": None,
                "status": "failed",
                "error": "Twilio client failed to initialize with provided credentials",
                "mock_mode": False,
            }

        # 3. Execute live Twilio dispatch
        try:
            logger.info(f"[LIVE SMS DISPATCH] Sending via Twilio to {sanitized_phone}")
            kwargs = {
                "to": formatted_phone,
                "from_": settings.TWILIO_FROM_NUMBER,
                "body": formatted_message,
            }
            if settings.TWILIO_WEBHOOK_URL and "localhost" not in settings.TWILIO_WEBHOOK_URL:
                kwargs["status_callback"] = settings.TWILIO_WEBHOOK_URL

            message = self.client.messages.create(**kwargs)
            provider_status = message.status or "queued"
            logger.info(
                f"[LIVE SMS ACCEPTED] Twilio SID {message.sid} for {sanitized_phone}: status={provider_status}"
            )

            return {
                "success": True,
                "message_sid": message.sid,
                "status": provider_status,
                "error": None,
                "mock_mode": False,
            }
        except TwilioRestException as e:
            code = getattr(e, "code", None)
            if code == 572006:
                err_msg = (
                    "Twilio Error 572006 (Trial Template Lock): Free trial accounts cannot send custom SMS "
                    "text to Indian numbers. Trial accounts must use predefined templates or be upgraded to "
                    "a full account to route via international carrier gateways (ILDO)."
                )
            elif code == 572002:
                err_msg = (
                    f"Twilio Error 572002 (Unverified Recipient): Destination number {formatted_phone} is not "
                    f"verified in Twilio. On trial accounts, all recipients must be pre-verified under "
                    f"'Phone Numbers > Manage > Verified Caller IDs' in the Twilio Console."
                )
            elif code == 21608:
                err_msg = (
                    f"Twilio Error 21608 (Unverified Recipient): Destination number {formatted_phone} is not "
                    f"verified on this Twilio trial account. Add it to Verified Caller IDs."
                )
            elif code == 21211:
                err_msg = f"Twilio Error 21211 (Invalid Number): Phone number {formatted_phone} is invalid or formatted incorrectly."
            elif code == 21606:
                err_msg = (
                    f"Twilio Error 21606 (Invalid Sender): The 'From' number ({settings.TWILIO_FROM_NUMBER}) "
                    f"is not a valid, SMS-capable Twilio number owned by this account."
                )
            elif code == 21408:
                err_msg = (
                    f"Twilio Error 21408 (Permission Denied): Geographic permissions for destination country "
                    f"are disabled in your Twilio Messaging Geographic Permissions console."
                )
            else:
                err_msg = f"Twilio Error {e.code}: {e.msg}"

            logger.error(
                f"Twilio REST error delivering to {sanitized_phone}: {err_msg}"
            )
            return {
                "success": False,
                "message_sid": None,
                "status": "failed",
                "error": err_msg,
                "error_code": e.code,
                "mock_mode": False,
            }
        except Exception as e:
            err_msg = f"SMS delivery failed: {str(e)}"
            logger.error(f"Unexpected error delivering SMS to {sanitized_phone}: {err_msg}")
            return {
                "success": False,
                "message_sid": None,
                "status": "failed",
                "error": err_msg,
                "mock_mode": False,
            }


sms_service = SMSService()
