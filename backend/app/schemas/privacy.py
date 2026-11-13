from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

from app.schemas.auth import validate_new_password
from app.schemas.notebook import NotebookSnapshot, SectionSnapshot


class PasswordInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: SecretStr = Field(min_length=1, max_length=128)


class PasswordSetup(PasswordInput):
    current_password: SecretStr | None = Field(default=None, max_length=128)
    _policy = field_validator("password")(validate_new_password)


class PrivateRoot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["section", "content"]
    root_id: str = Field(min_length=1, max_length=64)
    revision: int = Field(ge=1)


class ProtectInput(PrivateRoot):
    section: SectionSnapshot | None = None
    title: str | None = Field(default=None, max_length=100)


class PrivateCreate(PrivateRoot):
    parent_id: str | None = Field(default=None, max_length=64)
    snapshot: NotebookSnapshot


class RestoreInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    item_revision: int = Field(ge=1)
