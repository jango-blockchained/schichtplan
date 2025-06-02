"""add_weekend_start_to_settings

Revision ID: 20250602_170627
Revises: d433bcfaf979
Create Date: 2025-06-02 17:06:27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250602_170627'
down_revision = 'd433bcfaf979'
branch_labels = None
depends_on = None


def upgrade():
    """Add weekend_start column to settings table"""
    # Add the weekend_start column with default value 1 (Monday)
    op.add_column('settings', sa.Column('weekend_start', sa.Integer(), nullable=False, default=1))
    
    # Set default value for existing records
    op.execute("UPDATE settings SET weekend_start = 1 WHERE weekend_start IS NULL")


def downgrade():
    """Remove weekend_start column from settings table"""
    op.drop_column('settings', 'weekend_start')