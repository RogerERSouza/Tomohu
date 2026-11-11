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


@pytest.mark.parametrize("fixture", FIXTURES["timestampVariants"])
def test_python_timestamp_variants_round_trip_as_browser_snapshots(client, fixture):
    headers = register_and_login(client)
    original = json.loads(json.dumps(FIXTURES["legacyCounter"]["canonical"]))
    original["contents"][0]["entries"][0]["createdAt"] = fixture["input"]
    canonical = json.loads(json.dumps(original))
    canonical["contents"][0]["entries"][0]["createdAt"] = fixture["canonical"]
    created = client.post(
        "/api/v1/notebooks", headers=headers, json={"snapshot": original}
    )
    assert created.status_code == 201, created.text
    assert created.json()["snapshot"] == canonical
    book = created.json()["id"]
    # Existing rows must become readable without rewriting their raw history.
    with client.app.state.engine.begin() as connection:
        connection.execute(
            update(NotebookRecord)
            .where(NotebookRecord.id == book)
            .values(snapshot=original)
        )
    loaded = client.get(f"/api/v1/notebooks/{book}", headers=headers)
    assert loaded.status_code == 200
    assert loaded.json()["snapshot"] == canonical
    with client.app.state.engine.connect() as connection:
        raw = connection.execute(
            select(NotebookRecord.snapshot).where(NotebookRecord.id == book)
        ).scalar_one()
    assert raw == original


@pytest.mark.parametrize(
    "stamp", ["0001-01-01T00:00:00+00:00:01", "9999-12-31T23:59:59-00:00:01"]
)
def test_out_of_range_timestamp_normalization_is_a_validation_error(client, stamp):
    headers = register_and_login(client)
    original = json.loads(json.dumps(FIXTURES["legacyCounter"]["canonical"]))
    original["contents"][0]["entries"][0]["createdAt"] = stamp
    response = client.post(
        "/api/v1/notebooks", headers=headers, json={"snapshot": original}
    )
    assert response.status_code == 422
