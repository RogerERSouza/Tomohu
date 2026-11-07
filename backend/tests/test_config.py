from app.core.config import DEFAULT_CORS_ORIGINS, parse_origins


def test_parse_origins_uses_safe_defaults() -> None:
    assert parse_origins(None) == DEFAULT_CORS_ORIGINS
    assert parse_origins("  ") == DEFAULT_CORS_ORIGINS


def test_parse_origins_trims_empty_values() -> None:
    assert parse_origins("https://app.tomohu.test, , https://admin.tomohu.test ") == (
        "https://app.tomohu.test",
        "https://admin.tomohu.test",
    )
