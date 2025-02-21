"""fix employee group case

Revision ID: fix_employee_group_case
Revises: add_is_active_to_employees
Create Date: 2024-02-21 01:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'fix_employee_group_case'
down_revision = 'add_is_active_to_employees'
branch_labels = None
depends_on = None

def upgrade():
    # Fix the case of employee_group values
    op.execute("UPDATE employees SET employee_group = 'GFB' WHERE employee_group = 'GfB'")
    op.execute("UPDATE employees SET employee_group = 'VL' WHERE employee_group = 'Vl'")
    op.execute("UPDATE employees SET employee_group = 'TZ' WHERE employee_group = 'Tz'")
    op.execute("UPDATE employees SET employee_group = 'TL' WHERE employee_group = 'Tl'")

def downgrade():
    # No downgrade needed as this is a data fix
    pass 