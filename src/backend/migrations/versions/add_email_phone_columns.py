"""add email phone columns

Revision ID: add_email_phone_columns
Revises: add_employee_availability_table
Create Date: 2024-02-19 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_email_phone_columns'
down_revision = 'add_employee_availability_table'
branch_labels = None
depends_on = None


def upgrade():
    # Add email and phone columns to employees table
    op.add_column('employees', sa.Column('email', sa.String(100), nullable=True))
    op.add_column('employees', sa.Column('phone', sa.String(20), nullable=True))


def downgrade():
    # Remove email and phone columns from employees table
    op.drop_column('employees', 'email')
    op.drop_column('employees', 'phone') 