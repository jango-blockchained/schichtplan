"""Add version field to schedules table

Revision ID: add_version_to_schedules
Revises: update_schedule_status
Create Date: 2025-03-09 11:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_version_to_schedules"
down_revision = "update_schedule_status"
branch_labels = None
depends_on = None


def upgrade():
    # Add version column to schedules table
    op.add_column(
        "schedules",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade():
    # Remove version column from schedules table
    op.drop_column("schedules", "version")
