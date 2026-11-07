from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class NotebookRecord(Base):
    """A complete Tomohu notebook, ready to gain an owner after login exists."""

    __tablename__ = "notebooks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    schema_version: Mapped[int] = mapped_column(SmallInteger)
    snapshot: Mapped[dict[str, object]] = mapped_column(
        JSONB().with_variant(JSON, "sqlite")
    )
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __mapper_args__ = {"version_id_col": revision}
