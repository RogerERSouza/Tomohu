from collections import deque
from threading import Lock
from time import monotonic


class RateLimitExceeded(Exception):
    pass


class AuthRateLimiter:
    """Bounded, per-process abuse protection; production also needs an edge limit."""

    def __init__(self) -> None:
        self._attempts: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str, limit: int, window: int = 60) -> None:
        now = monotonic()
        with self._lock:
            expired = [
                k
                for k, values in self._attempts.items()
                if not values or values[-1] <= now - window
            ]
            for old in expired:
                del self._attempts[old]
            if key not in self._attempts and len(self._attempts) >= 10_000:
                raise RateLimitExceeded()
            attempts = self._attempts.setdefault(key, deque())
            while attempts and attempts[0] <= now - window:
                attempts.popleft()
            if len(attempts) >= limit:
                raise RateLimitExceeded()
            attempts.append(now)

    def clear(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)
