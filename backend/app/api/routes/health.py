from typing import Literal

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text

from app.core.config import Settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    environment: str


@router.get("/health", response_model=HealthResponse)
def get_health(request: Request) -> HealthResponse:
    """Return a safe status response without exposing configuration secrets."""
    try:
        with request.app.state.session_factory() as session:
            session.execute(text("SELECT 1"))
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable",
        ) from error
    settings: Settings = request.app.state.settings
    return HealthResponse(status="ok", environment=settings.environment)
