from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from pwdlib import PasswordHash

from app.core.config import Settings

ISSUER = "tomohu-api"
AUDIENCE = "tomohu-client"
password_hash = PasswordHash.recommended()
# Unknown accounts still perform the same expensive password verification.
DUMMY_HASH = password_hash.hash("unusable-dummy-password-" + str(uuid4()))


class InvalidToken(Exception):
    pass


def create_access_token(
    user_id: str, settings: Settings, session_id: str | None = None
) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": user_id,
            "iat": now,
            "nbf": now,
            "exp": now + timedelta(minutes=settings.access_token_minutes),
            "iss": ISSUER,
            "aud": AUDIENCE,
            "jti": session_id or str(uuid4()),
            "token_type": "access",
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def read_access_claims(token: str, settings: Settings) -> tuple[str, str]:
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=ISSUER,
            audience=AUDIENCE,
            options={
                "require": [
                    "sub",
                    "exp",
                    "iat",
                    "nbf",
                    "iss",
                    "aud",
                    "jti",
                    "token_type",
                ]
            },
        )
        if claims["token_type"] != "access":
            raise InvalidToken()
        subject = str(UUID(claims["sub"]))
        UUID(claims["jti"])
        if (
            not all(type(claims[key]) is int for key in ("exp", "iat", "nbf"))
            or claims["exp"] <= claims["iat"]
            or claims["exp"] - claims["iat"] > settings.access_token_minutes * 60
        ):
            raise InvalidToken()
        return subject, str(UUID(claims["jti"]))
    except (jwt.InvalidTokenError, ValueError, TypeError, AttributeError) as error:
        raise InvalidToken() from error
