"""Update schedule status values

Revision ID: update_schedule_status
Revises: de3c6a13df0a
Create Date: 2025-03-09 10:45:00.000000

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "update_schedule_status"
down_revision = "de3c6a13df0a"
branch_labels = None
depends_on = None


def upgrade():
    # Update existing status values from lowercase to uppercase
    op.execute("UPDATE schedules SET status = 'DRAFT' WHERE status = 'draft'")
    op.execute("UPDATE schedules SET status = 'PUBLISHED' WHERE status = 'published'")
    op.execute("UPDATE schedules SET status = 'ARCHIVED' WHERE status = 'archived'")


def downgrade():
    # Revert status values from uppercase to lowercase
    op.execute("UPDATE schedules SET status = 'draft' WHERE status = 'DRAFT'")
    op.execute("UPDATE schedules SET status = 'published' WHERE status = 'PUBLISHED'")
    op.execute("UPDATE schedules SET status = 'archived' WHERE status = 'ARCHIVED'")
