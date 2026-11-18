from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import AuthSession
from app.models.browser_session import BrowserRenewal


class BrowserSessionRepository:
    def get_session(self, session: Session, session_id: str) -> AuthSession | None:
        return session.get(AuthSession, session_id)

    def lock_records(
        self, session: Session, session_id: str
    ) -> tuple[AuthSession | None, BrowserRenewal | None]:
        active = session.scalar(
            select(AuthSession)
            .where(AuthSession.id == session_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        renewal = session.scalar(
            select(BrowserRenewal)
            .where(BrowserRenewal.session_id == session_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return active, renewal
