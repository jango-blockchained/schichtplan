"""Add enable_diagnostics and generation_requirements fields to Settings model

Revision ID: add_settings_columns
Revises: add_shift_type_to_schedules
Create Date: 2024-10-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'add_settings_columns'
down_revision = 'add_shift_type_to_schedules'
branch_labels = None
depends_on = None


def upgrade():
    # Check if columns exist before adding them
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('settings')]
    
    with op.batch_alter_table('settings', schema=None) as batch_op:
        if 'enable_diagnostics' not in columns:
            batch_op.add_column(sa.Column('enable_diagnostics', sa.Boolean(), nullable=False, server_default='0'))
        if 'generation_requirements' not in columns:
            batch_op.add_column(sa.Column('generation_requirements', sqlite.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('settings', schema=None) as batch_op:
        batch_op.drop_column('generation_requirements')
        batch_op.drop_column('enable_diagnostics') 