from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.notebooks import router as notebooks_router
from app.core.config import Settings, get_settings
from app.core.database import create_engine_for_url, create_session_factory


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create the API application without relying on module-level mutable state."""
    active_settings = settings or get_settings()
    app = FastAPI(
        title=active_settings.app_name,
        version="0.17.0",
        description="API do Tomohu.",
    )
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
    app.include_router(health_router)
    app.include_router(notebooks_router)
    return app


app = create_app()
