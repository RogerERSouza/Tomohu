from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.account import AccountToken, AuthSession
from app.models.user import User


class AccountRepository:
    def lock_user(self, session: Session, user_id: str) -> User | None:
        return session.scalar(
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    def revoke_all(self, session: Session, user_id: str, now: datetime) -> None:
        session.execute(
            update(AuthSession)
            .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )

    def sessions(
        self, session: Session, user_id: str, now: datetime
    ) -> list[AuthSession]:
        return list(
            session.scalars(
                select(AuthSession)
                .where(
                    AuthSession.user_id == user_id,
                    AuthSession.revoked_at.is_(None),
                    AuthSession.expires_at > now,
                )
                .order_by(AuthSession.created_at.desc())
            )
        )

    def invalidate_tokens(
        self, session: Session, user_id: str, purpose: str, now: datetime
    ) -> None:
        session.execute(
            update(AccountToken)
            .where(
                AccountToken.user_id == user_id,
                AccountToken.purpose == purpose,
                AccountToken.used_at.is_(None),
            )
            .values(used_at=now)
            .execution_options(synchronize_session=False)
        )

    def consume(
        self,
        session: Session,
        token_id: str,
        digest: str,
        purpose: str,
        version: int,
        now: datetime,
    ) -> bool:
        result = session.execute(
            update(AccountToken)
            .where(
                AccountToken.id == token_id,
                AccountToken.digest == digest,
                AccountToken.purpose == purpose,
                AccountToken.credential_version == version,
                AccountToken.used_at.is_(None),
                AccountToken.expires_at > now,
            )
            .values(used_at=now)
            .execution_options(synchronize_session=False)
        )
        return result.rowcount == 1
