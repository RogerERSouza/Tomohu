from typing import cast

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_session, require_user
from app.models.user import User
from app.schemas.notebook import (
    NotebookCreate,
    NotebookReplace,
    NotebookResponse,
    NotebookSnapshot,
)
from app.services.notebook import NotebookService

router = APIRouter(prefix="/api/v1/notebooks", tags=["notebooks"])


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
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> NotebookResponse:
    notebook = NotebookService().create(session, payload.snapshot, user.id)
    return as_response(notebook.id, notebook.revision, notebook.snapshot)


@router.get(
    "/{notebook_id}", response_model=NotebookResponse, response_model_exclude_unset=True
)
def get_notebook(
    notebook_id: str,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> NotebookResponse:
    notebook = NotebookService().get(session, notebook_id, user.id)
    return as_response(notebook.id, notebook.revision, notebook.snapshot)


@router.put(
    "/{notebook_id}", response_model=NotebookResponse, response_model_exclude_unset=True
)
def replace_notebook(
    notebook_id: str,
    payload: NotebookReplace,
    response: Response,
    user: User = Depends(require_user),
    session: Session = Depends(get_session),
) -> NotebookResponse:
    notebook = NotebookService().replace(
        session, notebook_id, payload.revision, payload.snapshot, user.id
    )
    response.headers["ETag"] = f'W/"{notebook.revision}"'
    return as_response(notebook.id, notebook.revision, notebook.snapshot)
