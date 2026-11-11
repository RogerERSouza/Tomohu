import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.conftest import register_and_login


@pytest.fixture
def notebook_payload() -> dict[str, object]:
    return {
        "snapshot": {
            "schemaVersion": 1,
            "sections": [
                {
                    "id": "section-1",
                    "parentId": None,
                    "title": "Studies",
                    "emoji": "📚",
                    "color": "#a7bcec",
                    "favorite": True,
                    "tags": ["school"],
                }
            ],
            "contents": [
                {
                    "id": "content-1",
                    "sectionId": "section-1",
                    "title": "Plan",
                    "kind": "note",
                    "text": "Review FastAPI",
                }
            ],
            "reminders": [],
        }
    }


def test_owner_can_create_load_and_replace(client: TestClient, notebook_payload):
    headers = register_and_login(client)
    created = client.post("/api/v1/notebooks", json=notebook_payload, headers=headers)
    assert created.status_code == 201
    result = created.json()
    assert result["revision"] == 1
    path = f"/api/v1/notebooks/{result['id']}"
    loaded = client.get(path, headers=headers)
    assert loaded.json()["snapshot"] == notebook_payload["snapshot"]
    assert loaded.headers["cache-control"] == "no-store"
    replacement = {"revision": 1, **notebook_payload}
    updated = client.put(path, json=replacement, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["revision"] == 2
    assert updated.headers["etag"] == 'W/"2"'
    conflict = client.put(path, json=replacement, headers=headers)
    assert conflict.status_code == 409
    assert client.get(path, headers=headers).json() == updated.json()


def test_accounts_cannot_read_or_overwrite_each_other(
    client: TestClient, notebook_payload
):
    owner = register_and_login(client)
    other = register_and_login(client, "bob@example.com")
    created = client.post(
        "/api/v1/notebooks", json=notebook_payload, headers=owner
    ).json()
    path = f"/api/v1/notebooks/{created['id']}"
    missing = "/api/v1/notebooks/00000000-0000-0000-0000-000000000000"
    for method, payload in (
        ("GET", None),
        ("PUT", {"revision": 1, **notebook_payload}),
    ):
        forbidden = client.request(method, path, json=payload, headers=other)
        unknown = client.request(method, missing, json=payload, headers=other)
        assert forbidden.status_code == unknown.status_code == 404
        assert forbidden.json() == unknown.json()
    assert client.get(path, headers=owner).json() == created


@pytest.mark.parametrize(
    "method,path,payload",
    [
        (
            "POST",
            "/api/v1/notebooks",
            {
                "snapshot": {
                    "schemaVersion": 1,
                    "sections": [],
                    "contents": [],
                    "reminders": [],
                }
            },
        ),
        ("GET", "/api/v1/notebooks/00000000-0000-0000-0000-000000000000", None),
        (
            "PUT",
            "/api/v1/notebooks/00000000-0000-0000-0000-000000000000",
            {
                "revision": 1,
                "snapshot": {
                    "schemaVersion": 1,
                    "sections": [],
                    "contents": [],
                    "reminders": [],
                },
            },
        ),
    ],
)
def test_all_notebook_routes_require_authentication(client, method, path, payload):
    response = client.request(method, path, json=payload)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_content_must_have_a_section(client, notebook_payload):
    headers = register_and_login(client)
    notebook_payload["snapshot"]["contents"][0]["sectionId"] = "missing"
    assert (
        client.post(
            "/api/v1/notebooks", json=notebook_payload, headers=headers
        ).status_code
        == 422
    )


def test_client_cannot_select_owner(client, notebook_payload):
    headers = register_and_login(client)
    response = client.post(
        "/api/v1/notebooks",
        json={**notebook_payload, "owner_id": "someone"},
        headers=headers,
    )
    assert response.status_code == 422


def test_legacy_anonymous_snapshot_is_not_claimed(client, notebook_payload):
    headers = register_and_login(client)
    with client.app.state.engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO notebooks (id, schema_version, snapshot, revision) "
                "VALUES ('legacy', 1, :snapshot, 1)"
            ),
            {
                "snapshot": '{"schemaVersion":1,"sections":[],'
                '"contents":[],"reminders":[]}'
            },
        )
    response = client.get("/api/v1/notebooks/legacy", headers=headers)
    assert response.status_code == 404
    with client.app.state.engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT count(*) FROM notebooks WHERE owner_id IS NULL")
            ).scalar_one()
            == 1
        )


def test_isolation_survives_new_app_instance(client, database_url):
    from app.core.config import Settings
    from app.main import create_app

    headers = register_and_login(client)
    app = create_app(
        Settings(
            app_name="Restart",
            environment="test",
            cors_origins=(),
            database_url=database_url,
            jwt_secret="test-secret-" * 4,
        )
    )
    with TestClient(app) as restarted:
        assert restarted.get("/api/v1/auth/me", headers=headers).status_code == 200
    app.state.engine.dispose()


def test_concurrent_writers_cannot_silently_overwrite(client, notebook_payload):
    from sqlalchemy import select
    from sqlalchemy.orm import Session

    from app.models.notebook import NotebookRecord
    from app.schemas.notebook import NotebookSnapshot
    from app.services.notebook import NotebookConflict, NotebookService

    headers = register_and_login(client)
    created = client.post(
        "/api/v1/notebooks", json=notebook_payload, headers=headers
    ).json()
    engine = client.app.state.engine
    snapshot = NotebookSnapshot.model_validate(notebook_payload["snapshot"])
    with Session(engine, expire_on_commit=False) as first, Session(engine) as stale:
        first_copy = first.scalar(
            select(NotebookRecord).where(NotebookRecord.id == created["id"])
        )
        stale_copy = stale.scalar(
            select(NotebookRecord).where(NotebookRecord.id == created["id"])
        )
        owner = first_copy.owner_id
        assert stale_copy.revision == first_copy.revision == 1
        NotebookService().replace(first, created["id"], 1, snapshot, owner)
        first.commit()
        with pytest.raises(NotebookConflict):
            NotebookService().replace(stale, created["id"], 1, snapshot, owner)
    assert (
        client.get(f"/api/v1/notebooks/{created['id']}", headers=headers).json()[
            "revision"
        ]
        == 2
    )


def test_discovery_is_owner_scoped_and_requires_authentication(
    client, notebook_payload
):
    assert client.get("/api/v1/notebooks").status_code == 401
    owner = register_and_login(client)
    other = register_and_login(client, "other@example.com")
    assert client.get("/api/v1/notebooks", headers=owner).json() == []
    created = client.post(
        "/api/v1/notebooks", json=notebook_payload, headers=owner
    ).json()
    response = client.get("/api/v1/notebooks", headers=owner)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == [{"id": created["id"], "revision": 1, "title": "Studies"}]
    assert client.get("/api/v1/notebooks", headers=other).json() == []


@pytest.mark.parametrize("kind", ["date", "interval", "counter", "items"])
def test_sync_rejects_invalid_values_without_replacing_snapshot(
    client, notebook_payload, kind
):
    from copy import deepcopy

    headers = register_and_login(client)
    original = client.post(
        "/api/v1/notebooks", json=notebook_payload, headers=headers
    ).json()
    invalid = deepcopy(notebook_payload)
    if kind in {"date", "interval"}:
        invalid["snapshot"]["reminders"] = [
            {
                "id": "r",
                "title": "Event",
                "date": "2030-02-30" if kind == "date" else "2030-05-10",
                "schedule": "time-range",
                "startTime": "09:00",
                "endTime": "08:00",
            }
        ]
    elif kind == "counter":
        invalid["snapshot"]["contents"] = [
            {
                "id": "c",
                "sectionId": "section-1",
                "title": "Count",
                "kind": "counter",
                "entries": [
                    {
                        "id": "e",
                        "delta": -2,
                        "createdAt": "2030-05-10T09:00:00Z",
                        "note": "",
                    }
                ],
            }
        ]
    else:
        invalid["snapshot"]["contents"] = [
            {
                "id": "c",
                "sectionId": "section-1",
                "title": "List",
                "kind": "checklist",
                "items": [
                    {"id": "e", "text": "a", "completed": False},
                    {"id": "e", "text": "b", "completed": False},
                ],
            }
        ]
    path = f"/api/v1/notebooks/{original['id']}"
    assert (
        client.put(path, json={"revision": 1, **invalid}, headers=headers).status_code
        == 422
    )
    assert client.get(path, headers=headers).json() == original


def test_sync_accepts_correction_history_and_valid_legacy_and_overnight_events(
    client, notebook_payload
):
    headers = register_and_login(client)
    notebook_payload["snapshot"]["contents"] = [
        {
            "id": "counter",
            "sectionId": "section-1",
            "title": "Counter",
            "kind": "counter",
            "entries": [
                {
                    "id": "increase",
                    "delta": 2,
                    "createdAt": "2030-05-10T09:00:00Z",
                    "note": "",
                },
                {
                    "id": "correction",
                    "delta": -1,
                    "createdAt": "2030-05-10T09:01",
                    "note": "Correction",
                },
            ],
        }
    ]
    notebook_payload["snapshot"]["reminders"] = [
        {"id": "legacy", "title": "Legacy", "date": "2030-05-10T09:00:00-03:00"},
        {
            "id": "overnight",
            "title": "Overnight",
            "date": "2030-05-10",
            "endDate": "2030-05-11",
            "schedule": "time-range",
            "startTime": "23:30",
            "endTime": "00:30",
        },
    ]
    created = client.post("/api/v1/notebooks", json=notebook_payload, headers=headers)
    assert created.status_code == 201
    assert created.json()["snapshot"] == notebook_payload["snapshot"]
