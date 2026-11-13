from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.dependencies import get_session, require_user
from app.api.routes.auth import limit_auth_request
from app.core.rate_limit import RateLimitExceeded
from app.models.user import User
from app.repositories.account import AccountRepository
from app.schemas.auth import ResetPassword
from app.schemas.notebook import NotebookReplace
from app.schemas.privacy import (
    PasswordInput,
    PasswordSetup,
    PrivateCreate,
    ProtectInput,
    RestoreInput,
)
from app.services import privacy
from app.services.account import AccountService, InvalidAccountAction
from app.services.notebook import NotebookConflict, NotebookService

router = APIRouter(prefix="/api/v1/privacy", tags=["privacy"])


def unlocked(
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
    grant: str = Header(default="", alias="X-Privacy-Token"),
):
    user = AccountRepository().lock_user(session, user.id)
    privacy.verify_grant(
        grant, user, request.state.session_id, request.app.state.settings
    )
    return user


def password_limit(request, user, operation="settings"):
    try:
        request.app.state.auth_limiter.check("privacy:" + operation + ":" + user.id, 5)
    except RateLimitExceeded:
        raise HTTPException(
            429, "Too many privacy password attempts", headers={"Retry-After": "60"}
        ) from None


@router.get("/status")
def status(user: User = Depends(require_user)):
    return {"configured": bool(user.privacy_hash)}


@router.post("/password")
def setup(
    payload: PasswordSetup,
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
):
    password_limit(request, user)
    privacy.set_password(
        session,
        user,
        payload.password.get_secret_value(),
        payload.current_password.get_secret_value()
        if payload.current_password
        else None,
    )
    return {"message": "Privacy password saved"}


@router.post("/unlock")
def unlock(
    payload: PasswordInput,
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
):
    password_limit(request, user, "unlock")
    user = AccountRepository().lock_user(session, user.id)
    privacy.check_password(user, payload.password.get_secret_value())
    request.app.state.auth_limiter.clear("privacy:unlock:" + user.id)
    return {
        "token": privacy.issue_grant(
            user, request.state.session_id, request.app.state.settings
        ),
        "expires_in": 300,
    }


@router.post("/reset-request", dependencies=[Depends(limit_auth_request)])
def request_reset(
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
):
    password_limit(request, user)
    if not user.email_verified or not user.privacy_hash:
        raise HTTPException(
            403, "Verified email and a configured privacy password required"
        )
    AccountService().issue(session, user, "private", request.app.state.settings)
    return {"message": "Privacy recovery email requested"}


@router.post("/reset", dependencies=[Depends(limit_auth_request)])
def reset(
    payload: ResetPassword,
    request: Request,
    session: Session = Depends(get_session, scope="function"),
):
    try:
        AccountService().confirm(
            session,
            payload.token.get_secret_value(),
            "private",
            request.app.state.settings,
            payload.password.get_secret_value(),
        )
    except InvalidAccountAction:
        raise HTTPException(400, "Link invalid, expired or already used") from None
    return {"message": "Privacy password reset. Private data preserved."}


@router.get("/notebooks/{notebook_id}")
def listing(
    notebook_id: str,
    request: Request,
    user: User = Depends(require_user),
    session: Session = Depends(get_session, scope="function"),
    grant: str = Header(default="", alias="X-Privacy-Token"),
):
    privacy.owned_notebook(session, notebook_id, user.id)
    if grant:
        user = AccountRepository().lock_user(session, user.id)
        privacy.verify_grant(
            grant, user, request.state.session_id, request.app.state.settings
        )
    result = []
    for item in privacy.private_items(session, notebook_id):
        entry = {
            "id": item.id,
            "kind": item.kind,
            "root_id": item.root_id,
            "parent_id": item.parent_id,
            "position": item.position,
        }
        if grant:
            collection = item.snapshot[
                "sections" if item.kind == "section" else "contents"
            ]
            entry["title"] = next(
                value["title"] for value in collection if value["id"] == item.root_id
            )
        result.append(entry)
    return result


@router.post("/notebooks/{notebook_id}")
def protect(
    notebook_id: str,
    payload: ProtectInput,
    user: User = Depends(unlocked),
    session: Session = Depends(get_session, scope="function"),
):
    book = privacy.owned_notebook(session, notebook_id, user.id, lock=True)
    item = privacy.protect(
        session,
        book,
        payload.kind,
        payload.root_id,
        payload.revision,
        payload.section,
        payload.title,
    )
    return {
        "id": item.id,
        "notebook": {
            "id": book.id,
            "revision": book.revision,
            "snapshot": book.snapshot,
        },
    }


@router.post("/notebooks/{notebook_id}/create")
def create_private(
    notebook_id: str,
    payload: PrivateCreate,
    user: User = Depends(unlocked),
    session: Session = Depends(get_session, scope="function"),
):
    book = privacy.owned_notebook(session, notebook_id, user.id, lock=True)
    item = privacy.create_private(session, book, payload)
    return {
        "id": item.id,
        "notebook": {
            "id": book.id,
            "revision": book.revision,
            "snapshot": book.snapshot,
        },
    }


@router.get("/notebooks/{notebook_id}/{item_id}")
def read(
    notebook_id: str,
    item_id: str,
    user: User = Depends(unlocked),
    session: Session = Depends(get_session, scope="function"),
):
    privacy.owned_notebook(session, notebook_id, user.id)
    item = privacy.item_for(session, notebook_id, item_id)
    return {"snapshot": item.snapshot, "revision": item.revision}


@router.put("/notebooks/{notebook_id}/{item_id}")
def save(
    notebook_id: str,
    item_id: str,
    payload: NotebookReplace,
    user: User = Depends(unlocked),
    session: Session = Depends(get_session, scope="function"),
):
    privacy.owned_notebook(session, notebook_id, user.id)
    item = privacy.item_for(session, notebook_id, item_id, lock=True)
    if item.revision != payload.revision:
        raise NotebookConflict("Private data changed elsewhere. Reload before saving")
    NotebookService._validate_or_reject(payload.snapshot)
    snapshot = payload.snapshot.model_dump(mode="json", exclude_unset=True)
    if item.kind == "section":
        roots = [s for s in snapshot["sections"] if s["parentId"] is None]
        if len(roots) != 1 or roots[0]["id"] != item.root_id:
            raise HTTPException(422, "Keep the original private root section")
    elif (
        len(snapshot["sections"]) != 1
        or snapshot["sections"][0]["id"] != item.parent_id
        or len(snapshot["contents"]) != 1
        or snapshot["contents"][0]["id"] != item.root_id
        or snapshot["reminders"]
    ):
        raise HTTPException(422, "Keep the original private content")
    item.snapshot = snapshot
    item.revision += 1
    privacy.flush(session)
    return {"snapshot": item.snapshot, "revision": item.revision}


@router.post("/notebooks/{notebook_id}/{item_id}/restore")
def restore(
    notebook_id: str,
    item_id: str,
    payload: RestoreInput,
    user: User = Depends(unlocked),
    session: Session = Depends(get_session, scope="function"),
):
    book = privacy.owned_notebook(session, notebook_id, user.id, lock=True)
    item = privacy.item_for(session, notebook_id, item_id, lock=True)
    privacy.restore(session, book, item, payload.revision, payload.item_revision)
    return {
        "message": "Item restored",
        "notebook": {
            "id": book.id,
            "revision": book.revision,
            "snapshot": book.snapshot,
        },
    }


@router.delete("/notebooks/{notebook_id}/{item_id}")
def remove(
    notebook_id: str,
    item_id: str,
    revision: int,
    user: User = Depends(unlocked),
    session: Session = Depends(get_session, scope="function"),
):
    privacy.owned_notebook(session, notebook_id, user.id)
    item = privacy.item_for(session, notebook_id, item_id, lock=True)
    if item.revision != revision:
        raise NotebookConflict("Private data changed elsewhere. Reload before deleting")
    session.delete(item)
    privacy.flush(session)
    return {"message": "Private item deleted"}
