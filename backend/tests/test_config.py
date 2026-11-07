import pytest

from app.core.config import DEFAULT_CORS_ORIGINS, parse_bool, parse_origins


def test_parse_origins_uses_safe_defaults() -> None:
    assert parse_origins(None) == DEFAULT_CORS_ORIGINS
    assert parse_origins("  ") == DEFAULT_CORS_ORIGINS


def test_parse_origins_trims_empty_values() -> None:
    assert parse_origins("https://app.tomohu.test, , https://admin.tomohu.test ") == (
        "https://app.tomohu.test",
        "https://admin.tomohu.test",
    )


def test_parse_bool_accepts_explicit_values_and_rejects_ambiguity() -> None:
    assert parse_bool("true", default=False) is True
    assert parse_bool("0", default=True) is False
    with pytest.raises(ValueError):
        parse_bool("sometimes", default=False)
