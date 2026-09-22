from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Farah.event API"
    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite+aiosqlite:///./farah.db"
    jwt_secret: str = Field(
        default="development-only-change-this-secret-please", min_length=32
    )
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 30
    cors_origins: str = "http://localhost:3000"
    gemini_api_key: str | None = None
    gemini_chat_model: str = "gemini-3.6-flash"
    gemini_embedding_model: str = "text-embedding-004"
    qdrant_url: str | None = None
    qdrant_api_key: str | None = None
    qdrant_collection: str = "farah_female_profiles"
    dev_seed_password: str | None = None
    seed_admin_password: str | None = None
    seed_matchmaker_password: str | None = None
    seed_male_password: str | None = None
    rate_limit_per_minute: int = Field(default=120, ge=10, le=10_000)
    auth_pepper: str = Field(default="development-only-auth-pepper-change-me", min_length=32)
    otp_provider: Literal["mock", "production"] = "mock"
    otp_mock_code: str = Field(default="000000", pattern=r"^\d{6}$")
    otp_ttl_seconds: int = Field(default=300, ge=60, le=900)
    otp_max_attempts: int = Field(default=5, ge=3, le=10)
    otp_start_limit: int = Field(default=5, ge=2, le=30)
    otp_start_window_seconds: int = Field(default=600, ge=60, le=3600)
    request_code_attempt_limit: int = Field(default=5, ge=2, le=30)
    request_code_window_seconds: int = Field(default=900, ge=60, le=3600)

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.environment == "production":
            if (
                "jwt_secret" not in self.model_fields_set
                or self.jwt_secret.startswith("development-only-")
                or self.jwt_secret.startswith("replace-with-")
                or len(self.jwt_secret) < 32
            ):
                raise ValueError(
                    "JWT_SECRET must be a unique value of at least 32 characters in production"
                )
            if "*" in self.cors_origin_list:
                raise ValueError("Wildcard CORS origins are forbidden in production")
            if (
                "auth_pepper" not in self.model_fields_set
                or self.auth_pepper.startswith("development-only-")
            ):
                raise ValueError("AUTH_PEPPER must be a unique secret in production")
            if self.otp_provider == "mock":
                raise ValueError("OTP_PROVIDER=mock is forbidden in production")
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
