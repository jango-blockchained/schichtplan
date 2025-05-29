"""Add calendar_start_day and calendar_default_view to settings

Revision ID: a1b2c3d4e5f6
Revises: 57b7b9078143
Create Date: 2025-05-28 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '57b7b9078143'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('calendar_start_day', sa.String(length=10), nullable=True, server_default='monday'))
        batch_op.add_column(sa.Column('calendar_default_view', sa.String(length=10), nullable=True, server_default='month'))

def downgrade():
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.drop_column('calendar_default_view')
        batch_op.drop_column('calendar_start_day')
