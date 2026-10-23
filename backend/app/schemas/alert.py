from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
import re


class RecipientCreate(BaseModel):
    contact_name: str = Field(..., min_length=1, max_length=128, description="Emergency contact full name")
    phone_number: str = Field(..., min_length=7, max_length=32, description="E.164 normalized phone number")
    delivery_status: Optional[str] = Field(None, max_length=32, description="Device-reported delivery status")
    error_message: Optional[str] = Field(None, max_length=512, description="Device-reported error if SMS failed")

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-\(\)]", "", v)
        if not cleaned:
            raise ValueError("Phone number cannot be empty")
        digits_only = re.sub(r"\D", "", cleaned)
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise ValueError("Phone number must contain between 7 and 15 digits")
        return cleaned


class RecipientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    contact_name: str
    phone_number: str
    provider_message_sid: Optional[str] = None
    delivery_status: str
    error_message: Optional[str] = None


class AlertCreate(BaseModel):
    idempotency_key: str = Field(..., min_length=8, max_length=128, description="Unique client key to prevent duplicate sends")
    message: str = Field(..., min_length=1, max_length=1000, description="Emergency message text")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    map_url: Optional[str] = Field(None, max_length=512)
    sender_device_id: Optional[str] = Field(None, max_length=128)
    channel: Optional[str] = Field("twilio", max_length=32, description="Dispatch channel: 'sim' (device-sent SIM SMS) or 'twilio' (backend gateway SMS)")
    recipients: List[RecipientCreate] = Field(..., min_length=1, max_length=5, description="1 to 5 emergency contacts")


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    idempotency_key: str
    status: str
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    map_url: Optional[str] = None
    sender_device_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    recipients: List[RecipientResponse] = []


class AlertResolve(BaseModel):
    reason: Optional[str] = Field("Safe now / Resolved", max_length=256)
    sender_device_id: Optional[str] = Field(None, max_length=128)


class AlertListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    message: str
    map_url: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    recipients_count: int


class AlertListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[AlertListItem]
