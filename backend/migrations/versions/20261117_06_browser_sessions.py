"""Add revocable browser renewal credentials without changing notebook data."""

import sqlalchemy as sa
from alembic import op

revision = "20261117_06"
down_revision = "20261112_05"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "browser_renewals",
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("auth_sessions.id"),
            primary_key=True,
        ),
        sa.Column("digest", sa.String(64), nullable=False),
        sa.Column("previous_digest", sa.String(64), nullable=True),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    # Old code must not keep accepting long-lived browser sessions after rollback.
    op.execute(
        "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP "
        "WHERE id IN (SELECT session_id FROM browser_renewals) "
        "AND revoked_at IS NULL"
    )
    op.drop_table("browser_renewals")
