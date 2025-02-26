"""Remove keyholder fields from coverage table

Revision ID: remove_keyholder_fields
Revises: add_keyholder_fields
Create Date: 2024-02-26 23:21:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'remove_keyholder_fields'
down_revision = 'add_keyholder_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the temporary table if it exists
    op.execute(text('DROP TABLE IF EXISTS coverage_new'))
    
    # Create new table without keyholder fields
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
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Copy data from old table if it exists
    op.execute(text(
        """
        INSERT INTO coverage_new (
            id, day_index, start_time, end_time, min_employees, max_employees,
            employee_types, requires_keyholder, created_at, updated_at
        )
        SELECT id, day_index, start_time, end_time, min_employees, max_employees,
               employee_types, requires_keyholder, created_at, updated_at
        FROM coverage
        """
    ))

    # Drop old table and rename new one
    op.drop_table('coverage')
    op.rename_table('coverage_new', 'coverage')


def downgrade():
    # Drop the temporary table if it exists
    op.execute(text('DROP TABLE IF EXISTS coverage_old'))
    
    # Create the old table structure with keyholder fields
    op.create_table(
        'coverage_old',
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

    # Copy data back, setting default values for keyholder fields
    op.execute(text(
        """
        INSERT INTO coverage_old (
            id, day_index, start_time, end_time, min_employees, max_employees,
            employee_types, requires_keyholder, keyholder_before_minutes,
            keyholder_after_minutes, created_at, updated_at
        )
        SELECT id, day_index, start_time, end_time, min_employees, max_employees,
               employee_types, requires_keyholder, 30, 30, created_at, updated_at
        FROM coverage
        """
    ))

    # Drop new table and rename old one back
    op.drop_table('coverage')
    op.rename_table('coverage_old', 'coverage') 