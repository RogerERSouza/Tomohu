from datetime import UTC, datetime, timedelta
from hashlib import sha256
from hmac import new as hmac_new
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import password_hash
from app.models.account import AccountToken, AuthSession
from app.models.user import User
from app.repositories.account import AccountRepository


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def link_token(record: AccountToken, settings: Settings) -> str:
    secret = hmac_new(
        settings.jwt_secret.encode(),
        f"account:{record.purpose}:{record.id}".encode(),
        "sha256",
    ).hexdigest()
    return f"{record.id}.{secret}"


class InvalidAccountAction(Exception):
    pass


class AccountService:
    def __init__(self) -> None:
        self.repository = AccountRepository()

    def create_session(
        self, session: Session, user: User, settings: Settings
    ) -> AuthSession:
        # Serialize with password changes/resets, and reject stale credentials.
        original_hash = user.password_hash
        locked = self.repository.lock_user(session, user.id)
        if (
            locked is None
            or locked.password_hash != original_hash
            or not locked.is_active
        ):
            raise InvalidAccountAction()
        now = datetime.now(UTC)
        record = AuthSession(
            id=str(uuid4()),
            user_id=user.id,
            created_at=now,
            expires_at=now + timedelta(minutes=settings.access_token_minutes),
        )
        session.add(record)
        session.flush()
        return record

    def valid_session(self, session: Session, user_id: str, session_id: str) -> bool:
        record = session.get(AuthSession, session_id)
        return bool(
            record
            and record.user_id == user_id
            and record.revoked_at is None
            and utc(record.expires_at) > datetime.now(UTC)
        )

    def issue(
        self, session: Session, user: User, purpose: str, settings: Settings
    ) -> None:
        user = self.repository.lock_user(session, user.id)
        if (
            user is None
            or not user.is_active
            or (purpose == "verify" and user.email_verified)
        ):
            return
        now = datetime.now(UTC)
        self.repository.invalidate_tokens(session, user.id, purpose, now)
        record = AccountToken(
            id=str(uuid4()),
            user_id=user.id,
            purpose=purpose,
            credential_version=user.credential_version,
            created_at=now,
            expires_at=now + timedelta(minutes=30),
            next_attempt_at=now,
            attempts=0,
            digest="",
        )
        record.digest = sha256(link_token(record, settings).encode()).hexdigest()
        session.add(record)
        session.flush()

    def confirm(
        self, session: Session, raw: str, purpose: str, password: str | None = None
    ) -> None:
        try:
            token_id = str(UUID(raw.split(".")[0]))
        except (ValueError, AttributeError):
            raise InvalidAccountAction() from None
        record = session.get(AccountToken, token_id)
        if record is None:
            raise InvalidAccountAction()
        user = self.repository.lock_user(session, record.user_id)
        now = datetime.now(UTC)
        if (
            user is None
            or not user.is_active
            or not self.repository.consume(
                session,
                token_id,
                sha256(raw.encode()).hexdigest(),
                purpose,
                user.credential_version,
                now,
            )
        ):
            raise InvalidAccountAction()
        if purpose == "verify":
            user.email_verified = True
        else:
            if password is None:
                raise InvalidAccountAction()
            user.password_hash = password_hash.hash(password)
            user.credential_version += 1
            self.repository.revoke_all(session, user.id, now)

    def change_password(
        self, session: Session, user: User, current: str, password: str
    ) -> None:
        user = self.repository.lock_user(session, user.id)
        if (
            user is None
            or not user.is_active
            or not password_hash.verify(current, user.password_hash)
        ):
            raise InvalidAccountAction()
        user.password_hash = password_hash.hash(password)
        user.credential_version += 1
        self.repository.revoke_all(session, user.id, datetime.now(UTC))

    def revoke(self, session: Session, user_id: str, session_id: str) -> bool:
        record = session.get(AuthSession, session_id)
        if record is None or record.user_id != user_id:
            return False
        record.revoked_at = datetime.now(UTC)
        return True
