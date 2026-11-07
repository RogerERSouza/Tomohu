from collections.abc import Generator
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.database import session_scope
from app.schemas.notebook import (
    NotebookCreate,
    NotebookReplace,
    NotebookResponse,
    NotebookSnapshot,
)
from app.services.notebook import NotebookService

router = APIRouter(prefix="/api/v1/notebooks", tags=["notebooks"])


def require_anonymous_notebooks(request: Request) -> None:
    settings: Settings = request.app.state.settings
    if not settings.allow_anonymous_notebooks:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anonymous notebook access is disabled.",
        )


def get_session(request: Request) -> Generator[Session, None, None]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    yield from session_scope(factory)


def as_response(notebook_id: str, revision: int, snapshot: object) -> NotebookResponse:
    return NotebookResponse(
        id=notebook_id,
        revision=revision,
        snapshot=NotebookSnapshot.model_validate(cast(dict[str, object], snapshot)),
    )


@router.post(
    "",
    response_model=NotebookResponse,
    response_model_exclude_unset=True,
    status_code=status.HTTP_201_CREATED,
)
def create_notebook(
    payload: NotebookCreate,
    _: None = Depends(require_anonymous_notebooks),
    session: Session = Depends(get_session),
) -> NotebookResponse:
    notebook = NotebookService().create(session, payload.snapshot)
    return as_response(notebook.id, notebook.revision, notebook.snapshot)


@router.get(
    "/{notebook_id}", response_model=NotebookResponse, response_model_exclude_unset=True
)
def get_notebook(
    notebook_id: str,
    _: None = Depends(require_anonymous_notebooks),
    session: Session = Depends(get_session),
) -> NotebookResponse:
    notebook = NotebookService().get(session, notebook_id)
    return as_response(notebook.id, notebook.revision, notebook.snapshot)


@router.put(
    "/{notebook_id}", response_model=NotebookResponse, response_model_exclude_unset=True
)
def replace_notebook(
    notebook_id: str,
    payload: NotebookReplace,
    response: Response,
    _: None = Depends(require_anonymous_notebooks),
    session: Session = Depends(get_session),
) -> NotebookResponse:
    notebook = NotebookService().replace(
        session, notebook_id, payload.revision, payload.snapshot
    )
    response.headers["ETag"] = f'W/"{notebook.revision}"'
    return as_response(notebook.id, notebook.revision, notebook.snapshot)
