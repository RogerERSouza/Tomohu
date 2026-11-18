from datetime import UTC, datetime
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_session, require_user
from app.api.routes.auth import authenticate_login, limit_auth_request
from app.core.rate_limit import RateLimitExceeded
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import Credentials, TokenResponse
from app.schemas.notebook import NotebookResponse
from app.services.account import InvalidAccountAction, utc
from app.services.browser_session import LIFETIME, BrowserSessionService

router = APIRouter(prefix="/api/v1/auth/browser", tags=["browser sessions"])
COOKIE = "tomohu_refresh"
PATH = "/api/v1/auth/browser"


def trusted_browser(request: Request):
    origin = request.headers.get("origin", "")
    settings = request.app.state.settings
    if (
        origin not in settings.cors_origins
        or request.headers.get("x-tomohu-request") != "1"
    ):
        raise HTTPException(403, "Trusted browser origin required")
    if settings.environment == "production":
        # Use the frontend origin; do not depend on third-party cookies.
        frontend = urlsplit(settings.frontend_url)
        if (
            origin != f"{frontend.scheme}://{frontend.netloc}"
            or request.url.scheme != "https"
            or request.url.netloc != frontend.netloc
        ):
            raise HTTPException(
                403, "Browser sessions require same-origin HTTPS hosting"
            )


def limit_renewal(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    try:
        request.app.state.auth_limiter.check(f"renewal:{ip}", 60)
    except RateLimitExceeded:
        raise HTTPException(
            429, "Too many attempts. Try again later.", headers={"Retry-After": "60"}
        ) from None


def set_cookie(response, raw, active, settings):
    response.set_cookie(
        COOKIE,
        raw,
        max_age=max(
            0,
            min(LIFETIME, int((active.expires_at - datetime.now(UTC)).total_seconds())),
        ),
        httponly=True,
        secure=settings.environment == "production",
        samesite="strict",
        path=PATH,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(trusted_browser), Depends(limit_auth_request)],
)
def login(
    payload: Credentials,
    request: Request,
    response: Response,
    session: Session = Depends(get_session, scope="function"),
):
    user = authenticate_login(payload, request, session)
    try:
        active, raw = BrowserSessionService().issue(
            session, user, request.app.state.settings
        )
    except InvalidAccountAction:
        raise HTTPException(401, "Credentials changed. Sign in again.") from None
    set_cookie(response, raw, active, request.app.state.settings)
    return TokenResponse(
        access_token=create_access_token(
            user.id, request.app.state.settings, active.id
        ),
        expires_in=request.app.state.settings.access_token_minutes * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    dependencies=[Depends(trusted_browser), Depends(limit_renewal)],
)
def refresh(
    request: Request,
    response: Response,
    session: Session = Depends(get_session, scope="function"),
):
    user, active, raw = BrowserSessionService().renew(
        session, request.cookies.get(COOKIE, "")
    )
    # SQLite returns naive datetimes; cookie expiry still uses the server's UTC policy.
    active.expires_at = utc(active.expires_at)
    set_cookie(response, raw, active, request.app.state.settings)
    return TokenResponse(
        access_token=create_access_token(
            user.id, request.app.state.settings, active.id
        ),
        expires_in=request.app.state.settings.access_token_minutes * 60,
    )


@router.post("/logout", dependencies=[Depends(trusted_browser)])
def logout(
    request: Request,
    response: Response,
    session: Session = Depends(get_session, scope="function"),
):
    _, active, _ = BrowserSessionService().authenticate(
        session, request.cookies.get(COOKIE, "")
    )
    active.revoked_at = datetime.now(UTC)
    response.delete_cookie(
        COOKIE,
        path=PATH,
        httponly=True,
        secure=request.app.state.settings.environment == "production",
        samesite="strict",
    )
    return {"message": "Browser session ended"}


@router.post(
    "/bootstrap",
    response_model=NotebookResponse,
    response_model_exclude_unset=True,
    dependencies=[Depends(trusted_browser)],
)
def bootstrap(
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
):
    book = BrowserSessionService().bootstrap(session, user)
    return {"id": book.id, "revision": book.revision, "snapshot": book.snapshot}
