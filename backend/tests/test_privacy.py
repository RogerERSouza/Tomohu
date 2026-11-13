from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import select

from app.models.account import AccountToken
from app.models.user import User
from app.services.account import link_token
from tests.conftest import PASSWORD, register_and_login

BASE = "/api/v1/privacy"
SNAPSHOT = {
    "schemaVersion": 1,
    "sections": [
        {
            "id": "root",
            "parentId": None,
            "title": "Private title",
            "emoji": "",
            "color": "#a7bcec",
        },
        {
            "id": "child",
            "parentId": "root",
            "title": "Child secret",
            "emoji": "",
            "color": "#a7bcec",
        },
    ],
    "contents": [
        {
            "id": "note",
            "sectionId": "child",
            "title": "Secret note",
            "kind": "note",
            "text": "Never in public JSON",
        }
    ],
    "reminders": [],
}


def ready(client):
    headers = register_and_login(client)
    with client.app.state.session_factory.begin() as session:
        user = session.scalar(select(User))
        user.email_verified = True
    assert (
        client.post(
            BASE + "/password", headers=headers, json={"password": "Private123"}
        ).status_code
        == 200
    )
    result = client.post(
        BASE + "/unlock", headers=headers, json={"password": "Private123"}
    )
    assert result.status_code == 200
    unlocked = {**headers, "X-Privacy-Token": result.json()["token"]}
    book = client.post(
        "/api/v1/notebooks", headers=headers, json={"snapshot": SNAPSHOT}
    ).json()
    return headers, unlocked, book


def protect(client, unlocked, book, kind="section", root="root"):
    result = client.post(
        f"{BASE}/notebooks/{book['id']}",
        headers=unlocked,
        json={"kind": kind, "root_id": root, "revision": book["revision"]},
    )
    assert result.status_code == 200, result.text
    return result.json()["id"]


def test_privacy_setup_requires_verified_email_and_does_not_change_login(client):
    headers = register_and_login(client)
    assert (
        client.post(
            BASE + "/password", headers=headers, json={"password": "Private123"}
        ).status_code
        == 403
    )
    with client.app.state.session_factory.begin() as session:
        session.scalar(select(User)).email_verified = True
    assert (
        client.post(
            BASE + "/password", headers=headers, json={"password": PASSWORD}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "alice@example.com", "password": PASSWORD},
        ).status_code
        == 200
    )
    assert (
        client.post(
            BASE + "/password",
            headers=headers,
            json={"password": "Next123", "current_password": "bad"},
        ).status_code
        == 403
    )


@pytest.mark.parametrize("kind,root", [("section", "root"), ("content", "note")])
def test_protected_data_is_absent_from_public_snapshot_and_requires_grant(
    client, kind, root
):
    headers, unlocked, book = ready(client)
    item = protect(client, unlocked, book, kind, root)
    public = client.get(f"/api/v1/notebooks/{book['id']}", headers=headers)
    assert "Never in public JSON" not in public.text
    listing = client.get(f"{BASE}/notebooks/{book['id']}", headers=headers)
    assert listing.status_code == 200 and "Private title" not in listing.text
    unlocked_list = client.get(f"{BASE}/notebooks/{book['id']}", headers=unlocked)
    assert unlocked_list.json()[0]["title"] == (
        "Private title" if kind == "section" else "Secret note"
    )
    url = f"{BASE}/notebooks/{book['id']}/{item}"
    assert client.get(url, headers=headers).status_code == 403
    assert (
        client.get(url, headers=unlocked).json()["snapshot"]["contents"][0]["text"]
        == "Never in public JSON"
    )
    # Stale public snapshots cannot reintroduce the protected data.
    assert (
        client.put(
            f"/api/v1/notebooks/{book['id']}",
            headers=headers,
            json={"snapshot": SNAPSHOT, "revision": 2},
        ).status_code
        == 409
    )
    result = client.post(
        url + "/restore", headers=unlocked, json={"revision": 2, "item_revision": 1}
    )
    assert result.status_code == 200, result.text
    restored = client.get(f"/api/v1/notebooks/{book['id']}", headers=headers).json()
    assert restored["snapshot"] == SNAPSHOT


def test_privacy_is_bound_to_account_and_auth_session(client):
    headers, unlocked, book = ready(client)
    item = protect(client, unlocked, book)
    other = register_and_login(client, "other@example.com")
    assert (
        client.get(f"{BASE}/notebooks/{book['id']}", headers=other).status_code == 404
    )
    another_login = client.post(
        "/api/v1/auth/login", json={"email": "alice@example.com", "password": PASSWORD}
    ).json()["access_token"]
    mismatched = {**unlocked, "Authorization": "Bearer " + another_login}
    assert (
        client.get(
            f"{BASE}/notebooks/{book['id']}/{item}", headers=mismatched
        ).status_code
        == 403
    )
    client.post("/api/v1/auth/logout", headers=headers)
    assert (
        client.get(
            f"{BASE}/notebooks/{book['id']}/{item}", headers=unlocked
        ).status_code
        == 401
    )


def test_private_revision_conflict_preserves_existing_data(client):
    _, unlocked, book = ready(client)
    item = protect(client, unlocked, book)
    url = f"{BASE}/notebooks/{book['id']}/{item}"
    original = client.get(url, headers=unlocked).json()
    snapshot = original["snapshot"]
    snapshot["contents"][0]["text"] = "Updated privately"
    assert (
        client.put(
            url, headers=unlocked, json={"revision": 1, "snapshot": snapshot}
        ).status_code
        == 200
    )
    assert (
        client.put(
            url, headers=unlocked, json={"revision": 1, "snapshot": snapshot}
        ).status_code
        == 409
    )
    assert client.get(url, headers=unlocked).json()["revision"] == 2
    assert (
        client.post(
            url + "/restore", headers=unlocked, json={"revision": 2, "item_revision": 1}
        ).status_code
        == 409
    )


def test_privacy_reset_preserves_data_and_login_but_invalidates_grants(client):
    headers, unlocked, book = ready(client)
    item = protect(client, unlocked, book)
    assert client.post(BASE + "/reset-request", headers=headers).status_code == 200
    with client.app.state.session_factory() as session:
        record = session.scalar(
            select(AccountToken).where(AccountToken.purpose == "private")
        )
        raw = link_token(record, client.app.state.settings)
    assert (
        client.post(
            BASE + "/reset", json={"token": raw, "password": "Next123"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            BASE + "/reset", json={"token": raw, "password": "Other123"}
        ).status_code
        == 400
    )
    url = f"{BASE}/notebooks/{book['id']}/{item}"
    assert client.get(url, headers=unlocked).status_code == 403
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    token = client.post(
        BASE + "/unlock", headers=headers, json={"password": "Next123"}
    ).json()["token"]
    assert (
        client.get(url, headers={**headers, "X-Privacy-Token": token}).status_code
        == 200
    )


def test_expired_grants_and_wrong_passwords_are_denied(client):
    headers, unlocked, book = ready(client)
    item = protect(client, unlocked, book)
    claims = jwt.decode(
        unlocked["X-Privacy-Token"], options={"verify_signature": False}
    )
    claims["iat"] = datetime.now(UTC) - timedelta(minutes=10)
    claims["exp"] = datetime.now(UTC) - timedelta(seconds=1)
    expired = jwt.encode(
        claims, client.app.state.settings.jwt_secret, algorithm="HS256"
    )
    assert (
        client.get(
            f"{BASE}/notebooks/{book['id']}/{item}",
            headers={**headers, "X-Privacy-Token": expired},
        ).status_code
        == 403
    )
    assert (
        client.post(
            BASE + "/unlock", headers=headers, json={"password": "Wrong123"}
        ).status_code
        == 403
    )


def test_protect_stale_revision_does_not_move_any_data(client):
    headers, unlocked, book = ready(client)
    result = client.post(
        f"{BASE}/notebooks/{book['id']}",
        headers=unlocked,
        json={"kind": "section", "root_id": "root", "revision": 9},
    )
    assert result.status_code == 409
    assert (
        client.get(f"/api/v1/notebooks/{book['id']}", headers=headers).json()[
            "snapshot"
        ]
        == SNAPSHOT
    )


def test_privacy_password_attempts_are_rate_limited(client):
    headers, _, _ = ready(client)
    for _ in range(5):
        assert (
            client.post(
                BASE + "/unlock", headers=headers, json={"password": "Wrong123"}
            ).status_code
            == 403
        )
    response = client.post(
        BASE + "/unlock", headers=headers, json={"password": "Private123"}
    )
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"


def test_private_reset_rejects_expired_link_without_changing_password(client):
    headers, _, _ = ready(client)
    client.post(BASE + "/reset-request", headers=headers)
    with client.app.state.session_factory.begin() as session:
        record = session.scalar(
            select(AccountToken).where(AccountToken.purpose == "private")
        )
        raw = link_token(record, client.app.state.settings)
        record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    assert (
        client.post(
            BASE + "/reset", json={"token": raw, "password": "New123"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            BASE + "/unlock", headers=headers, json={"password": "Private123"}
        ).status_code
        == 200
    )


def test_privacy_downgrade_refuses_to_discard_data(client, migration_config):
    from alembic import command

    headers, unlocked, book = ready(client)
    item = protect(client, unlocked, book)
    with pytest.raises(RuntimeError, match="Refusing"):
        command.downgrade(migration_config, "20261111_03")
    command.upgrade(migration_config, "head")
    assert (
        client.get(
            f"{BASE}/notebooks/{book['id']}/{item}", headers=unlocked
        ).status_code
        == 200
    )
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200


def test_private_delete_requires_ownership_unlock_and_current_revision(client):
    headers, unlocked, book = ready(client)
    item = protect(client, unlocked, book)
    url = f"{BASE}/notebooks/{book['id']}/{item}"
    assert client.delete(url + "?revision=1", headers=headers).status_code == 403
    assert client.delete(url + "?revision=9", headers=unlocked).status_code == 409
    assert client.get(url, headers=unlocked).status_code == 200
    assert client.delete(url + "?revision=1", headers=unlocked).status_code == 200
    assert client.get(url, headers=unlocked).status_code == 404


def test_privacy_changes_do_not_invalidate_account_recovery_links(client):
    headers, _, _ = ready(client)
    assert (
        client.post(
            "/api/v1/auth/password/reset-request", json={"email": "alice@example.com"}
        ).status_code
        == 202
    )
    with client.app.state.session_factory() as session:
        record = session.scalar(
            select(AccountToken).where(AccountToken.purpose == "reset")
        )
        raw = link_token(record, client.app.state.settings)
    assert (
        client.post(
            BASE + "/password",
            headers=headers,
            json={"current_password": "Private123", "password": "Changed123"},
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/password/reset", json={"token": raw, "password": "Account456"}
        ).status_code
        == 200
    )
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "Account456"},
    ).json()["access_token"]
    assert (
        client.post(
            BASE + "/unlock",
            headers={"Authorization": "Bearer " + new_login},
            json={"password": "Changed123"},
        ).status_code
        == 200
    )


@pytest.mark.parametrize("kind", ["section", "content"])
def test_create_private_never_enters_public_snapshot(client, kind):
    headers, unlocked, book = ready(client)
    snapshot = {
        "schemaVersion": 1,
        "sections": [
            {
                "id": "new" if kind == "section" else "root",
                "parentId": None,
                "title": "Direct secret",
                "emoji": "",
                "color": "#a7bcec",
            }
        ],
        "contents": [],
        "reminders": [],
    }
    if kind == "content":
        snapshot["contents"] = [
            {
                "id": "new",
                "sectionId": "root",
                "kind": "note",
                "title": "Direct secret",
                "text": "Never public",
            }
        ]
    payload = {
        "kind": kind,
        "root_id": "new",
        "parent_id": None if kind == "section" else "root",
        "revision": book["revision"],
        "snapshot": snapshot,
    }
    url = f"{BASE}/notebooks/{book['id']}"
    assert (
        client.post(url + "/create", headers=headers, json=payload).status_code == 403
    )
    response = client.post(url + "/create", headers=unlocked, json=payload)
    assert response.status_code == 200, response.text
    public = client.get(f"/api/v1/notebooks/{book['id']}", headers=headers).json()
    assert public["snapshot"] == book["snapshot"]
    assert public["revision"] == book["revision"] + 1
    assert (
        client.post(url + "/create", headers=unlocked, json=payload).status_code == 409
    )
    private = client.get(url + "/" + response.json()["id"], headers=unlocked).json()
    assert "Direct secret" in str(private)


def test_protect_applies_section_changes_atomically_and_restores_position(client):
    headers, unlocked, book = ready(client)
    source = book["snapshot"]
    source["sections"].insert(
        0,
        {
            "id": "before",
            "parentId": None,
            "title": "Before",
            "emoji": "",
            "color": "#a7bcec",
        },
    )
    response = client.put(
        f"/api/v1/notebooks/{book['id']}",
        headers=headers,
        json={"revision": book["revision"], "snapshot": source},
    )
    assert response.status_code == 200
    book = response.json()
    changed = {
        **next(s for s in source["sections"] if s["id"] == "root"),
        "title": "Changed privately",
    }
    url = f"{BASE}/notebooks/{book['id']}"
    response = client.post(
        url,
        headers=unlocked,
        json={
            "kind": "section",
            "root_id": "root",
            "revision": book["revision"],
            "section": changed,
        },
    )
    assert response.status_code == 200, response.text
    item = response.json()["id"]
    metadata = client.get(url, headers=headers).json()[0]
    assert metadata["position"] == 1
    assert "title" not in metadata
    snapshot = client.get(url + "/" + item, headers=unlocked).json()
    assert snapshot["snapshot"]["sections"][0]["title"] == "Changed privately"
    public = client.get(f"/api/v1/notebooks/{book['id']}", headers=headers).json()
    assert (
        client.post(
            url + "/" + item + "/restore",
            headers=unlocked,
            json={
                "revision": public["revision"],
                "item_revision": snapshot["revision"],
            },
        ).status_code
        == 200
    )
    restored = client.get(f"/api/v1/notebooks/{book['id']}", headers=headers).json()[
        "snapshot"
    ]
    assert [s["id"] for s in restored["sections"] if s["parentId"] is None] == [
        "before",
        "root",
    ]


def test_successful_unlocks_do_not_lock_out_normal_navigation(client):
    headers, _, _ = ready(client)
    for _ in range(8):
        assert (
            client.post(
                BASE + "/unlock", headers=headers, json={"password": "Private123"}
            ).status_code
            == 200
        )


def test_position_upgrade_preserves_already_private_data(client, migration_config):
    from alembic import command

    headers, unlocked, book = ready(client)
    item = protect(client, unlocked, book)
    url = f"{BASE}/notebooks/{book['id']}"
    before = client.get(url + "/" + item, headers=unlocked).json()
    command.downgrade(migration_config, "20261112_04")
    command.upgrade(migration_config, "head")
    assert client.get(url + "/" + item, headers=unlocked).json() == before
    assert client.get(url, headers=headers).json()[0]["position"] == 0
    assert (
        client.post(
            BASE + "/unlock", headers=headers, json={"password": "Private123"}
        ).status_code
        == 200
    )
