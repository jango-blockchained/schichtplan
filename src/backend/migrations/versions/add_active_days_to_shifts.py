"""add active_days to shifts

Revision ID: add_active_days_to_shifts
Revises: bc4f1654eea7
Create Date: 2024-02-21 00:55:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON
import json

# revision identifiers, used by Alembic.
revision = 'add_active_days_to_shifts'
down_revision = 'bc4f1654eea7'  # Set to the latest migration
branch_labels = None
depends_on = None

default_active_days = {
    "0": False,  # Sunday
    "1": True,   # Monday
    "2": True,   # Tuesday
    "3": True,   # Wednesday
    "4": True,   # Thursday
    "5": True,   # Friday
    "6": True    # Saturday
}

def upgrade():
    # SQLite doesn't support adding JSON columns directly, so we need to use Text
    with op.batch_alter_table('shifts') as batch_op:
        batch_op.add_column(sa.Column('active_days', sa.Text(), nullable=True))
    
    # Update existing rows with default value
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "UPDATE shifts SET active_days = :default_value WHERE active_days IS NULL"
        ),
        {"default_value": json.dumps(default_active_days)}
    )
    
    # Make the column not nullable after setting defaults
    with op.batch_alter_table('shifts') as batch_op:
        batch_op.alter_column('active_days', nullable=False)

def downgrade():
    with op.batch_alter_table('shifts') as batch_op:
        batch_op.drop_column('active_days') 