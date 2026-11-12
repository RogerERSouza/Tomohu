from collections.abc import Generator

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import session_scope
from app.core.security import InvalidToken, read_access_claims
from app.models.user import User
from app.services.account import AccountService

bearer = HTTPBearer(auto_error=False)


def get_session(request: Request) -> Generator[Session, None, None]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    yield from session_scope(factory)


def require_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: Session = Depends(get_session, scope="function"),
) -> User:
    unauthorized = HTTPException(
        status_code=401,
        detail="Authentication required or token invalid.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        user_id, session_id = read_access_claims(
            credentials.credentials, request.app.state.settings
        )
        if not AccountService().valid_session(session, user_id, session_id):
            raise InvalidToken()
        request.state.session_id = session_id
    except InvalidToken:
        raise unauthorized from None
    user = session.get(User, user_id)
    if user is None:
        raise unauthorized
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled.")
    return user
