"""Add keyholder fields to coverage table

Revision ID: add_keyholder_fields
Revises: 25cf2b5a118c
Create Date: 2025-02-26 21:43:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic.
revision = 'add_keyholder_fields'
down_revision = '25cf2b5a118c'
branch_labels = None
depends_on = None

def upgrade():
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

    # Copy data from the old table to the new table
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    if 'coverage' in inspector.get_table_names():
        conn.execute(
            '''
            INSERT INTO coverage_new (
                id, day_index, start_time, end_time, min_employees, max_employees,
                employee_types, created_at, updated_at
            )
            SELECT id, day_index, start_time, end_time, min_employees, max_employees,
                   employee_types, created_at, updated_at
            FROM coverage;
            '''
        )

    # Drop the old table and rename the new one
    op.drop_table('coverage')
    op.rename_table('coverage_new', 'coverage')

def downgrade():
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
    conn = op.get_bind()
    conn.execute(
        '''
        INSERT INTO coverage_old (
            id, day_index, start_time, end_time, min_employees, max_employees,
            employee_types, created_at, updated_at
        )
        SELECT id, day_index, start_time, end_time, min_employees, max_employees,
               employee_types, created_at, updated_at
        FROM coverage;
        '''
    )

    # Drop the new table and rename the old one back
    op.drop_table('coverage')
    op.rename_table('coverage_old', 'coverage') 