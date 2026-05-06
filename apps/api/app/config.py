"""Runtime configuration for the API service."""

import os
from dataclasses import dataclass, field
from functools import lru_cache


def _csv_env(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = field(default_factory=lambda: os.getenv("LINEUPCAST_APP_NAME", "LineupCast OS API"))
    version: str = field(default_factory=lambda: os.getenv("LINEUPCAST_VERSION", "0.1.0"))
    environment: str = field(default_factory=lambda: os.getenv("LINEUPCAST_ENVIRONMENT", "development"))
    cors_origins: list[str] = field(default_factory=lambda: _csv_env("LINEUPCAST_CORS_ORIGINS", ["*"]))
    provider_mode: str = field(default_factory=lambda: os.getenv("LINEUPCAST_PROVIDER_MODE", "mock"))
    provider_api_key: str | None = field(default_factory=lambda: os.getenv("LINEUPCAST_PROVIDER_API_KEY"))
    prediction_model_name: str = field(default_factory=lambda: os.getenv("LINEUPCAST_PREDICTION_MODEL_NAME", "Dixon-Coles + Player Rating Adjustment"))
    prediction_model_version: str = field(default_factory=lambda: os.getenv("LINEUPCAST_PREDICTION_MODEL_VERSION", "1.0.0"))
    script_model_name: str = field(default_factory=lambda: os.getenv("LINEUPCAST_SCRIPT_MODEL_NAME", "LineupCast Scriptwriter"))
    script_model_version: str = field(default_factory=lambda: os.getenv("LINEUPCAST_SCRIPT_MODEL_VERSION", "1.1.0"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
