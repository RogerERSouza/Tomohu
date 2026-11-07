import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)
LOCAL_DATABASE_URL = "postgresql+psycopg://tomohu:tomohu@localhost:5432/tomohu"
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def parse_origins(value: str | None) -> tuple[str, ...]:
    """Parse a comma-separated allowlist while rejecting an empty configuration."""
    if value is None:
        return DEFAULT_CORS_ORIGINS
    origins = tuple(origin.strip() for origin in value.split(",") if origin.strip())
    return origins or DEFAULT_CORS_ORIGINS


def parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes"}:
        return True
    if normalized in {"0", "false", "no"}:
        return False
    raise ValueError("Boolean settings must be true/false, yes/no or 1/0")


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str
    environment: str
    cors_origins: tuple[str, ...]
    database_url: str = LOCAL_DATABASE_URL
    allow_anonymous_notebooks: bool = True


@lru_cache
def get_settings() -> Settings:
    """Read non-secret application settings from the environment once per process."""
    load_dotenv(ENV_FILE)
    environment = os.getenv("TOMOHU_ENVIRONMENT", "development")
    raw_origins = os.getenv("TOMOHU_CORS_ORIGINS")
    if environment == "production" and not raw_origins:
        raise ValueError("TOMOHU_CORS_ORIGINS is required in production")
    return Settings(
        app_name=os.getenv("TOMOHU_APP_NAME", "Tomohu API"),
        environment=environment,
        cors_origins=parse_origins(raw_origins),
        database_url=os.getenv("TOMOHU_DATABASE_URL", LOCAL_DATABASE_URL),
        allow_anonymous_notebooks=parse_bool(
            os.getenv("TOMOHU_ALLOW_ANONYMOUS_NOTEBOOKS"),
            default=environment != "production",
        ),
    )
