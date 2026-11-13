from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import text

from app.core.security import AUDIENCE, ISSUER, password_hash
from tests.conftest import PASSWORD, register_and_login


def test_registration_normalizes_email_and_never_returns_password(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "Alice@EXAMPLE.COM", "password": PASSWORD},
    )
    assert response.status_code == 201
    assert set(response.json()) == {"id", "email", "email_verified"}
    assert response.json()["email"] == "alice@example.com"
    with client.app.state.engine.connect() as connection:
        encoded = connection.execute(
            text("SELECT password_hash FROM users")
        ).scalar_one()
    assert encoded.startswith("$argon2id$")
    assert encoded != PASSWORD and password_hash.verify(PASSWORD, encoded)
    duplicate = client.post(
        "/api/v1/auth/register",
        json={"email": "ALICE@example.com", "password": PASSWORD},
    )
    assert duplicate.status_code == 409
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "ALICE@example.com", "password": PASSWORD},
        ).status_code
        == 200
    )


def test_login_and_current_user(client):
    headers = register_and_login(client)
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == "alice@example.com"
    assert set(response.json()) == {"id", "email", "email_verified"}
    assert response.headers["cache-control"] == "no-store"


def test_failed_login_does_not_reveal_account_existence(client):
    register_and_login(client)
    wrong = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "wrong long password"},
    )
    absent = client.post(
        "/api/v1/auth/login",
        json={"email": "absent@example.com", "password": "wrong long password"},
    )
    assert wrong.status_code == absent.status_code == 401
    assert wrong.json() == absent.json()


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "invalid", "password": PASSWORD},
        {"email": "alice@example.com", "password": "short"},
        {"email": "alice@example.com", "password": "x" * 129},
        {"email": "alice@example.com", "password": PASSWORD, "is_active": True},
        {"email": "alice@example.com", "password": {"secret": "do not echo me"}},
    ],
)
def test_invalid_registration_never_echoes_password(client, payload):
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert all("input" not in item for item in response.json()["detail"])
    assert "do not echo me" not in response.text
    assert PASSWORD not in response.text


@pytest.mark.parametrize(
    "mutation",
    [
        "expired",
        "signature",
        "audience",
        "issuer",
        "type",
        "missing",
        "future",
        "algorithm",
        "unknown",
        "lifetime",
        "subject",
        "timestamp",
    ],
)
def test_invalid_tokens_are_rejected(client, mutation):
    headers = register_and_login(client)
    me = client.get("/api/v1/auth/me", headers=headers).json()
    now = datetime.now(UTC)
    claims = {
        "sub": me["id"],
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=15),
        "iss": ISSUER,
        "aud": AUDIENCE,
        "jti": str(uuid4()),
        "token_type": "access",
    }
    key = client.app.state.settings.jwt_secret
    algorithm = "HS256"
    if mutation == "expired":
        claims.update(
            iat=now - timedelta(hours=1),
            nbf=now - timedelta(hours=1),
            exp=now - timedelta(minutes=45),
        )
    elif mutation == "signature":
        key = "another-secret-" * 4
    elif mutation == "audience":
        claims["aud"] = "other-app"
    elif mutation == "issuer":
        claims["iss"] = "other-issuer"
    elif mutation == "type":
        claims["token_type"] = "refresh"
    elif mutation == "missing":
        del claims["exp"]
    elif mutation == "future":
        claims["nbf"] = now + timedelta(minutes=1)
    elif mutation == "algorithm":
        algorithm = "HS384"
    elif mutation == "unknown":
        claims["sub"] = str(uuid4())
    elif mutation == "lifetime":
        claims["exp"] = now + timedelta(hours=1)
    elif mutation == "subject":
        claims["sub"] = "not-a-user-id"
    elif mutation == "timestamp":
        claims["iat"] = str(int(now.timestamp()))
    token = jwt.encode(claims, key, algorithm=algorithm)
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer " + token}
    )
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("authorization", [None, "Basic abc", "Bearer malformed"])
def test_missing_or_malformed_authorization(client, authorization):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": authorization} if authorization else {},
    )
    assert response.status_code == 401


def test_disabled_account_loses_access_and_cannot_login(client):
    headers = register_and_login(client)
    with client.app.state.engine.begin() as connection:
        connection.execute(text("UPDATE users SET is_active = false"))
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 403
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "alice@example.com", "password": PASSWORD},
        ).status_code
        == 401
    )


def test_account_limit_is_shared_between_ips_and_ignores_forwarded_header(client):
    # Unknown accounts are limited too, without expensive password work in this test.
    key = __import__("hashlib").sha256(b"alice@example.com").hexdigest()
    for _ in range(10):
        client.app.state.auth_limiter.check(f"account:{key}", 10)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": PASSWORD},
        headers={"X-Forwarded-For": "1.2.3.4"},
    )
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"


def test_ip_limit_also_covers_invalid_payloads(client):
    for _ in range(30):
        assert client.post("/api/v1/auth/register", json={}).status_code == 422
    assert (
        client.post(
            "/api/v1/auth/register", json={}, headers={"X-Forwarded-For": "new"}
        ).status_code
        == 429
    )


def test_cors_allows_configured_origin_and_rejects_other_origins(client):
    path = "/api/v1/auth/login"
    allowed = client.options(
        path,
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options(
        path,
        headers={
            "Origin": "https://attacker.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers


def test_openapi_documents_bearer_and_redacts_password_schema(client):
    schema = client.get("/openapi.json").json()
    assert schema["info"]["version"] == "0.22.0"
    assert schema["paths"]["/api/v1/notebooks"]["post"]["security"] == [
        {"HTTPBearer": []}
    ]
    password = schema["components"]["schemas"]["Credentials"]["properties"]["password"]
    assert password["writeOnly"] is True


def test_duplicate_registration_race_is_a_conflict_not_a_server_error(
    client, monkeypatch
):
    from app.repositories.user import UserRepository

    register_and_login(client)
    original = UserRepository.get_by_email
    calls = 0

    def racing_lookup(self, session, email):
        nonlocal calls
        calls += 1
        if calls == 1:
            return None
        return original(self, session, email)

    monkeypatch.setattr(UserRepository, "get_by_email", racing_lookup)
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "alice@example.com", "password": PASSWORD},
    )
    assert response.status_code == 409
    with client.app.state.engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar_one() == 1


def test_token_in_url_does_not_authenticate(client):
    headers = register_and_login(client)
    token = headers["Authorization"].split(" ", 1)[1]
    assert client.get("/api/v1/auth/me", params={"token": token}).status_code == 401
