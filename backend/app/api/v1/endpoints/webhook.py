import logging
from typing import Optional
from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import AlertRecipient, Alert
from app.core.security import verify_twilio_signature
from app.core.config import settings

logger = logging.getLogger("resqhub.webhook")

router = APIRouter()


@router.post("/webhook/twilio", summary="Twilio Status Callback Webhook")
async def twilio_status_webhook(
    request: Request,
    MessageSid: str = Form(...),
    MessageStatus: str = Form(...),
    ErrorCode: Optional[str] = Form(None),
    ErrorMessage: Optional[str] = Form(None),
    x_twilio_signature: Optional[str] = Header(None, alias="X-Twilio-Signature"),
    db: Session = Depends(get_db),
):
    """
    Receives and processes Twilio delivery status callbacks.
    Updates recipient delivery status in database.
    """
    # 1. Signature validation (when live)
    form_data = await request.form()
    params = {k: v for k, v in form_data.items()}
    request_url = str(request.url)

    if not verify_twilio_signature(request_url, params, x_twilio_signature):
        logger.warning("Twilio webhook signature verification failed")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")

    logger.info(f"Twilio callback for SID {MessageSid}: status={MessageStatus}")

    # 2. Find recipient by provider_message_sid
    recipient = db.query(AlertRecipient).filter(AlertRecipient.provider_message_sid == MessageSid).first()
    if not recipient:
        logger.warning(f"No recipient found for Twilio SID: {MessageSid}")
        return Response(content="<Response></Response>", media_type="application/xml")

    # 3. Update delivery status
    recipient.delivery_status = MessageStatus.lower()
    if ErrorMessage or ErrorCode:
        recipient.error_message = f"Twilio {ErrorCode}: {ErrorMessage}"

    db.commit()

    # 4. Check if all recipients for this alert are resolved or failed
    alert = db.query(Alert).filter(Alert.id == recipient.alert_id).first()
    if alert and alert.status not in ("resolved", "cancelled"):
        all_recipients = alert.recipients
        statuses = [r.delivery_status for r in all_recipients]
        if all(s == "delivered" for s in statuses):
            alert.status = "delivered"
        elif any(s in ("failed", "undelivered") for s in statuses):
            if any(s in ("delivered", "sent") for s in statuses):
                alert.status = "partially_delivered"
            else:
                alert.status = "failed"
        db.commit()

    return Response(content="<Response></Response>", media_type="application/xml")
