from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notebook import NotebookRecord


class NotebookRepository:
    """Database access for notebooks; business validation stays in the service."""

    def get(self, session: Session, notebook_id: str) -> NotebookRecord | None:
        return session.scalar(
            select(NotebookRecord).where(NotebookRecord.id == notebook_id)
        )

    def add(self, session: Session, notebook: NotebookRecord) -> NotebookRecord:
        session.add(notebook)
        session.flush()
        return notebook
