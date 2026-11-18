from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BrowserRenewal(Base):
    __tablename__ = "browser_renewals"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("auth_sessions.id"), primary_key=True
    )
    digest: Mapped[str] = mapped_column(String(64))
    previous_digest: Mapped[str | None] = mapped_column(String(64))
    rotated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
