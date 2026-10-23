import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert, AlertRecipient
from app.schemas.alert import (
    AlertCreate,
    AlertResponse,
    AlertListResponse,
    AlertListItem,
    AlertResolve,
)
from app.services.sms import sms_service, normalize_to_e164, is_placeholder_or_empty, TwilioClient
from app.core.security import verify_api_key
from app.core.config import settings

logger = logging.getLogger("resqhub.alerts")

router = APIRouter()


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED, summary="Create Emergency Alert")
def create_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Creates an emergency alert and dispatches SMS notifications to recipients.
    Idempotent: duplicate `idempotency_key` returns existing alert without re-dispatching.
    """
    # 1. Check idempotency
    existing_alert = db.query(Alert).filter(Alert.idempotency_key == payload.idempotency_key).first()
    if existing_alert:
        logger.info(f"Idempotent replay for key: {payload.idempotency_key}")
        return existing_alert

    # 2. Create Alert DB record
    alert = Alert(
        idempotency_key=payload.idempotency_key,
        status="sending",
        message=payload.message,
        latitude=payload.latitude,
        longitude=payload.longitude,
        map_url=payload.map_url,
        sender_device_id=payload.sender_device_id,
    )
    db.add(alert)
    db.flush()  # Allocate alert.id

    # 3. Create recipients and dispatch SMS
    is_sim_dispatch = (getattr(payload, "channel", "twilio") == "sim")
    success_count = 0
    failure_count = 0
    mock_count = 0

    for rec_data in payload.recipients:
        if is_sim_dispatch:
            # Device already dispatched or attempted SMS directly via cellular SIM
            rec_status = rec_data.delivery_status or "sent"
            rec_error = rec_data.error_message
            rec_sid = f"SIM_{uuid.uuid4().hex[:12]}"

            if rec_status in ("sent", "delivered"):
                success_count += 1
            else:
                failure_count += 1

            formatted_phone = normalize_to_e164(rec_data.phone_number) or rec_data.phone_number
            recipient = AlertRecipient(
                alert_id=alert.id,
                contact_name=rec_data.contact_name,
                phone_number=formatted_phone,
                provider_message_sid=rec_sid,
                delivery_status=rec_status,
                error_message=rec_error,
            )
            db.add(recipient)
        else:
            # Twilio gateway dispatch
            dispatch_result = sms_service.send_emergency_sms(
                to_phone=rec_data.phone_number,
                recipient_name=rec_data.contact_name,
                message_body=payload.message,
                map_url=payload.map_url,
            )

            is_mock = dispatch_result.get("mock_mode", False)
            if is_mock:
                recipient_status = "mock"
                mock_count += 1
                success_count += 1
            elif dispatch_result.get("success"):
                # Provider accepted or queued message; preserve actual provider status
                raw_status = dispatch_result.get("status", "sent")
                recipient_status = raw_status if raw_status in ("queued", "sent", "delivered") else "sent"
                success_count += 1
            else:
                recipient_status = "failed"
                failure_count += 1

            formatted_phone = normalize_to_e164(rec_data.phone_number) or rec_data.phone_number
            recipient = AlertRecipient(
                alert_id=alert.id,
                contact_name=rec_data.contact_name,
                phone_number=formatted_phone,
                provider_message_sid=dispatch_result.get("message_sid"),
                delivery_status=recipient_status,
                error_message=dispatch_result.get("error"),
            )
            db.add(recipient)

    # 4. Update overall alert status
    if mock_count == len(payload.recipients):
        alert.status = "mock"
    elif failure_count == 0:
        alert.status = "sent"
    elif success_count > 0:
        alert.status = "partial_failure"
    else:
        alert.status = "failed"

    db.commit()
    db.refresh(alert)
    return alert


@router.get("/diagnostics/sms", summary="SMS Gateway Diagnostics")
def get_sms_diagnostics(
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Safe diagnostics endpoint reporting SMS configuration and provider readiness.
    Never exposes credentials or secrets.
    """
    twilio_installed = TwilioClient is not None
    mock_mode = settings.MOCK_SMS_PROVIDER

    # Credential validation without exposing secrets
    account_sid_valid = (
        not is_placeholder_or_empty(settings.TWILIO_ACCOUNT_SID)
        and settings.TWILIO_ACCOUNT_SID.startswith("AC")
    )
    auth_token_valid = not is_placeholder_or_empty(settings.TWILIO_AUTH_TOKEN)
    from_number_valid = not is_placeholder_or_empty(settings.TWILIO_FROM_NUMBER)

    masked_from = None
    if from_number_valid and settings.TWILIO_FROM_NUMBER:
        num = settings.TWILIO_FROM_NUMBER.strip()
        masked_from = num[:3] + "..." + num[-4:] if len(num) > 7 else "***"

    if mock_mode:
        config_status = "mock_mode"
        guidance = (
            "MOCK_SMS_PROVIDER is enabled. Outbound SMS is simulated in logs and not sent over cellular networks. "
            "To send real SMS, set MOCK_SMS_PROVIDER=false and provide valid Twilio credentials in backend/.env."
        )
    elif not twilio_installed:
        config_status = "unconfigured"
        guidance = "Twilio library is not installed in Python environment (pip install twilio)."
    elif not (account_sid_valid and auth_token_valid and from_number_valid):
        config_status = "unconfigured"
        guidance = (
            "Twilio credentials in backend/.env are missing or placeholder. Set TWILIO_ACCOUNT_SID (starts with AC), "
            "TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (E.164 phone number) to enable live SMS."
        )
    else:
        config_status = "live_ready"
        guidance = (
            "Twilio credentials configured. For Twilio Trial accounts, recipient numbers must be pre-verified "
            "in Twilio Console under Verified Caller IDs to avoid Error 572002 / 21608. "
            "Note that Twilio Trial accounts restrict custom SMS body text to Indian numbers (Error 572006); "
            "an upgraded Twilio account with an active Twilio-provisioned sender number is required for custom emergency text."
        )

    # Last alert dispatch summary from DB
    last_alert = db.query(Alert).order_by(Alert.created_at.desc()).first()
    last_dispatch = None
    if last_alert:
        last_dispatch = {
            "alert_id": last_alert.id,
            "status": last_alert.status,
            "created_at": last_alert.created_at.isoformat() if last_alert.created_at else None,
            "recipient_count": len(last_alert.recipients),
            "statuses": [
                {
                    "delivery_status": r.delivery_status,
                    "error_message": r.error_message,
                    "provider_message_sid": r.provider_message_sid,
                }
                for r in last_alert.recipients
            ],
        }

    return {
        "mock_mode": mock_mode,
        "twilio_installed": twilio_installed,
        "account_sid_configured": account_sid_valid,
        "auth_token_configured": auth_token_valid,
        "from_number_configured": from_number_valid,
        "masked_from_number": masked_from,
        "configuration_status": config_status,
        "guidance": guidance,
        "last_dispatch": last_dispatch,
    }


@router.get("/{alert_id}", response_model=AlertResponse, summary="Get Alert by ID")
def get_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Retrieves the status and recipient delivery ledger for a specific alert.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.get("", response_model=AlertListResponse, summary="List Alert History")
def list_alerts(
    device_id: Optional[str] = Query(None, description="Filter by sender device ID"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Retrieves authorized alert history for a device.
    """
    query = db.query(Alert)
    if device_id:
        query = query.filter(Alert.sender_device_id == device_id)

    total = query.count()
    alerts = query.order_by(Alert.created_at.desc()).offset(offset).limit(limit).all()

    items = [
        AlertListItem(
            id=a.id,
            status=a.status,
            message=a.message,
            map_url=a.map_url,
            created_at=a.created_at,
            resolved_at=a.resolved_at,
            recipients_count=len(a.recipients),
        )
        for a in alerts
    ]

    return AlertListResponse(total=total, limit=limit, offset=offset, items=items)


@router.post("/{alert_id}/resolve", response_model=AlertResponse, summary="Resolve / Cancel Alert")
def resolve_alert(
    alert_id: str,
    payload: AlertResolve,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_api_key),
):
    """
    Marks an active emergency alert as resolved or cancelled.
    """
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return alert
