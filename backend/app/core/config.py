import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def parse_origins(value: str | None) -> tuple[str, ...]:
    """Parse a comma-separated allowlist while rejecting an empty configuration."""
    if value is None:
        return DEFAULT_CORS_ORIGINS
    origins = tuple(origin.strip() for origin in value.split(",") if origin.strip())
    return origins or DEFAULT_CORS_ORIGINS


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str
    environment: str
    cors_origins: tuple[str, ...]


@lru_cache
def get_settings() -> Settings:
    """Read non-secret application settings from the environment once per process."""
    load_dotenv(ENV_FILE)
    return Settings(
        app_name=os.getenv("TOMOHU_APP_NAME", "Tomohu API"),
        environment=os.getenv("TOMOHU_ENVIRONMENT", "development"),
        cors_origins=parse_origins(os.getenv("TOMOHU_CORS_ORIGINS")),
    )
