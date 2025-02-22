"""add_min_max_employees_per_shift

Revision ID: fdfb359e677a
Revises: 72d576db36f5
Create Date: 2024-03-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fdfb359e677a'
down_revision = '72d576db36f5'
branch_labels = None
depends_on = None


def upgrade():
    # Add min_employees_per_shift and max_employees_per_shift columns
    op.add_column('settings', sa.Column('min_employees_per_shift', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('settings', sa.Column('max_employees_per_shift', sa.Integer(), nullable=False, server_default='3'))


def downgrade():
    # Remove the columns
    op.drop_column('settings', 'min_employees_per_shift')
    op.drop_column('settings', 'max_employees_per_shift')
