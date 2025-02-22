"""add scheduling resource type

Revision ID: add_scheduling_resource_type
Revises: 077f67588060
Create Date: 2024-02-22 12:05:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_scheduling_resource_type'
down_revision = '077f67588060'
branch_labels = None
depends_on = None

def upgrade():
    # Add scheduling_resource_type column with default value 'shifts'
    op.add_column('settings', sa.Column('scheduling_resource_type', sa.String(20), nullable=False, server_default='shifts'))

def downgrade():
    # Remove scheduling_resource_type column
    op.drop_column('settings', 'scheduling_resource_type') 