"""Add shift_type column to shifts table

Revision ID: 75e9e2ee041c
Revises: ed2783bafef6
Create Date: 2025-03-01 14:41:00.850733

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = "75e9e2ee041c"
down_revision = "ed2783bafef6"
branch_labels = None
depends_on = None


def upgrade():
    # First drop the existing shift_type column
    with op.batch_alter_table("shifts", schema=None) as batch_op:
        batch_op.drop_column("shift_type")

    # Add shift_type column as nullable with enum type
    with op.batch_alter_table("shifts", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "shift_type",
                sa.Enum("EARLY", "MIDDLE", "LATE", name="shifttype"),
                nullable=True,
            )
        )

    # Update existing rows with default values based on shift times
    connection = op.get_bind()
    shifts = connection.execute(
        text("SELECT id, start_time, end_time FROM shifts")
    ).fetchall()
    for shift in shifts:
        shift_id, start_time, end_time = shift
        start_hour = int(start_time.split(":")[0])
        end_hour = int(end_time.split(":")[0])

        if start_hour <= 10:
            shift_type = "EARLY"
        elif end_hour >= 19:
            shift_type = "LATE"
        else:
            shift_type = "MIDDLE"

        connection.execute(
            text("UPDATE shifts SET shift_type = :shift_type WHERE id = :shift_id"),
            {"shift_type": shift_type, "shift_id": shift_id},
        )

    # Now make the column NOT NULL
    with op.batch_alter_table("shifts", schema=None) as batch_op:
        batch_op.alter_column("shift_type", nullable=False)


def downgrade():
    # Remove the shift_type enum column and add back the VARCHAR column
    with op.batch_alter_table("shifts", schema=None) as batch_op:
        batch_op.drop_column("shift_type")
        batch_op.add_column(
            sa.Column("shift_type", sa.VARCHAR(length=6), nullable=True)
        )
