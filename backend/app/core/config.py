import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from secrets import token_urlsafe
from urllib.parse import urlsplit

from dotenv import load_dotenv

DEFAULT_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")
LOCAL_DATABASE_URL = "postgresql+psycopg://tomohu:tomohu@localhost:5432/tomohu"
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def parse_origins(value: str | None) -> tuple[str, ...]:
    if value is None:
        return DEFAULT_CORS_ORIGINS
    origins = tuple(origin.strip() for origin in value.split(",") if origin.strip())
    return origins or DEFAULT_CORS_ORIGINS


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str
    environment: str
    cors_origins: tuple[str, ...]
    database_url: str = LOCAL_DATABASE_URL
    jwt_secret: str = field(default="", repr=False)
    access_token_minutes: int = 15

    def __post_init__(self) -> None:
        if self.environment not in {"development", "test", "production"}:
            raise ValueError("Unknown TOMOHU_ENVIRONMENT")
        if not 1 <= self.access_token_minutes <= 30:
            raise ValueError("Access tokens must expire within 1 to 30 minutes")
        if self.environment == "production":
            if len(self.jwt_secret.encode()) < 32:
                raise ValueError(
                    "Production requires a random JWT secret of at least 32 bytes"
                )
            if not self.database_url.startswith(
                ("postgresql://", "postgresql+psycopg://")
            ):
                raise ValueError("Production requires PostgreSQL")
            for origin in self.cors_origins:
                url = urlsplit(origin)
                if (
                    url.scheme != "https"
                    or not url.hostname
                    or url.username
                    or url.password
                    or url.path
                    or url.query
                    or url.fragment
                ):
                    raise ValueError("Production CORS origins must be HTTPS origins")
            if not self.cors_origins:
                raise ValueError("Production requires explicit CORS origins")
        if not self.jwt_secret:
            # A fresh application instance intentionally invalidates local tokens.
            object.__setattr__(self, "jwt_secret", token_urlsafe(48))
        elif len(self.jwt_secret.encode()) < 32:
            raise ValueError("JWT secrets must contain at least 32 bytes")


@lru_cache
def get_settings() -> Settings:
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
        jwt_secret=os.getenv("TOMOHU_JWT_SECRET", ""),
        access_token_minutes=int(os.getenv("TOMOHU_ACCESS_TOKEN_MINUTES", "15")),
    )
