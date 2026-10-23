from fastapi import APIRouter
from app.api.v1.endpoints import health, alerts, webhook

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alerts"])
api_router.include_router(webhook.router, prefix="/alerts", tags=["Webhooks"])
