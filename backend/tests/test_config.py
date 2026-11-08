import pytest

from app.core.config import DEFAULT_CORS_ORIGINS, Settings, parse_origins


def test_parse_origins():
    assert parse_origins(None) == DEFAULT_CORS_ORIGINS
    assert parse_origins("  ") == DEFAULT_CORS_ORIGINS
    assert parse_origins("https://a.example.com, , https://b.example.com ") == (
        "https://a.example.com",
        "https://b.example.com",
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"jwt_secret": ""},
        {"jwt_secret": "short"},
        {"cors_origins": ("*",)},
        {"cors_origins": ("http://example.com",)},
        {"cors_origins": ()},
        {"cors_origins": ("https://example.com/path",)},
        {"database_url": "sqlite://"},
        {"access_token_minutes": 31},
    ],
)
def test_unsafe_production_settings_fail_closed(overrides):
    values = dict(
        app_name="Test",
        environment="production",
        cors_origins=("https://example.com",),
        jwt_secret="test-secret-" * 4,
        database_url="postgresql+psycopg://localhost/test",
    )
    values.update(overrides)
    with pytest.raises(ValueError):
        Settings(**values)


def test_settings_hide_secret_and_local_instances_have_independent_keys():
    first = Settings("Test", "test", ())
    second = Settings("Test", "test", ())
    assert first.jwt_secret != second.jwt_secret
    assert first.jwt_secret not in repr(first)
    with pytest.raises(ValueError):
        Settings("Test", "typo", ())
