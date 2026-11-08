from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def get_by_email(self, session: Session, email: str) -> User | None:
        return session.scalar(select(User).where(User.email == email))

    def add(self, session: Session, user: User) -> User:
        session.add(user)
        session.flush()
        return user
