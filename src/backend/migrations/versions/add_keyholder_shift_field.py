"""
Add is_keyholder_shift field to schedules table

This migration adds support for assigning keyholder status to specific shifts
rather than only to employees. This allows tracking which specific schedule entry
requires the key holder (e.g., opening or closing shifts).
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision = "add_keyholder_shift"
down_revision = "add_event_types"  # Set this to the previous migration
branch_labels = None
depends_on = None


def upgrade():
    """Add is_keyholder_shift column to schedules table."""

    # Add is_keyholder_shift column with default False
    op.add_column(
        "schedules",
        sa.Column(
            "is_keyholder_shift",
            sa.Boolean(),
            nullable=False,
            server_default="0",  # SQLite uses 0 for False
        ),
    )


def downgrade():
    """Remove is_keyholder_shift column from schedules table."""
    op.drop_column("schedules", "is_keyholder_shift")
