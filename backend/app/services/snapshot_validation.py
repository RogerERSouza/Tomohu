"""Snapshot integrity shared by create and replace use cases."""

import math
import re
from datetime import date, datetime

from app.schemas.notebook import NotebookSnapshot

CLOCK = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def calendar(value: str) -> bool:
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def timestamp(value: str) -> bool:
    try:
        datetime.fromisoformat(value)
        return True
    except ValueError:
        return False


def validate_snapshot_values(snapshot: NotebookSnapshot) -> None:
    for items in (snapshot.sections, snapshot.contents, snapshot.reminders):
        if any(not item.id.strip() for item in items):
            raise ValueError("Notebook IDs cannot be empty")
    for content in snapshot.contents:
        items = (
            content.items
            if content.kind in {"checklist", "tutorial"}
            else content.entries
        )
        if items is not None:
            identifiers = [item.id for item in items]
            if any(not identifier.strip() for identifier in identifiers) or len(
                identifiers
            ) != len(set(identifiers)):
                raise ValueError("Nested item IDs must be nonempty and unique")
        if content.kind == "counter":
            total = 0.0
            for entry in content.entries or []:
                if not math.isfinite(entry.delta) or not timestamp(entry.createdAt):
                    raise ValueError("Invalid counter entry")
                total += entry.delta
            if not math.isfinite(total) or total < 0:
                raise ValueError("Counter totals must be finite and nonnegative")
    for reminder in snapshot.reminders:
        day = reminder.date[:10]
        if (
            not calendar(day)
            or (reminder.schedule and day != reminder.date)
            or (not reminder.schedule and not timestamp(reminder.date))
        ):
            raise ValueError("Invalid reminder date")
        if reminder.endDate is not None and (
            not calendar(reminder.endDate) or reminder.endDate < day
        ):
            raise ValueError("Invalid reminder end date")
        times = [
            value
            for value in (reminder.startTime, reminder.endTime)
            if value is not None
        ]
        times.extend(reminder.repeatTimes or [])
        if any(not CLOCK.fullmatch(value) for value in times) or len(
            reminder.repeatTimes or []
        ) != len(set(reminder.repeatTimes or [])):
            raise ValueError("Invalid reminder times")
        if reminder.schedule == "time-range" and not reminder.repeatTimes:
            if not reminder.startTime:
                raise ValueError("Timed reminders require a start time")
            if (
                reminder.endTime is not None
                and f"{reminder.endDate or day}T{reminder.endTime}"
                <= f"{day}T{reminder.startTime}"
            ):
                raise ValueError("Reminder end must follow its start")
