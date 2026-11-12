from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_session, require_user
from app.core.rate_limit import RateLimitExceeded
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import Credentials, Registration, TokenResponse, UserResponse
from app.services.account import AccountService, InvalidAccountAction
from app.services.auth import AuthService, EmailUnavailable, InvalidCredentials

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


def limit_auth_request(request: Request) -> None:
    # Ignore caller-supplied X-Forwarded-For; configure trusted proxies separately.
    ip = request.client.host if request.client else "unknown"
    try:
        request.app.state.auth_limiter.check(f"ip:{ip}", 30)
    except RateLimitExceeded:
        raise HTTPException(
            429, "Too many attempts. Try again later.", headers={"Retry-After": "60"}
        ) from None


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201,
    dependencies=[Depends(limit_auth_request)],
)
def register(
    payload: Registration,
    request: Request,
    response: Response,
    session: Session = Depends(get_session, scope="function"),
) -> User:
    response.headers["Cache-Control"] = "no-store"
    try:
        user = AuthService().register(
            session, payload.email, payload.password.get_secret_value()
        )
        AccountService().issue(session, user, "verify", request.app.state.settings)
        return user
    except EmailUnavailable:
        raise HTTPException(
            409, "Registration could not be completed with these details."
        ) from None


@router.post(
    "/login", response_model=TokenResponse, dependencies=[Depends(limit_auth_request)]
)
def login(
    payload: Credentials,
    request: Request,
    response: Response,
    session: Session = Depends(get_session, scope="function"),
) -> TokenResponse:
    response.headers["Cache-Control"] = "no-store"
    key = sha256(payload.email.encode()).hexdigest()
    try:
        request.app.state.auth_limiter.check(f"account:{key}", 10)
    except RateLimitExceeded:
        raise HTTPException(
            429, "Too many attempts. Try again later.", headers={"Retry-After": "60"}
        ) from None
    try:
        user = AuthService().authenticate(
            session, payload.email, payload.password.get_secret_value()
        )
    except InvalidCredentials:
        raise HTTPException(
            401, "Invalid email or password.", headers={"WWW-Authenticate": "Bearer"}
        ) from None
    settings = request.app.state.settings
    try:
        active = AccountService().create_session(session, user, settings)
    except InvalidAccountAction:
        raise HTTPException(401, "Credentials changed. Sign in again.") from None
    return TokenResponse(
        access_token=create_access_token(user.id, settings, active.id),
        expires_in=settings.access_token_minutes * 60,
    )


@router.get("/me", response_model=UserResponse)
def current_user(response: Response, user: User = Depends(require_user)) -> User:
    response.headers["Cache-Control"] = "no-store"
    return user
