from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import DUMMY_HASH, password_hash
from app.models.user import User
from app.repositories.user import UserRepository


class EmailUnavailable(Exception):
    pass


class InvalidCredentials(Exception):
    pass


class AuthService:
    def __init__(self, repository: UserRepository | None = None) -> None:
        self.repository = repository or UserRepository()

    def register(self, session: Session, email: str, password: str) -> User:
        encoded = password_hash.hash(password)
        if self.repository.get_by_email(session, email) is not None:
            raise EmailUnavailable()
        user = User(id=str(uuid4()), email=email, password_hash=encoded, is_active=True)
        try:
            # Database uniqueness also protects simultaneous registration.
            with session.begin_nested():
                return self.repository.add(session, user)
        except IntegrityError:
            if self.repository.get_by_email(session, email) is not None:
                raise EmailUnavailable() from None
            raise

    def authenticate(self, session: Session, email: str, password: str) -> User:
        user = self.repository.get_by_email(session, email)
        valid = password_hash.verify(
            password, user.password_hash if user else DUMMY_HASH
        )
        if not user or not valid or not user.is_active:
            raise InvalidCredentials()
        return user
