import pytest

from app.core.rate_limit import AuthRateLimiter, RateLimitExceeded


def test_limits_expire_and_keys_are_independent(monkeypatch):
    monkeypatch.setattr("app.core.rate_limit.monotonic", lambda: 0.0)
    limiter = AuthRateLimiter()
    limiter.check("one", 1)
    limiter.check("two", 1)
    with pytest.raises(RateLimitExceeded):
        limiter.check("one", 1)
    monkeypatch.setattr("app.core.rate_limit.monotonic", lambda: 61.0)
    limiter.check("one", 1)
