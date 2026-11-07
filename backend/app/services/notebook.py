from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from app.models.notebook import NotebookRecord
from app.repositories.notebook import NotebookRepository
from app.schemas.notebook import NotebookSnapshot


class NotebookService:
    def __init__(self, repository: NotebookRepository | None = None) -> None:
        self.repository = repository or NotebookRepository()

    def create(self, session: Session, snapshot: NotebookSnapshot) -> NotebookRecord:
        self._validate_or_reject(snapshot)
        notebook = NotebookRecord(
            id=str(uuid4()),
            schema_version=snapshot.schemaVersion,
            snapshot=snapshot.model_dump(mode="json", exclude_unset=True),
        )
        return self.repository.add(session, notebook)

    def get(self, session: Session, notebook_id: str) -> NotebookRecord:
        notebook = self.repository.get(session, notebook_id)
        if notebook is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Notebook not found"
            )
        return notebook

    def replace(
        self,
        session: Session,
        notebook_id: str,
        revision: int,
        snapshot: NotebookSnapshot,
    ) -> NotebookRecord:
        self._validate_or_reject(snapshot)
        notebook = self.get(session, notebook_id)
        if notebook.revision != revision:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Notebook changed elsewhere. Load it before saving again.",
            )
        notebook.schema_version = snapshot.schemaVersion
        notebook.snapshot = snapshot.model_dump(mode="json", exclude_unset=True)
        notebook.revision += 1
        try:
            session.flush()
        except StaleDataError as error:
            session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Notebook changed elsewhere. Load it before saving again.",
            ) from error
        return notebook

    @staticmethod
    def _validate_or_reject(snapshot: NotebookSnapshot) -> None:
        try:
            NotebookService._validate_snapshot(snapshot)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
            ) from error

    @staticmethod
    def _validate_snapshot(snapshot: NotebookSnapshot) -> None:
        section_ids = [section.id for section in snapshot.sections]
        if len(section_ids) != len(set(section_ids)):
            raise ValueError("Section IDs must be unique")
        known_sections = set(section_ids)
        for section in snapshot.sections:
            if section.parentId is not None and section.parentId not in known_sections:
                raise ValueError("Every section parent must exist in the same notebook")
            if section.parentId == section.id:
                raise ValueError("A section cannot be its own parent")
        NotebookService._validate_section_tree(snapshot)
        for content in snapshot.contents:
            if content.sectionId not in known_sections:
                raise ValueError(
                    "Every content item must belong to an existing section"
                )
        for items in (snapshot.contents, snapshot.reminders):
            identifiers = [item.id for item in items]
            if len(identifiers) != len(set(identifiers)):
                raise ValueError("Notebook item IDs must be unique by type")

    @staticmethod
    def _validate_section_tree(snapshot: NotebookSnapshot) -> None:
        parents = {section.id: section.parentId for section in snapshot.sections}
        for section_id in parents:
            visited: set[str] = set()
            current = section_id
            while parents[current] is not None:
                if current in visited:
                    raise ValueError("Sections cannot form a parent cycle")
                visited.add(current)
                current = parents[current]
