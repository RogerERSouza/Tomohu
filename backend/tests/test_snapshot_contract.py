"""Shared frontend/API fixtures cover persisted response compatibility."""

import json
from pathlib import Path

import pytest
from sqlalchemy import select, update

from app.models.notebook import NotebookRecord
from tests.conftest import register_and_login

FIXTURES = json.loads(
    (
        Path(__file__).resolve().parents[2]
        / "tests/fixtures/accountSnapshotContract.json"
    ).read_text()
)


@pytest.mark.parametrize("case", ["optionalNulls", "legacyCounter"])
def test_shared_snapshot_contract_round_trip(client, case):
    headers = register_and_login(client)
    fixture = FIXTURES[case]
    payload = fixture.get("request", fixture["canonical"])
    created = client.post(
        "/api/v1/notebooks", headers=headers, json={"snapshot": payload}
    )
    assert created.status_code == 201, created.text
    assert created.json()["snapshot"] == fixture["canonical"]
    book = created.json()["id"]
    loaded = client.get(f"/api/v1/notebooks/{book}", headers=headers)
    assert loaded.json()["snapshot"] == fixture["canonical"]
    saved = client.put(
        f"/api/v1/notebooks/{book}",
        headers=headers,
        json={"revision": 1, "snapshot": payload},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["snapshot"] == fixture["canonical"]
    assert saved.json()["revision"] == 2


def test_preexisting_nullable_snapshot_is_readable_without_rewriting_database(client):
    headers = register_and_login(client)
    canonical = FIXTURES["optionalNulls"]["canonical"]
    created = client.post(
        "/api/v1/notebooks", headers=headers, json={"snapshot": canonical}
    ).json()
    original = FIXTURES["optionalNulls"]["request"]
    with client.app.state.engine.begin() as connection:
        connection.execute(
            update(NotebookRecord)
            .where(NotebookRecord.id == created["id"])
            .values(snapshot=original)
        )
    response = client.get(f"/api/v1/notebooks/{created['id']}", headers=headers)
    assert response.status_code == 200
    assert response.json()["snapshot"] == canonical
    with client.app.state.engine.connect() as connection:
        stored = connection.execute(
            select(NotebookRecord.snapshot).where(NotebookRecord.id == created["id"])
        ).scalar_one()
    assert (json.loads(stored) if isinstance(stored, str) else stored) == original
