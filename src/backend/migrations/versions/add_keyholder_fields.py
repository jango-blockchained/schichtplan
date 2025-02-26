"""Add keyholder fields to coverage table

Revision ID: add_keyholder_fields
Revises: 25cf2b5a118c
Create Date: 2025-02-26 21:43:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'add_keyholder_fields'
down_revision = '25cf2b5a118c'
branch_labels = None
depends_on = None

def upgrade():
    # Drop the temporary table if it exists
    op.execute(text('DROP TABLE IF EXISTS coverage_new'))
    
    # Create a new table with the desired schema
    op.create_table(
        'coverage_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('day_index', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=False),
        sa.Column('min_employees', sa.Integer(), nullable=False),
        sa.Column('max_employees', sa.Integer(), nullable=False),
        sa.Column('employee_types', sa.JSON(), nullable=False),
        sa.Column('requires_keyholder', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('keyholder_before_minutes', sa.Integer(), nullable=True),
        sa.Column('keyholder_after_minutes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Copy data from old table if it exists
    op.execute(text(
        """
        INSERT INTO coverage_new (
            id, day_index, start_time, end_time, min_employees, max_employees,
            employee_types, created_at, updated_at
        )
        SELECT id, day_index, start_time, end_time, min_employees, max_employees,
               employee_types, created_at, updated_at
        FROM coverage
        """
    ))

    # Drop old table and rename new one
    op.drop_table('coverage')
    op.rename_table('coverage_new', 'coverage')

def downgrade():
    # Drop the temporary table if it exists
    op.execute(text('DROP TABLE IF EXISTS coverage_old'))
    
    # Create the old table structure
    op.create_table(
        'coverage_old',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('day_index', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=False),
        sa.Column('min_employees', sa.Integer(), nullable=False),
        sa.Column('max_employees', sa.Integer(), nullable=False),
        sa.Column('employee_types', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Copy data back, excluding the new columns
    op.execute(text(
        """
        INSERT INTO coverage_old (
            id, day_index, start_time, end_time, min_employees, max_employees,
            employee_types, created_at, updated_at
        )
        SELECT id, day_index, start_time, end_time, min_employees, max_employees,
               employee_types, created_at, updated_at
        FROM coverage
        """
    ))

    # Drop new table and rename old one back
    op.drop_table('coverage')
    op.rename_table('coverage_old', 'coverage') 