import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.core.config import Settings, get_settings
from app.main import create_app

PASSWORD = "a long test password 123!"


@pytest.fixture
def database_url(tmp_path: Path) -> Iterator[str]:
    configured = os.getenv("TOMOHU_TEST_DATABASE_URL")
    if not configured:
        yield f"sqlite:///{tmp_path / 'test.db'}"
        return
    url = make_url(configured)
    if not url.drivername.startswith("postgresql") or not (url.database or "").endswith(
        "_test"
    ):
        raise ValueError(
            "Integration tests require a dedicated PostgreSQL database ending in _test"
        )
    schema = "test_" + uuid4().hex
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    isolated = url.update_query_dict({"options": f"-csearch_path={schema}"})
    try:
        yield isolated.render_as_string(hide_password=False)
    finally:
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


@pytest.fixture
def migration_config(
    database_url: str, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Config]:
    monkeypatch.setenv("TOMOHU_ENVIRONMENT", "test")
    monkeypatch.setenv("TOMOHU_DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parents[1] / "migrations")
    )
    try:
        yield config
    finally:
        get_settings.cache_clear()


@pytest.fixture
def client(database_url: str, migration_config: Config) -> Iterator[TestClient]:
    command.upgrade(migration_config, "head")
    app = create_app(
        Settings(
            app_name="Tomohu Test",
            environment="test",
            cors_origins=("http://localhost:5173",),
            database_url=database_url,
            jwt_secret="test-secret-" * 4,
        )
    )
    with TestClient(app) as active:
        yield active
    app.state.engine.dispose()


def register_and_login(
    client: TestClient, email: str = "alice@example.com"
) -> dict[str, str]:
    payload = {"email": email, "password": PASSWORD}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["access_token"]}
