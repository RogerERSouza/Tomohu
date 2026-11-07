from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app
from app.models.base import Base


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def notebook_payload() -> dict[str, object]:
    return {
        "snapshot": {
            "schemaVersion": 1,
            "sections": [
                {
                    "id": "section-1",
                    "parentId": None,
                    "title": "Estudos",
                    "emoji": "📚",
                    "color": "#a7bcec",
                    "favorite": True,
                    "tags": ["escola"],
                }
            ],
            "contents": [
                {
                    "id": "content-1",
                    "sectionId": "section-1",
                    "title": "Plano",
                    "kind": "note",
                    "text": "Revisar FastAPI",
                }
            ],
            "reminders": [],
        }
    }


@pytest.mark.anyio
async def test_notebook_can_be_created_loaded_and_replaced(
    tmp_path: Path, notebook_payload: dict[str, object]
) -> None:
    app = create_app(
        Settings(
            app_name="Tomohu API Test",
            environment="test",
            cors_origins=("http://localhost:5173",),
            database_url=f"sqlite:///{tmp_path / 'tomohu-test.db'}",
        )
    )
    Base.metadata.create_all(app.state.engine)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        created = await client.post("/api/v1/notebooks", json=notebook_payload)
        assert created.status_code == 201
        result = created.json()
        assert result["revision"] == 1
        notebook_id = result["id"]

        loaded = await client.get(f"/api/v1/notebooks/{notebook_id}")
        assert loaded.status_code == 200
        assert loaded.json()["snapshot"] == notebook_payload["snapshot"]

        replacement = {"revision": 1, **notebook_payload}
        updated = await client.put(f"/api/v1/notebooks/{notebook_id}", json=replacement)
        assert updated.status_code == 200
        assert updated.json()["revision"] == 2
        assert updated.headers["etag"] == 'W/"2"'

        conflict = await client.put(
            f"/api/v1/notebooks/{notebook_id}", json=replacement
        )
        assert conflict.status_code == 409


@pytest.mark.anyio
async def test_notebook_rejects_content_without_a_section(
    tmp_path: Path, notebook_payload: dict[str, object]
) -> None:
    snapshot = notebook_payload["snapshot"]
    assert isinstance(snapshot, dict)
    contents = snapshot["contents"]
    assert isinstance(contents, list)
    assert isinstance(contents[0], dict)
    contents[0]["sectionId"] = "missing-section"

    app = create_app(
        Settings(
            app_name="Tomohu API Test",
            environment="test",
            cors_origins=("http://localhost:5173",),
            database_url=f"sqlite:///{tmp_path / 'tomohu-invalid.db'}",
        )
    )
    Base.metadata.create_all(app.state.engine)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/api/v1/notebooks", json=notebook_payload)

    assert response.status_code == 422
    assert (
        response.json()["detail"]
        == "Every content item must belong to an existing section"
    )


@pytest.mark.anyio
async def test_anonymous_notebooks_are_disabled_outside_local_development(
    tmp_path: Path, notebook_payload: dict[str, object]
) -> None:
    app = create_app(
        Settings(
            app_name="Tomohu API Test",
            environment="production",
            cors_origins=("https://tomohu.test",),
            database_url=f"sqlite:///{tmp_path / 'tomohu-production.db'}",
            allow_anonymous_notebooks=False,
        )
    )
    Base.metadata.create_all(app.state.engine)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/api/v1/notebooks", json=notebook_payload)

    assert response.status_code == 403
