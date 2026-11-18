from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models.account import AuthSession
from app.models.notebook import NotebookRecord
from tests.conftest import PASSWORD

BASE = "/api/v1/auth/browser"
TRUSTED = {"Origin": "http://localhost:5173", "X-Tomohu-Request": "1"}


def credentials(client):
    payload = {"email": "browser@example.com", "password": PASSWORD}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    return payload


def sign_in(client):
    response = client.post(BASE + "/login", json=credentials(client), headers=TRUSTED)
    assert response.status_code == 200
    return response


def test_browser_login_rejects_untrusted_origins_before_issuing_cookie(client):
    payload = credentials(client)
    for headers in [
        {},
        {"Origin": "https://untrusted.example", "X-Tomohu-Request": "1"},
        {"Origin": "http://localhost:5173"},
    ]:
        response = client.post(BASE + "/login", json=payload, headers=headers)
        assert response.status_code == 403
        assert "set-cookie" not in response.headers


def test_renewal_rotates_cookie_bootstrap_is_idempotent_and_revoke_blocks_access(
    client,
):
    response = sign_in(client)
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie.lower().replace(
        "samesite", "SameSite"
    )
    original = client.cookies.get("tomohu_refresh")
    first = response.json()
    assert "refresh" not in str(first).lower()
    renewed = client.post(BASE + "/refresh", headers=TRUSTED)
    assert renewed.status_code == 200
    assert client.cookies.get("tomohu_refresh") != original
    headers = {**TRUSTED, "Authorization": "Bearer " + renewed.json()["access_token"]}
    a = client.post(BASE + "/bootstrap", headers=headers)
    b = client.post(BASE + "/bootstrap", headers=headers)
    assert a.status_code == b.status_code == 200
    assert a.json()["id"] == b.json()["id"]
    assert a.json()["snapshot"]["contents"] == []
    with client.app.state.session_factory() as session:
        assert len(list(session.scalars(select(NotebookRecord)))) == 1
    assert (
        client.post("/api/v1/auth/sessions/revoke-all", headers=headers).status_code
        == 200
    )
    assert client.post(BASE + "/refresh", headers=TRUSTED).status_code == 401
    assert client.get("/api/v1/notebooks", headers=headers).status_code == 401


def test_expired_renewal_and_forged_secrets_cannot_authenticate(client):
    sign_in(client)
    original = client.cookies.get("tomohu_refresh")
    client.cookies.clear()
    client.cookies.set("tomohu_refresh", original.split(".")[0] + ".forged")
    assert client.post(BASE + "/refresh", headers=TRUSTED).status_code == 401
    client.cookies.clear()
    client.cookies.set("tomohu_refresh", original)
    with client.app.state.session_factory.begin() as session:
        record = session.scalar(
            select(AuthSession).where(AuthSession.revoked_at.is_(None))
        )
        record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert client.post(BASE + "/refresh", headers=TRUSTED).status_code == 401


def test_cookie_logout_revokes_bearer_even_when_client_cannot_use_it(client):
    signed = sign_in(client)
    assert client.post(BASE + "/logout", headers=TRUSTED).status_code == 200
    assert not client.cookies.get("tomohu_refresh")
    assert client.post(BASE + "/refresh", headers=TRUSTED).status_code == 401
    assert (
        client.get(
            "/api/v1/notebooks",
            headers={"Authorization": "Bearer " + signed.json()["access_token"]},
        ).status_code
        == 401
    )


def test_old_cookie_cannot_renew_and_session_secret_is_hashed(client):
    signed = sign_in(client)
    original = client.cookies.get("tomohu_refresh")
    assert client.post(BASE + "/refresh", headers=TRUSTED).status_code == 200
    current = client.cookies.get("tomohu_refresh")
    client.cookies.clear()
    client.cookies.set("tomohu_refresh", original)
    stale = client.post(BASE + "/refresh", headers=TRUSTED)
    assert stale.status_code == 409
    assert "set-cookie" not in stale.headers
    assert "access_token" not in stale.json()
    from app.models.browser_session import BrowserRenewal

    with client.app.state.session_factory() as session:
        record = session.scalar(select(BrowserRenewal))
        assert current.split(".")[1] not in record.digest
        assert len(record.digest) == 64
    # Password changes revoke the same extended session and renewal family.
    client.cookies.clear()
    client.cookies.set("tomohu_refresh", current)
    assert (
        client.post(
            "/api/v1/auth/password/change",
            headers={"Authorization": "Bearer " + signed.json()["access_token"]},
            json={"current_password": PASSWORD, "password": "Changed123"},
        ).status_code
        == 200
    )
    assert client.post(BASE + "/refresh", headers=TRUSTED).status_code == 401


def test_bootstrap_concurrent_requests_create_only_one_notebook_on_postgres(client):
    from concurrent.futures import ThreadPoolExecutor

    import pytest
    from fastapi.testclient import TestClient

    if client.app.state.engine.dialect.name != "postgresql":
        pytest.skip("Row serialization requires PostgreSQL")
    signed = sign_in(client)
    headers = {**TRUSTED, "Authorization": "Bearer " + signed.json()["access_token"]}

    def create(_):
        with TestClient(client.app) as other:
            response = other.post(BASE + "/bootstrap", headers=headers)
            assert response.status_code == 200
            return response.json()["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(create, range(2)))
    assert ids[0] == ids[1]
    with client.app.state.session_factory() as session:
        assert len(list(session.scalars(select(NotebookRecord)))) == 1


def test_session_renewals_do_not_consume_password_attempt_budget(client):
    sign_in(client)
    for _ in range(30):
        assert client.post(BASE + "/refresh", headers=TRUSTED).status_code == 200
    assert (
        client.post(
            "/api/v1/auth/password/reset-request", json={"email": "browser@example.com"}
        ).status_code
        == 202
    )


def test_bootstrap_preserves_existing_snapshot_optional_field_contract(client):
    signed = sign_in(client)
    headers = {**TRUSTED, "Authorization": "Bearer " + signed.json()["access_token"]}
    snapshot = {
        "schemaVersion": 1,
        "sections": [
            {
                "id": "s",
                "parentId": None,
                "title": "Existing",
                "emoji": "",
                "color": "#a7bcec",
            }
        ],
        "contents": [
            {
                "id": "n",
                "sectionId": "s",
                "title": "Note",
                "kind": "note",
                "text": "Preserved",
            }
        ],
        "reminders": [],
    }
    created = client.post(
        "/api/v1/notebooks", headers=headers, json={"snapshot": snapshot}
    )
    assert created.status_code == 201
    resumed = client.post(BASE + "/bootstrap", headers=headers)
    assert resumed.status_code == 200
    assert resumed.json()["snapshot"] == created.json()["snapshot"]
    assert "items" not in resumed.json()["snapshot"]["contents"][0]


def test_production_browser_routes_require_same_origin_https_and_secure_cookie():
    from types import SimpleNamespace

    import pytest
    from fastapi import HTTPException, Response
    from starlette.requests import Request

    from app.api.routes.browser_session import set_cookie, trusted_browser

    settings = SimpleNamespace(
        environment="production",
        cors_origins=("https://app.example.com", "https://other.example.com"),
        frontend_url="https://app.example.com/",
    )

    def request(scheme, host, origin):
        return Request(
            {
                "type": "http",
                "scheme": scheme,
                "path": "/",
                "headers": [
                    (b"host", host.encode()),
                    (b"origin", origin.encode()),
                    (b"x-tomohu-request", b"1"),
                ],
                "app": SimpleNamespace(state=SimpleNamespace(settings=settings)),
            }
        )

    trusted_browser(request("https", "app.example.com", "https://app.example.com"))
    for scheme, host, origin in [
        ("http", "app.example.com", "https://app.example.com"),
        ("https", "api.example.com", "https://app.example.com"),
        ("https", "app.example.com", "https://other.example.com"),
    ]:
        with pytest.raises(HTTPException) as rejected:
            trusted_browser(request(scheme, host, origin))
        assert rejected.value.status_code == 403
    response = Response()
    set_cookie(
        response,
        "synthetic-session-secret",
        SimpleNamespace(expires_at=datetime.now(UTC) + timedelta(days=14)),
        settings,
    )
    cookie = response.headers["set-cookie"]
    assert "Secure" in cookie and "HttpOnly" in cookie and "SameSite=strict" in cookie
