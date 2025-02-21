"""update employee and absence types

Revision ID: update_employee_and_absence_types
Revises: fix_employee_group_enum
Create Date: 2024-02-21 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import json

# revision identifiers, used by Alembic.
revision = 'update_employee_and_absence_types'
down_revision = 'fix_employee_group_enum'
branch_labels = None
depends_on = None

def upgrade():
    # Get the settings row
    connection = op.get_bind()
    settings = connection.execute(text("SELECT id, employee_types, absence_types FROM settings")).fetchone()
    
    if settings:
        # Update employee types to match the enum
        new_employee_types = [
            {'id': 'VL', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 48},
            {'id': 'TZ', 'name': 'Teilzeit', 'min_hours': 0, 'max_hours': 34},
            {'id': 'GFB', 'name': 'Geringfügig Beschäftigt', 'min_hours': 0, 'max_hours': 12},
            {'id': 'TL', 'name': 'Team Leader', 'min_hours': 35, 'max_hours': 48}
        ]
        
        # Update absence types
        new_absence_types = [
            {'id': 'URL', 'name': 'Urlaub', 'color': '#4CAF50'},  # Green
            {'id': 'ABW', 'name': 'Abwesend', 'color': '#FFC107'}  # Amber
        ]
        
        # Update the settings row
        connection.execute(
            text("UPDATE settings SET employee_types = :employee_types, absence_types = :absence_types WHERE id = :id"),
            {
                'id': settings[0],
                'employee_types': json.dumps(new_employee_types),
                'absence_types': json.dumps(new_absence_types)
            }
        )

def downgrade():
    # Get the settings row
    connection = op.get_bind()
    settings = connection.execute(text("SELECT id FROM settings")).fetchone()
    
    if settings:
        # Restore original employee types
        old_employee_types = [
            {'id': 'full_time', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 40},
            {'id': 'part_time', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
            {'id': 'mini_job', 'name': 'Minijob', 'min_hours': 0, 'max_hours': 14}
        ]
        
        # Restore original absence types
        old_absence_types = [
            {'id': 'vacation', 'name': 'Urlaub', 'color': '#FF9800'},
            {'id': 'sick', 'name': 'Krank', 'color': '#F44336'},
            {'id': 'unpaid', 'name': 'Unbezahlt', 'color': '#9E9E9E'}
        ]
        
        # Update the settings row
        connection.execute(
            text("UPDATE settings SET employee_types = :employee_types, absence_types = :absence_types WHERE id = :id"),
            {
                'id': settings[0],
                'employee_types': json.dumps(old_employee_types),
                'absence_types': json.dumps(old_absence_types)
            }
        ) 