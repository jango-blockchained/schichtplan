"""add employee availability table

Revision ID: add_employee_availability_table
Revises: None
Create Date: 2024-03-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_employee_availability_table'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create employee_availabilities table
    op.create_table('employee_availabilities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('hour', sa.Integer(), nullable=False),
        sa.Column('is_available', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), onupdate=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create index for faster lookups
    op.create_index('idx_employee_availabilities_employee_id', 'employee_availabilities', ['employee_id'])
    op.create_index('idx_employee_availabilities_day_hour', 'employee_availabilities', ['day_of_week', 'hour'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_employee_availabilities_day_hour')
    op.drop_index('idx_employee_availabilities_employee_id')
    
    # Drop table
    op.drop_table('employee_availabilities') 