from dataclasses import replace
from datetime import UTC, datetime, timedelta
from email import policy
from email.parser import BytesParser
from hashlib import sha256
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import select

from app.core.security import create_access_token, password_hash
from app.email_worker import deliver_batch
from app.models.account import AccountToken, AuthSession
from app.models.user import User
from app.services.account import link_token
from tests.conftest import PASSWORD, register_and_login

BASE = "/api/v1/auth"


def latest_token(client, purpose):
    with client.app.state.session_factory() as session:
        record = session.scalar(
            select(AccountToken)
            .where(AccountToken.purpose == purpose)
            .order_by(AccountToken.created_at.desc())
        )
        assert record is not None
        raw = link_token(record, client.app.state.settings)
        assert record.digest == sha256(raw.encode()).hexdigest()
        assert raw not in record.digest
        return raw, record.id


def test_verification_requires_explicit_confirmation_and_is_single_use(client):
    headers = register_and_login(client)
    raw, _ = latest_token(client, "verify")
    assert client.get(BASE + "/me", headers=headers).json()["email_verified"] is False
    assert client.get(BASE + "/email/verify", params={"token": raw}).status_code == 405
    assert client.post(BASE + "/email/verify", json={"token": raw}).status_code == 200
    assert client.get(BASE + "/me", headers=headers).json()["email_verified"] is True
    assert client.post(BASE + "/email/verify", json={"token": raw}).status_code == 400
    assert client.post(BASE + "/email/request", headers=headers).status_code == 202


def test_reset_has_generic_response_revokes_sessions_and_preserves_notebook(client):
    headers = register_and_login(client)
    other = client.post(
        BASE + "/login", json={"email": "alice@example.com", "password": PASSWORD}
    ).json()["access_token"]
    snapshot = {"schemaVersion": 1, "sections": [], "contents": [], "reminders": []}
    notebook = client.post(
        "/api/v1/notebooks", headers=headers, json={"snapshot": snapshot}
    ).json()
    unknown = client.post(
        BASE + "/password/reset-request", json={"email": "absent@example.com"}
    )
    known = client.post(
        BASE + "/password/reset-request", json={"email": "Alice@EXAMPLE.COM"}
    )
    assert (
        (unknown.status_code, unknown.json())
        == (known.status_code, known.json())
        == (202, {"message": "If the account is eligible, an email will be sent."})
    )
    raw, _ = latest_token(client, "reset")
    assert client.post(BASE + "/email/verify", json={"token": raw}).status_code == 400
    assert (
        client.post(
            BASE + "/password/reset", json={"token": raw, "password": "Ab123"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            BASE + "/password/reset", json={"token": raw, "password": "Other123"}
        ).status_code
        == 400
    )
    for auth in [headers, {"Authorization": "Bearer " + other}]:
        assert client.get(BASE + "/me", headers=auth).status_code == 401
    assert (
        client.post(
            BASE + "/login", json={"email": "alice@example.com", "password": PASSWORD}
        ).status_code
        == 401
    )
    logged = client.post(
        BASE + "/login", json={"email": "alice@example.com", "password": "Ab123"}
    )
    assert logged.status_code == 200
    restored = client.get(
        "/api/v1/notebooks/" + notebook["id"],
        headers={"Authorization": "Bearer " + logged.json()["access_token"]},
    )
    assert restored.json() == notebook
    assert "set-cookie" not in logged.headers


@pytest.mark.parametrize(
    "corruption", ["expired", "used", "secret", "purpose", "version", "disabled"]
)
def test_invalid_links_do_not_change_credentials(client, corruption):
    headers = register_and_login(client)
    client.post(BASE + "/password/reset-request", json={"email": "alice@example.com"})
    raw, token_id = latest_token(client, "reset")
    with client.app.state.session_factory.begin() as session:
        record = session.get(AccountToken, token_id)
        if corruption == "expired":
            record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        if corruption == "used":
            record.used_at = datetime.now(UTC)
        if corruption == "purpose":
            record.purpose = "verify"
        if corruption == "version":
            record.credential_version += 1
        if corruption == "disabled":
            session.get(User, record.user_id).is_active = False
    if corruption == "secret":
        raw += "x"
    response = client.post(
        BASE + "/password/reset", json={"token": raw, "password": "New123"}
    )
    assert response.status_code == 400
    assert raw not in response.text
    if corruption != "disabled":
        assert client.get(BASE + "/me", headers=headers).status_code == 200


def test_resending_invalidates_previous_link_and_password_change_invalidates_all_links(
    client,
):
    headers = register_and_login(client)
    first, _ = latest_token(client, "verify")
    assert client.post(BASE + "/email/request", headers=headers).status_code == 202
    second, _ = latest_token(client, "verify")
    assert first != second
    assert client.post(BASE + "/email/verify", json={"token": first}).status_code == 400
    assert (
        client.post(
            BASE + "/password/change",
            headers=headers,
            json={"current_password": "wrong", "password": "New123"},
        ).status_code
        == 400
    )
    assert client.get(BASE + "/me", headers=headers).status_code == 200
    assert (
        client.post(
            BASE + "/password/change",
            headers=headers,
            json={"current_password": PASSWORD, "password": "New123"},
        ).status_code
        == 200
    )
    assert client.get(BASE + "/me", headers=headers).status_code == 401
    assert (
        client.post(BASE + "/email/verify", json={"token": second}).status_code == 400
    )


def test_sessions_are_owner_scoped_and_logout_revokes_real_token(client):
    alice = register_and_login(client)
    bob = register_and_login(client, "bob@example.com")
    sessions = client.get(BASE + "/sessions", headers=alice).json()
    assert len(sessions) == 1 and sessions[0]["current"] is True
    session_id = sessions[0]["id"]
    assert (
        client.delete(BASE + "/sessions/" + session_id, headers=bob).status_code == 404
    )
    assert (
        client.delete(BASE + "/sessions/" + session_id, headers=alice).status_code
        == 200
    )
    assert client.get(BASE + "/me", headers=alice).status_code == 401
    assert client.post(BASE + "/logout", headers=bob).status_code == 200
    assert client.get(BASE + "/me", headers=bob).status_code == 401


def test_revoke_all_sessions_and_database_expiry(client):
    headers = register_and_login(client)
    assert (
        client.post(BASE + "/sessions/revoke-all", headers=headers).status_code == 200
    )
    assert client.get(BASE + "/me", headers=headers).status_code == 401
    token = client.post(
        BASE + "/login", json={"email": "alice@example.com", "password": PASSWORD}
    ).json()["access_token"]
    claims = jwt.decode(token, options={"verify_signature": False})
    with client.app.state.session_factory.begin() as session:
        session.get(AuthSession, claims["jti"]).expires_at = datetime.now(
            UTC
        ) - timedelta(seconds=1)
    assert (
        client.get(
            BASE + "/me", headers={"Authorization": "Bearer " + token}
        ).status_code
        == 401
    )


def test_signed_but_unregistered_tokens_and_cross_owner_session_are_rejected(client):
    headers = register_and_login(client)
    user_id = client.get(BASE + "/me", headers=headers).json()["id"]
    fabricated = create_access_token(user_id, client.app.state.settings)
    assert (
        client.get(
            BASE + "/me", headers={"Authorization": "Bearer " + fabricated}
        ).status_code
        == 401
    )
    bob = register_and_login(client, "bob@example.com")
    bob_session = client.get(BASE + "/sessions", headers=bob).json()[0]["id"]
    mixed = create_access_token(user_id, client.app.state.settings, bob_session)
    assert (
        client.get(
            BASE + "/me", headers={"Authorization": "Bearer " + mixed}
        ).status_code
        == 401
    )


@pytest.mark.parametrize("password", ["abcd1", "ABCD1", "Abcde", "Ab1", "12345"])
def test_new_password_policy_is_consistent_and_redacted(client, password):
    response = client.post(
        BASE + "/register", json={"email": "new@example.com", "password": password}
    )
    assert response.status_code == 422
    assert password not in response.text
    response = client.post(
        BASE + "/password/reset", json={"token": "secret-token", "password": password}
    )
    assert response.status_code == 422
    assert "secret-token" not in response.text


def test_existing_legacy_password_still_logs_in(client):
    with client.app.state.session_factory.begin() as session:
        session.add(
            User(
                id=str(uuid4()),
                email="legacy@example.com",
                password_hash=password_hash.hash("old lowercase password"),
                is_active=True,
            )
        )
    assert (
        client.post(
            BASE + "/login",
            json={"email": "legacy@example.com", "password": "old lowercase password"},
        ).status_code
        == 200
    )


def test_reset_requests_are_limited_for_unknown_accounts_too(client):
    for _ in range(3):
        assert (
            client.post(
                BASE + "/password/reset-request", json={"email": "absent@example.com"}
            ).status_code
            == 202
        )
    response = client.post(
        BASE + "/password/reset-request", json={"email": "absent@example.com"}
    )
    assert response.status_code == 429 and response.headers["retry-after"] == "60"


def test_mail_queue_delivers_local_link_once_without_consuming_it(client, tmp_path):
    register_and_login(client)
    settings = replace(
        client.app.state.settings,
        mail_outbox=str(tmp_path),
        frontend_url="https://example.com/Tomohu/",
    )
    factory = client.app.state.session_factory
    assert deliver_batch(factory, settings) == 1
    assert deliver_batch(factory, settings) == 0
    raw, token_id = latest_token(client, "verify")
    mail = BytesParser(policy=policy.default).parsebytes(
        (tmp_path / f"{token_id}.eml").read_bytes()
    )
    assert raw in (tmp_path / f"{token_id}.eml").read_text()
    assert mail["To"] == "alice@example.com"
    assert f"https://example.com/Tomohu/#account/verify/{raw}" in mail.get_content()
    assert client.post(BASE + "/email/verify", json={"token": raw}).status_code == 200


def test_mail_failure_retries_and_changed_secret_does_not_send_invalid_links(
    client, tmp_path, monkeypatch
):
    register_and_login(client)
    settings = replace(client.app.state.settings, mail_outbox=str(tmp_path))
    factory = client.app.state.session_factory

    def fail(*_args):
        raise OSError("SMTP unavailable")

    with monkeypatch.context() as patch:
        patch.setattr("app.email_worker.deliver", fail)
        assert deliver_batch(factory, settings) == 0
    _, token_id = latest_token(client, "verify")
    with factory.begin() as session:
        record = session.get(AccountToken, token_id)
        assert record.attempts == 1 and record.sent_at is None
        record.next_attempt_at = datetime.now(UTC) - timedelta(seconds=1)
    assert (
        deliver_batch(factory, replace(settings, jwt_secret="changed-secret-" * 4)) == 0
    )
    assert not list(tmp_path.glob("*.eml"))


def test_smtp_requires_tls_before_authentication(client, monkeypatch):
    from email.message import EmailMessage

    from app.email_worker import deliver

    calls = []

    class SMTP:
        def __init__(self, host, port, timeout):
            calls.append((host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def ehlo(self):
            calls.append("ehlo")

        def starttls(self, context):
            import ssl

            assert context.verify_mode == ssl.CERT_REQUIRED
            calls.append("tls")

        def login(self, username, password):
            calls.append((username, password))

        def send_message(self, message):
            calls.append(message["To"])

    monkeypatch.setattr("app.email_worker.smtplib.SMTP", SMTP)
    settings = replace(
        client.app.state.settings,
        mail_mode="smtp",
        smtp_host="smtp.example.com",
        smtp_username="account",
        smtp_password="secret",
    )
    message = EmailMessage()
    message["To"] = "alice@example.com"
    deliver(message, "id", settings)
    assert calls == [
        ("smtp.example.com", 587, 15),
        "ehlo",
        "tls",
        "ehlo",
        ("account", "secret"),
        "alice@example.com",
    ]


def test_password_change_rejects_login_using_stale_authenticated_credentials(client):
    from app.services.account import AccountService, InvalidAccountAction
    from app.services.auth import AuthService

    register_and_login(client)
    factory = client.app.state.session_factory
    with factory() as stale:
        user = AuthService().authenticate(stale, "alice@example.com", PASSWORD)
        with factory.begin() as current:
            active = current.get(User, user.id)
            AccountService().change_password(current, active, PASSWORD, "Next123")
        with pytest.raises(InvalidAccountAction):
            AccountService().create_session(stale, user, client.app.state.settings)


def test_postgres_concurrent_reset_consumes_link_once(client):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from app.services.account import AccountService, InvalidAccountAction

    if client.app.state.engine.dialect.name != "postgresql":
        pytest.skip("Production row locking is verified on PostgreSQL")
    register_and_login(client)
    client.post(BASE + "/password/reset-request", json={"email": "alice@example.com"})
    raw, _ = latest_token(client, "reset")
    start = Barrier(2)

    def confirm():
        start.wait(timeout=5)
        try:
            with client.app.state.session_factory.begin() as session:
                AccountService().confirm(session, raw, "reset", "Next123")
            return True
        except InvalidAccountAction:
            return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: confirm(), range(2)))
    assert sorted(results) == [False, True]
