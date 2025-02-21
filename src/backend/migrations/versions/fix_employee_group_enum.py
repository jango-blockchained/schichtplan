"""fix employee group enum values

Revision ID: fix_employee_group_enum
Revises: fix_employee_group_case
Create Date: 2024-02-21 01:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'fix_employee_group_enum'
down_revision = 'fix_employee_group_case'
branch_labels = None
depends_on = None

def upgrade():
    # Create a new temporary column
    with op.batch_alter_table('employees') as batch_op:
        batch_op.add_column(sa.Column('employee_group_new', sa.String(50)))

    # Update the new column with corrected values
    op.execute("UPDATE employees SET employee_group_new = 'GFB' WHERE employee_group = 'GfB'")
    op.execute("UPDATE employees SET employee_group_new = employee_group WHERE employee_group != 'GfB'")

    # Drop the old column and rename the new one
    with op.batch_alter_table('employees') as batch_op:
        batch_op.drop_column('employee_group')
        batch_op.alter_column('employee_group_new', new_column_name='employee_group')

def downgrade():
    # Create a new temporary column
    with op.batch_alter_table('employees') as batch_op:
        batch_op.add_column(sa.Column('employee_group_new', sa.String(50)))

    # Update the new column with old values
    op.execute("UPDATE employees SET employee_group_new = 'GfB' WHERE employee_group = 'GFB'")
    op.execute("UPDATE employees SET employee_group_new = employee_group WHERE employee_group != 'GFB'")

    # Drop the old column and rename the new one
    with op.batch_alter_table('employees') as batch_op:
        batch_op.drop_column('employee_group')
        batch_op.alter_column('employee_group_new', new_column_name='employee_group') 