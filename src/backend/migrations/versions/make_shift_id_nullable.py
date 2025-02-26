"""Make shift_id nullable

Revision ID: make_shift_id_nullable
Revises: 
Create Date: 2024-02-26 23:19:28.795

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'make_shift_id_nullable'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Drop the temporary table if it exists
    op.execute(text('DROP TABLE IF EXISTS schedules_new'))
    
    # Create new table with nullable shift_id
    op.create_table(
        'schedules_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ondelete='SET NULL')
    )

    # Copy data from old table if it exists
    op.execute(text(
        """
        INSERT INTO schedules_new 
        SELECT id, employee_id, shift_id, date, created_at, updated_at 
        FROM schedules
        """
    ))

    # Drop old table and rename new one
    op.drop_table('schedules')
    op.rename_table('schedules_new', 'schedules')


def downgrade():
    # Create old table structure
    op.execute(text('DROP TABLE IF EXISTS schedules_old'))
    op.create_table(
        'schedules_old',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'])
    )

    # Copy data back, excluding NULL shift_ids
    op.execute(text(
        """
        INSERT INTO schedules_old 
        SELECT id, employee_id, shift_id, date, created_at, updated_at 
        FROM schedules 
        WHERE shift_id IS NOT NULL
        """
    ))

    # Drop new table and rename old one back
    op.drop_table('schedules')
    op.rename_table('schedules_old', 'schedules') 