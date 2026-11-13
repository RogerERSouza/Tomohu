from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PrivateItem(Base):
    __tablename__ = "private_items"
    __table_args__ = (
        CheckConstraint("kind IN ('section', 'content')", name="ck_private_items_kind"),
        CheckConstraint("revision > 0", name="ck_private_items_revision"),
        UniqueConstraint(
            "notebook_id", "kind", "root_id", name="uq_private_items_root"
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    notebook_id: Mapped[str] = mapped_column(
        ForeignKey("notebooks.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(12))
    root_id: Mapped[str] = mapped_column(String(64))
    parent_id: Mapped[str | None] = mapped_column(String(64))
    position: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    revision: Mapped[int] = mapped_column(Integer, default=1)
    snapshot: Mapped[dict] = mapped_column(JSONB().with_variant(JSON, "sqlite"))
    __mapper_args__ = {"version_id_col": revision}
