from datetime import UTC, datetime
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_session, require_user
from app.api.routes.auth import limit_auth_request
from app.core.rate_limit import RateLimitExceeded
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import ChangePassword, EmailRequest, ResetPassword, TokenRequest
from app.services.account import AccountService, InvalidAccountAction, utc

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["account lifecycle"],
    dependencies=[Depends(limit_auth_request)],
)
GENERIC = {"message": "If the account is eligible, an email will be sent."}


def limit_email(request: Request, email: str) -> None:
    try:
        request.app.state.auth_limiter.check(
            "email-action:" + sha256(email.lower().encode()).hexdigest(), 3
        )
    except RateLimitExceeded:
        raise HTTPException(
            429, "Too many attempts.", headers={"Retry-After": "60"}
        ) from None


@router.post("/password/reset-request", status_code=202)
def request_reset(
    payload: EmailRequest,
    request: Request,
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    limit_email(request, payload.email)
    user = UserRepository().get_by_email(session, payload.email.lower())
    if user and user.is_active:
        AccountService().issue(session, user, "reset", request.app.state.settings)
    return GENERIC


@router.post("/email/request", status_code=202)
def request_verification(
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    limit_email(request, user.email)
    AccountService().issue(session, user, "verify", request.app.state.settings)
    return GENERIC


@router.post("/email/verify")
def verify(
    payload: TokenRequest,
    request: Request,
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    try:
        AccountService().confirm(
            session,
            payload.token.get_secret_value(),
            "verify",
            request.app.state.settings,
        )
    except InvalidAccountAction:
        raise HTTPException(400, "Link invalid, expired or already used.") from None
    return {"message": "Email verified."}


@router.post("/password/reset")
def reset(
    payload: ResetPassword,
    request: Request,
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    try:
        AccountService().confirm(
            session,
            payload.token.get_secret_value(),
            "reset",
            request.app.state.settings,
            payload.password.get_secret_value(),
        )
    except InvalidAccountAction:
        raise HTTPException(400, "Link invalid, expired or already used.") from None
    return {"message": "Password reset. Sign in again."}


@router.post("/password/change")
def change(
    payload: ChangePassword,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    try:
        AccountService().change_password(
            session,
            user,
            payload.current_password.get_secret_value(),
            payload.password.get_secret_value(),
        )
    except InvalidAccountAction:
        raise HTTPException(400, "Current password invalid.") from None
    return {"message": "Password changed. All sessions ended."}


@router.get("/sessions")
def sessions(
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
) -> list[dict]:
    records = AccountService().repository.sessions(session, user.id, datetime.now(UTC))
    return [
        {
            "id": item.id,
            "created_at": utc(item.created_at).isoformat(),
            "expires_at": utc(item.expires_at).isoformat(),
            "current": item.id == request.state.session_id,
        }
        for item in records
    ]


@router.delete("/sessions/{session_id}")
def revoke(
    session_id: str,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    if not AccountService().revoke(session, user.id, session_id):
        raise HTTPException(404, "Session unavailable.")
    return {"message": "Session ended."}


@router.post("/logout")
def logout(
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    return revoke(request.state.session_id, user, session)


@router.post("/sessions/revoke-all")
def revoke_all(
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
) -> dict:
    AccountService().repository.revoke_all(session, user.id, datetime.now(UTC))
    return {"message": "All sessions ended."}
