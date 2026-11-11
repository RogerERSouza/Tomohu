from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notebook import NotebookRecord


class NotebookRepository:
    """Database access for notebooks; business validation stays in the service."""

    def list_owned(self, session: Session, owner_id: str) -> list[NotebookRecord]:
        return list(
            session.scalars(
                select(NotebookRecord)
                .where(NotebookRecord.owner_id == owner_id)
                .order_by(NotebookRecord.created_at, NotebookRecord.id)
            )
        )

    def get(
        self, session: Session, notebook_id: str, owner_id: str
    ) -> NotebookRecord | None:
        return session.scalar(
            select(NotebookRecord).where(
                NotebookRecord.id == notebook_id, NotebookRecord.owner_id == owner_id
            )
        )

    def add(self, session: Session, notebook: NotebookRecord) -> NotebookRecord:
        session.add(notebook)
        session.flush()
        return notebook
