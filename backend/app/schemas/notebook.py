from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SectionSnapshot(StrictModel):
    id: str = Field(min_length=1, max_length=36)
    parentId: str | None = Field(default=None, max_length=36)
    title: str = Field(min_length=1, max_length=160)
    emoji: str = Field(max_length=16)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    favorite: bool = False
    tags: list[str] = Field(default_factory=list, max_length=20)


class ListItemSnapshot(StrictModel):
    id: str = Field(min_length=1, max_length=36)
    text: str = Field(max_length=500)
    completed: bool


class CounterEntrySnapshot(StrictModel):
    id: str = Field(min_length=1, max_length=36)
    delta: float
    createdAt: str = Field(min_length=1, max_length=40)
    note: str = Field(max_length=500)


class ContentSnapshot(StrictModel):
    id: str = Field(min_length=1, max_length=36)
    sectionId: str = Field(min_length=1, max_length=36)
    title: str = Field(min_length=1, max_length=160)
    kind: Literal["note", "checklist", "tutorial", "counter"]
    text: str | None = Field(default=None, max_length=20_000)
    items: list[ListItemSnapshot] | None = Field(default=None, max_length=500)
    entries: list[CounterEntrySnapshot] | None = Field(default=None, max_length=5_000)

    @model_validator(mode="after")
    def validate_payload_for_kind(self) -> "ContentSnapshot":
        if self.kind == "note" and self.text is None:
            raise ValueError("Note content requires text")
        if self.kind == "checklist" and self.items is None:
            raise ValueError("Checklist content requires items")
        if self.kind == "tutorial" and (self.text is None or self.items is None):
            raise ValueError("Tutorial content requires text and items")
        if self.kind == "counter" and self.entries is None:
            raise ValueError("Counter content requires entries")
        return self


class ReminderSnapshot(StrictModel):
    id: str = Field(min_length=1, max_length=36)
    title: str = Field(min_length=1, max_length=160)
    date: str = Field(min_length=10, max_length=40)
    schedule: Literal["all-day", "time-range"] | None = None
    startTime: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    endDate: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    endTime: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    repeatTimes: list[str] | None = Field(default=None, max_length=24)
    duration: Literal["single-day", "multi-day"] | None = None
    countdownFormat: (
        Literal["automatic", "days-hours", "hours-minutes", "minutes-seconds"] | None
    ) = None


class NotebookSnapshot(StrictModel):
    schemaVersion: Literal[1]
    sections: list[SectionSnapshot] = Field(max_length=1_000)
    contents: list[ContentSnapshot] = Field(max_length=5_000)
    reminders: list[ReminderSnapshot] = Field(max_length=5_000)


class NotebookCreate(StrictModel):
    snapshot: NotebookSnapshot


class NotebookReplace(StrictModel):
    revision: int = Field(ge=1)
    snapshot: NotebookSnapshot


class NotebookResponse(StrictModel):
    id: str
    revision: int
    snapshot: NotebookSnapshot
