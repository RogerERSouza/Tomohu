import pytest
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.core.database import create_engine_for_url


def test_upgrade_preserves_legacy_data_and_empty_downgrade_is_reversible(
    database_url, migration_config
):
    command.upgrade(migration_config, "20261107_01")
    engine = create_engine_for_url(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO notebooks (id, schema_version, snapshot, revision) "
                "VALUES ('legacy', 1, :snapshot, 3)"
            ),
            {
                "snapshot": '{"schemaVersion":1,"sections":[],'
                '"contents":[],"reminders":[]}'
            },
        )
    command.upgrade(migration_config, "head")
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT id, revision, owner_id, snapshot FROM notebooks")
        ).one()
        assert tuple(row[:3]) == ("legacy", 3, None)
        import json

        snapshot = json.loads(row[3]) if isinstance(row[3], str) else row[3]
        assert snapshot == {
            "schemaVersion": 1,
            "sections": [],
            "contents": [],
            "reminders": [],
        }
    assert {index["name"] for index in inspect(engine).get_indexes("notebooks")} >= {
        "ix_notebooks_owner_id"
    }
    assert inspect(engine).get_foreign_keys("notebooks")[0]["referred_table"] == "users"
    command.check(migration_config)
    command.downgrade(migration_config, "20261107_01")
    with engine.connect() as connection:
        assert (
            connection.execute(text("SELECT revision FROM notebooks")).scalar_one() == 3
        )
    command.upgrade(migration_config, "head")
    engine.dispose()


def test_downgrade_refuses_to_destroy_accounts(database_url, migration_config):
    command.upgrade(migration_config, "head")
    engine = create_engine_for_url(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id,email,password_hash,is_active) "
                "VALUES ('test','test@example.com','hash',true)"
            )
        )
    with pytest.raises(RuntimeError, match="Refusing"):
        command.downgrade(migration_config, "20261107_01")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar_one() == 1
    engine.dispose()


def test_database_enforces_unique_normalized_email(database_url, migration_config):
    command.upgrade(migration_config, "head")
    engine = create_engine_for_url(database_url)
    statement = text(
        "INSERT INTO users (id,email,password_hash,is_active) "
        "VALUES (:id,:email,'hash',true)"
    )
    with engine.begin() as connection:
        connection.execute(statement, {"id": "one", "email": "alice@example.com"})
    for identity, email in (
        ("two", "alice@example.com"),
        ("three", "ALICE@example.com"),
    ):
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(statement, {"id": identity, "email": email})
    engine.dispose()


def test_notebook_ownership_has_a_real_foreign_key(database_url, migration_config):
    command.upgrade(migration_config, "head")
    engine = create_engine_for_url(database_url)
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO notebooks "
                "(id, owner_id, schema_version, snapshot, revision) "
                "VALUES ('orphan', 'missing-user', 1, :snapshot, 1)"
            ),
            {"snapshot": "{}"},
        )
    engine.dispose()


def test_account_lifecycle_upgrade_preserves_existing_credentials(
    database_url, migration_config
):
    command.upgrade(migration_config, "20261107_02")
    engine = create_engine_for_url(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (id,email,password_hash,is_active) "
                "VALUES ('existing','existing@example.com','unchanged-hash',true)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO notebooks (id,owner_id,schema_version,snapshot,revision) "
                "VALUES ('owned','existing',1,:snapshot,7)"
            ),
            {
                "snapshot": (
                    '{"schemaVersion":1,"sections":[],"contents":[],"reminders":[]}'
                )
            },
        )
    command.upgrade(migration_config, "head")
    with engine.connect() as connection:
        user = connection.execute(
            text(
                "SELECT password_hash,email_verified,credential_version "
                "FROM users WHERE id='existing'"
            )
        ).one()
        assert tuple(user) == ("unchanged-hash", False, 0)
        assert connection.execute(
            text("SELECT owner_id,revision FROM notebooks WHERE id='owned'")
        ).one() == ("existing", 7)
    command.check(migration_config)
    engine.dispose()
