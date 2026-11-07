from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core.config import Settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    environment: str


@router.get("/health", response_model=HealthResponse)
def get_health(request: Request) -> HealthResponse:
    """Return a safe status response without exposing configuration secrets."""
    settings: Settings = request.app.state.settings
    return HealthResponse(status="ok", environment=settings.environment)
