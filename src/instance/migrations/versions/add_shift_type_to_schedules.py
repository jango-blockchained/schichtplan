"""Add shift_type column to schedules table

Revision ID: add_shift_type_to_schedules
Revises: add_shift_types
Create Date: 2023-11-15 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = "add_shift_type_to_schedules"
down_revision = "add_shift_types"
branch_labels = None
depends_on = None


def upgrade():
    # Check if the column already exists
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [column["name"] for column in inspector.get_columns("schedules")]

    if "shift_type" not in columns:
        # Add shift_type column to schedules table
        op.add_column(
            "schedules", sa.Column("shift_type", sa.String(20), nullable=True)
        )

    # Update existing records based on shift information
    # This is a placeholder - you may want to add logic to set shift_type based on existing data
    # For example, you could set shift_type based on notes or other fields


def downgrade():
    # Check if the column exists before dropping it
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [column["name"] for column in inspector.get_columns("schedules")]

    if "shift_type" in columns:
        # Remove shift_type column from schedules table
        op.drop_column("schedules", "shift_type")
