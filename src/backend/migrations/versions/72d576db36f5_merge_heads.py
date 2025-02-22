"""merge_heads

Revision ID: 72d576db36f5
Revises: add_scheduling_resource_type, migrate_employee_groups
Create Date: 2025-02-22 15:25:11.654321

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '72d576db36f5'
down_revision = ('add_scheduling_resource_type', 'migrate_employee_groups')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
