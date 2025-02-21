"""update employee columns

Revision ID: add_is_active_to_employees
Revises: add_active_days_to_shifts
Create Date: 2024-02-21 01:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_is_active_to_employees'
down_revision = 'add_active_days_to_shifts'
branch_labels = None
depends_on = None

def upgrade():
    # Update column constraints
    with op.batch_alter_table('employees') as batch_op:
        # Make is_active not nullable with default True
        batch_op.alter_column('is_active',
            existing_type=sa.Boolean(),
            nullable=False,
            server_default='1')

        # Update other columns to match the model
        batch_op.alter_column('employee_id',
            existing_type=sa.String(10),
            type_=sa.String(50),
            existing_nullable=True,
            nullable=False)
        batch_op.alter_column('first_name',
            existing_type=sa.String(50),
            type_=sa.String(100))
        batch_op.alter_column('last_name',
            existing_type=sa.String(50),
            type_=sa.String(100))
        batch_op.alter_column('email',
            existing_type=sa.String(100),
            type_=sa.String(120),
            existing_nullable=True)
        batch_op.alter_column('is_keyholder',
            existing_type=sa.Boolean(),
            nullable=False,
            server_default='0')

def downgrade():
    with op.batch_alter_table('employees') as batch_op:
        # Revert column constraints
        batch_op.alter_column('is_active',
            existing_type=sa.Boolean(),
            nullable=True,
            server_default=None)
        batch_op.alter_column('employee_id',
            existing_type=sa.String(50),
            type_=sa.String(10),
            existing_nullable=False,
            nullable=True)
        batch_op.alter_column('first_name',
            existing_type=sa.String(100),
            type_=sa.String(50))
        batch_op.alter_column('last_name',
            existing_type=sa.String(100),
            type_=sa.String(50))
        batch_op.alter_column('email',
            existing_type=sa.String(120),
            type_=sa.String(100))
        batch_op.alter_column('is_keyholder',
            existing_type=sa.Boolean(),
            nullable=True,
            server_default=None) 