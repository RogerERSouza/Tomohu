from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.notebooks import router as notebooks_router
from app.core.config import Settings, get_settings
from app.core.database import create_engine_for_url, create_session_factory
from app.core.rate_limit import AuthRateLimiter
from app.services.notebook import InvalidSnapshot, NotebookConflict, NotebookNotFound


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API application without relying on module-level mutable state."""
    active_settings = settings or get_settings()
    app = FastAPI(
        title=active_settings.app_name,
        version="0.18.0",
        description="Tomohu API.",
    )
    app.state.auth_limiter = AuthRateLimiter()
    app.state.settings = active_settings
    app.state.engine = create_engine_for_url(active_settings.database_url)
    app.state.session_factory = create_session_factory(app.state.engine)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(active_settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )

    async def notebook_error(request: Request, error: Exception) -> JSONResponse:
        status_code = {
            NotebookNotFound: 404,
            NotebookConflict: 409,
            InvalidSnapshot: 422,
        }[type(error)]
        return JSONResponse(
            status_code=status_code,
            content={"detail": str(error)},
            headers={"Cache-Control": "no-store"},
        )

    for error_type in (NotebookNotFound, NotebookConflict, InvalidSnapshot):
        app.add_exception_handler(error_type, notebook_error)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        # Never echo submitted passwords or raw inputs in validation responses.
        errors = [
            {"loc": list(item["loc"]), "type": item["type"], "msg": item["msg"]}
            for item in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"detail": errors},
            headers={"Cache-Control": "no-store"},
        )

    @app.middleware("http")
    async def private_responses(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.include_router(auth_router)
    app.include_router(health_router)
    app.include_router(notebooks_router)
    return app


app = create_app()
