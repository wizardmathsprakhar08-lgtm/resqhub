import os
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, field_validator


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "ResQHub Emergency Safety Platform"

    ALLOWED_ORIGINS: Union[str, List[str]] = "*"
    SECRET_KEY: str = "resqhub-development-secret-key-32charsmin"
    API_KEY: str = "resqhub-development-api-key"

    # Database: SQLite by default for development/testing, PostgreSQL for production
    DATABASE_URL: str = "sqlite:///./resqhub.db"

    # Twilio SMS Configuration
    TWILIO_ACCOUNT_SID: str = "AC_dummy_account_sid_placeholder_12345"
    TWILIO_AUTH_TOKEN: str = "dummy_auth_token_placeholder_67890"
    TWILIO_FROM_NUMBER: str = "+15005550006"
    MOCK_SMS_PROVIDER: bool = True
    TWILIO_WEBHOOK_URL: str = "http://localhost:8000/api/v1/alerts/webhook/twilio"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
