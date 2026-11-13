"""Keep locked cards near their original sibling positions."""

import sqlalchemy as sa
from alembic import op

revision = "20261112_05"
down_revision = "20261112_04"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "private_items",
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("private_items", "position")
