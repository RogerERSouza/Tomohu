"""Canonicalize Python ISO variants without changing supported browser wall times."""

import re
from datetime import UTC, date, datetime

BROWSER_ISO = re.compile(
    r"^\d{4}-\d{2}-\d{2}(?:[T ](?:[01]\d|2[0-3]):[0-5]\d"
    r"(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$"
)


def browser_timestamp(value: str) -> str:
    parsed = datetime.fromisoformat(value)
    if BROWSER_ISO.fullmatch(value):
        return value
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        try:
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(UTC)
            return parsed.isoformat().replace("+00:00", "Z")
        except OverflowError as error:
            raise ValueError("Timestamp is outside the supported calendar") from error
