"""Separate private aggregates from public notebook snapshots."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20261112_04"
down_revision = "20261111_03"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("privacy_hash", sa.String(512)))
    op.add_column(
        "users",
        sa.Column("privacy_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "private_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "notebook_id",
            sa.String(36),
            sa.ForeignKey("notebooks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("root_id", sa.String(64), nullable=False),
        sa.Column("parent_id", sa.String(64)),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('section', 'content')", name="ck_private_items_kind"
        ),
        sa.CheckConstraint("revision > 0", name="ck_private_items_revision"),
        sa.UniqueConstraint(
            "notebook_id", "kind", "root_id", name="uq_private_items_root"
        ),
        sa.Column(
            "snapshot",
            postgresql.JSONB().with_variant(sa.JSON(), "sqlite"),
            nullable=False,
        ),
    )
    op.create_index("ix_private_items_notebook_id", "private_items", ["notebook_id"])


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM private_items")
    ) or op.get_bind().scalar(
        sa.text("SELECT count(*) FROM users WHERE privacy_hash IS NOT NULL")
    ):
        raise RuntimeError(
            "Refusing to discard privacy credentials or content. "
            "Review and export before downgrading"
        )
    op.drop_table("private_items")
    op.drop_column("users", "privacy_version")
    op.drop_column("users", "privacy_hash")
