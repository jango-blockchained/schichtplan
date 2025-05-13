"""Add special_days column to settings table

Revision ID: special_days_column
Revises: add_settings_columns
Create Date: 2024-07-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'special_days_column'
down_revision = 'add_settings_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Check if column exists before adding it
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('settings')]
    
    # Add special_days column with default empty JSON dictionary if it doesn't exist
    if 'special_days' not in columns:
        with op.batch_alter_table('settings', schema=None) as batch_op:
            batch_op.add_column(sa.Column('special_days', sqlite.JSON(), nullable=False, server_default='{}'))


def downgrade():
    # Remove special_days column
    with op.batch_alter_table('settings') as batch_op:
        batch_op.drop_column('special_days')