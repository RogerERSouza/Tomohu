from datetime import UTC, datetime, timedelta
from hashlib import sha256
from hmac import compare_digest
from secrets import token_urlsafe

from fastapi import HTTPException

from app.models.browser_session import BrowserRenewal
from app.repositories.account import AccountRepository
from app.repositories.browser_session import BrowserSessionRepository
from app.schemas.notebook import NotebookSnapshot
from app.services.account import AccountService, utc
from app.services.notebook import NotebookService

LIFETIME = 14 * 24 * 60 * 60


class BrowserSessionService:
    def issue(self, session, user, settings):
        active = AccountService().create_session(session, user, settings)
        active.expires_at = datetime.now(UTC) + timedelta(seconds=LIFETIME)
        secret = token_urlsafe(48)
        session.add(
            BrowserRenewal(
                session_id=active.id,
                digest=sha256(secret.encode()).hexdigest(),
                rotated_at=datetime.now(UTC),
            )
        )
        session.flush()
        return active, f"{active.id}.{secret}"

    def authenticate(self, session, raw):
        invalid = HTTPException(401, "Browser session unavailable")
        if not raw or len(raw) > 200 or raw.count(".") != 1:
            raise invalid
        session_id, secret = raw.split(".")
        repository = BrowserSessionRepository()
        active = repository.get_session(session, session_id)
        if active is None:
            raise invalid
        user = AccountRepository().lock_user(session, active.user_id)
        active, renewal = repository.lock_records(session, session_id)
        if (
            not user
            or not user.is_active
            or not active
            or active.revoked_at
            or utc(active.expires_at) <= datetime.now(UTC)
            or not renewal
        ):
            raise invalid
        digest = sha256(secret.encode()).hexdigest()
        if not compare_digest(renewal.digest, digest):
            # A concurrent tab may have just rotated the shared cookie. Never
            # accept an old credential or clear a newer cookie from this response.
            if (
                renewal.previous_digest
                and compare_digest(renewal.previous_digest, digest)
                and datetime.now(UTC) - utc(renewal.rotated_at) < timedelta(seconds=10)
            ):
                raise HTTPException(409, "Browser session rotated; retry once")
            raise invalid
        return user, active, renewal

    def renew(self, session, raw):
        user, active, renewal = self.authenticate(session, raw)
        secret = token_urlsafe(48)
        renewal.previous_digest = renewal.digest
        renewal.digest = sha256(secret.encode()).hexdigest()
        renewal.rotated_at = datetime.now(UTC)
        session.flush()
        return user, active, f"{active.id}.{secret}"

    def bootstrap(self, session, user):
        locked = AccountRepository().lock_user(session, user.id)
        if locked is None or not locked.is_active:
            raise HTTPException(401, "Account unavailable")
        service = NotebookService()
        owned = service.list_owned(session, user.id)
        return (
            owned[0]
            if owned
            else service.create(
                session,
                NotebookSnapshot(
                    schemaVersion=1, sections=[], contents=[], reminders=[]
                ),
                user.id,
            )
        )
