"""
Add event_types column to settings table

This migration adds support for event types (like special offer days, inventory, training)
which are distinct from absence types and used for informational purposes.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON

# revision identifiers
revision = "add_event_types"
down_revision = "ai_system_tables"  # Set this to the previous migration
branch_labels = None
depends_on = None


def upgrade():
    """Add event_types column to settings table."""

    # Add event_types column with default values
    op.add_column(
        "settings",
        sa.Column(
            "event_types",
            JSON,
            nullable=True,
            default=lambda: [
                {
                    "id": "SPECIAL_OFFER",
                    "name": "Sonderangebot",
                    "color": "#9C27B0",
                    "description": "Special offer day - informational only",
                    "type": "event_type",
                },
                {
                    "id": "INVENTORY",
                    "name": "Inventur",
                    "color": "#607D8B",
                    "description": "Inventory day",
                    "type": "event_type",
                },
                {
                    "id": "TRAINING",
                    "name": "Schulung",
                    "color": "#009688",
                    "description": "Training event",
                    "type": "event_type",
                },
            ],
        ),
    )

    # Update existing settings records to have default event types
    op.execute(
        """
        UPDATE settings 
        SET event_types = json('[
            {
                "id": "SPECIAL_OFFER",
                "name": "Sonderangebot",
                "color": "#9C27B0",
                "description": "Special offer day - informational only",
                "type": "event_type"
            },
            {
                "id": "INVENTORY",
                "name": "Inventur",
                "color": "#607D8B",
                "description": "Inventory day",
                "type": "event_type"
            },
            {
                "id": "TRAINING",
                "name": "Schulung",
                "color": "#009688",
                "description": "Training event",
                "type": "event_type"
            }
        ]')
        WHERE event_types IS NULL
        """
    )


def downgrade():
    """Remove event_types column from settings table."""
    op.drop_column("settings", "event_types")
