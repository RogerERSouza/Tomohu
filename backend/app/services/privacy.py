from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm.exc import StaleDataError

from app.core.security import AUDIENCE, DUMMY_HASH, ISSUER, password_hash
from app.models.notebook import NotebookRecord
from app.models.private import PrivateItem
from app.repositories.account import AccountRepository
from app.schemas.notebook import NotebookSnapshot
from app.services.notebook import NotebookConflict, NotebookNotFound, NotebookService


def issue_grant(user, session_id, settings):
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": user.id,
            "jti": session_id,
            "version": user.privacy_version,
            "token_type": "privacy",
            "iss": ISSUER,
            "aud": AUDIENCE,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def verify_grant(raw, user, session_id, settings):
    if user is None or not user.is_active:
        raise HTTPException(401, "Account unavailable")
    try:
        claims = jwt.decode(
            raw,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["sub", "jti", "version", "token_type", "iat", "exp"]},
        )
        valid = (
            claims["sub"] == user.id
            and claims["jti"] == session_id
            and type(claims["version"]) is int
            and claims["version"] == user.privacy_version
            and claims["token_type"] == "privacy"
            and user.privacy_hash
        )
    except jwt.InvalidTokenError:
        valid = False
    if not valid:
        raise HTTPException(403, "Unlock privacy again")


def set_password(session, user, password, current=None):
    user = AccountRepository().lock_user(session, user.id)
    if user is None or not user.is_active:
        raise HTTPException(401, "Account unavailable")
    if user.privacy_hash and (
        current is None or not password_hash.verify(current, user.privacy_hash)
    ):
        raise HTTPException(403, "Current privacy password invalid")
    if not user.email_verified:
        raise HTTPException(403, "Verify your account email first")
    user.privacy_hash = password_hash.hash(password)
    user.privacy_version += 1


def check_password(user, password):
    if user is None or not user.is_active:
        raise HTTPException(401, "Account unavailable")
    valid = password_hash.verify(password, user.privacy_hash or DUMMY_HASH)
    if not valid or not user.privacy_hash:
        raise HTTPException(403, "Privacy password invalid")


def owned_notebook(session, notebook_id, owner_id, lock=False):
    query = select(NotebookRecord).where(
        NotebookRecord.id == notebook_id, NotebookRecord.owner_id == owner_id
    )
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    result = session.scalar(query)
    if result is None:
        raise NotebookNotFound("Notebook not found")
    return result


def private_items(session, notebook_id):
    return list(
        session.scalars(
            select(PrivateItem)
            .where(PrivateItem.notebook_id == notebook_id)
            .order_by(PrivateItem.id)
        )
    )


def item_for(session, notebook_id, item_id, lock=False):
    query = select(PrivateItem).where(
        PrivateItem.id == item_id, PrivateItem.notebook_id == notebook_id
    )
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    item = session.scalar(query)
    if item is None:
        raise NotebookNotFound("Private item not found")
    return item


def flush(session):
    try:
        session.flush()
    except StaleDataError:
        raise NotebookConflict(
            "Data changed elsewhere. Reload before saving."
        ) from None


def protect(session, notebook, kind, root_id, revision, section=None, title=None):
    if notebook.revision != revision:
        raise NotebookConflict("Sync and reload before changing privacy")
    source = deepcopy(notebook.snapshot)
    private = {"schemaVersion": 1, "sections": [], "contents": [], "reminders": []}
    if kind == "section":
        root = next((s for s in source["sections"] if s["id"] == root_id), None)
        if root is None:
            raise NotebookNotFound("Section not found")
        parent = root["parentId"]
        position = [
            s["id"] for s in source["sections"] if s["parentId"] == parent
        ].index(root_id)
        ids = {root_id}
        while True:
            expanded = ids | {
                s["id"] for s in source["sections"] if s["parentId"] in ids
            }
            if expanded == ids:
                break
            ids = expanded
        private["sections"] = [s for s in source["sections"] if s["id"] in ids]
        private["contents"] = [c for c in source["contents"] if c["sectionId"] in ids]
        next(s for s in private["sections"] if s["id"] == root_id)["parentId"] = None
        source["sections"] = [s for s in source["sections"] if s["id"] not in ids]
        source["contents"] = [
            c for c in source["contents"] if c["sectionId"] not in ids
        ]
        # Existing private children remain separate and reachable from the private area.
    else:
        content = next((c for c in source["contents"] if c["id"] == root_id), None)
        if content is None:
            raise NotebookNotFound("Content not found")
        parent = content["sectionId"]
        position = [
            c["id"] for c in source["contents"] if c["sectionId"] == parent
        ].index(root_id)
        private["sections"] = [
            {
                "id": parent,
                "parentId": None,
                "title": "Conteúdo privado",
                "emoji": "",
                "color": "#a7bcec",
            }
        ]
        private["contents"] = [content]
        source["contents"] = [c for c in source["contents"] if c["id"] != root_id]
    for sibling in sorted(
        (
            item
            for item in private_items(session, notebook.id)
            if item.kind == kind and item.parent_id == parent
        ),
        key=lambda item: item.position,
    ):
        if sibling.position <= position:
            position += 1
    if section is not None:
        if kind != "section" or section.id != root_id:
            raise HTTPException(422, "Section identity does not match")
        root = next(s for s in private["sections"] if s["id"] == root_id)
        root.update(section.model_dump(mode="json", exclude_unset=True))
        root["parentId"] = None
    if title is not None:
        collection = private["sections" if kind == "section" else "contents"]
        next(item for item in collection if item["id"] == root_id)["title"] = title
    NotebookService._validate_or_reject(NotebookSnapshot.model_validate(private))
    NotebookService._validate_or_reject(NotebookSnapshot.model_validate(source))
    item = PrivateItem(
        id=str(uuid4()),
        notebook_id=notebook.id,
        kind=kind,
        root_id=root_id,
        parent_id=parent,
        position=position,
        snapshot=private,
        revision=1,
    )
    session.add(item)
    notebook.snapshot = source
    notebook.revision += 1
    flush(session)
    return item


def restore(session, notebook, item, revision, item_revision):
    if notebook.revision != revision or item.revision != item_revision:
        raise NotebookConflict("Data changed elsewhere. Reload before restoring")
    source = deepcopy(notebook.snapshot)
    private = deepcopy(item.snapshot)
    if item.kind == "section":
        root = next(s for s in private["sections"] if s["id"] == item.root_id)
        root["parentId"] = (
            item.parent_id
            if any(s["id"] == item.parent_id for s in source["sections"])
            else None
        )
        siblings = [
            index
            for index, value in enumerate(source["sections"])
            if value["parentId"] == root["parentId"]
        ]
        before = sum(
            1
            for value in private_items(session, notebook.id)
            if value.id != item.id
            and value.kind == item.kind
            and value.parent_id == item.parent_id
            and value.position < item.position
        )
        position = max(0, item.position - before)
        index = (
            siblings[position] if position < len(siblings) else len(source["sections"])
        )
        source["sections"][index:index] = private["sections"]
    else:
        if not any(s["id"] == item.parent_id for s in source["sections"]):
            raise NotebookConflict(
                "The original section is unavailable. Restore it first"
            )
    if item.kind == "content":
        siblings = [
            index
            for index, value in enumerate(source["contents"])
            if value["sectionId"] == item.parent_id
        ]
        before = sum(
            1
            for value in private_items(session, notebook.id)
            if value.id != item.id
            and value.kind == item.kind
            and value.parent_id == item.parent_id
            and value.position < item.position
        )
        position = max(0, item.position - before)
        index = (
            siblings[position] if position < len(siblings) else len(source["contents"])
        )
        source["contents"][index:index] = private["contents"]
    else:
        source["contents"].extend(private["contents"])
    source["reminders"].extend(private["reminders"])
    try:
        restored = NotebookSnapshot.model_validate(source)
    except ValidationError:
        raise NotebookConflict("Restoring exceeds notebook limits") from None
    NotebookService._validate_or_reject(restored)
    notebook.snapshot = source
    notebook.revision += 1
    session.delete(item)
    flush(session)


def create_private(session, notebook, payload):
    if notebook.revision != payload.revision:
        raise NotebookConflict("Notebook changed elsewhere. Reload before creating")
    snapshot = payload.snapshot.model_dump(mode="json", exclude_unset=True)
    NotebookService._validate_or_reject(payload.snapshot)
    if payload.parent_id is not None and not any(
        s["id"] == payload.parent_id for s in notebook.snapshot["sections"]
    ):
        raise NotebookConflict("The destination section is unavailable")
    sections = snapshot["sections"]
    contents = snapshot["contents"]
    if payload.kind == "section":
        if (
            len(sections) != 1
            or sections[0]["id"] != payload.root_id
            or sections[0]["parentId"] is not None
            or contents
            or snapshot["reminders"]
        ):
            raise HTTPException(422, "Create one private root section")
    elif (
        payload.parent_id is None
        or len(sections) != 1
        or sections[0]["id"] != payload.parent_id
        or len(contents) != 1
        or contents[0]["id"] != payload.root_id
        or snapshot["reminders"]
    ):
        raise HTTPException(422, "Create one private content item")
    public_ids = (
        {s["id"] for s in notebook.snapshot["sections"]}
        if payload.kind == "section"
        else {c["id"] for c in notebook.snapshot["contents"]}
    )
    for existing in private_items(session, notebook.id):
        collection = (
            existing.snapshot["sections"]
            if payload.kind == "section" and existing.kind == "section"
            else existing.snapshot["contents"]
            if payload.kind == "content"
            else []
        )
        public_ids.update(value["id"] for value in collection)
    if payload.root_id in public_ids:
        raise NotebookConflict("Item identity already exists")
    siblings = (
        [s for s in notebook.snapshot["sections"] if s["parentId"] == payload.parent_id]
        if payload.kind == "section"
        else [
            c
            for c in notebook.snapshot["contents"]
            if c["sectionId"] == payload.parent_id
        ]
    )
    item = PrivateItem(
        id=str(uuid4()),
        notebook_id=notebook.id,
        kind=payload.kind,
        root_id=payload.root_id,
        parent_id=payload.parent_id,
        position=len(siblings)
        + sum(
            1
            for value in private_items(session, notebook.id)
            if value.kind == payload.kind and value.parent_id == payload.parent_id
        ),
        snapshot=snapshot,
        revision=1,
    )
    session.add(item)
    notebook.revision += 1
    flush(session)
    return item
