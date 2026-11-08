"""Add accounts and quarantine existing anonymous snapshots.

Revision ID: 20261107_02
Revises: 20261107_01
"""

import sqlalchemy as sa
from alembic import op

revision = "20261107_02"
down_revision = "20261107_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("email = lower(email)", name="ck_users_email_lower"),
    )
    with op.batch_alter_table("notebooks") as batch:
        batch.add_column(sa.Column("owner_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_notebooks_owner", "users", ["owner_id"], ["id"], ondelete="RESTRICT"
        )
        batch.create_index("ix_notebooks_owner_id", ["owner_id"])
    # Never infer ownership from a UUID or assign old snapshots to the first account.


def downgrade() -> None:
    connection = op.get_bind()
    users = connection.execute(sa.text("SELECT count(*) FROM users")).scalar_one()
    if users:
        raise RuntimeError(
            "Refusing to remove accounts/ownership. Back up and migrate explicitly."
        )
    with op.batch_alter_table("notebooks") as batch:
        batch.drop_index("ix_notebooks_owner_id")
        batch.drop_constraint("fk_notebooks_owner", type_="foreignkey")
        batch.drop_column("owner_id")
    op.drop_table("users")
