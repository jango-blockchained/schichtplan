"""Add hours_on_absence and working_days_per_week to employee_types

Revision ID: add_employee_type_fields
Revises: add_event_types_column
Create Date: 2025-11-06 08:52:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'add_employee_type_fields'
down_revision = 'add_event_types_column'
branch_labels = None
depends_on = None


def upgrade():
    """
    Update employee_types JSON field to include hours_on_absence and working_days_per_week
    for existing records.
    """
    connection = op.get_bind()
    
    # Get all settings records
    result = connection.execute(text("SELECT id, employee_types FROM settings"))
    
    for row in result:
        settings_id = row[0]
        employee_types = row[1]
        
        if employee_types:
            import json
            types_list = json.loads(employee_types) if isinstance(employee_types, str) else employee_types
            
            # Update each employee type with default values if not present
            for emp_type in types_list:
                if 'hours_on_absence' not in emp_type:
                    # Default based on type
                    if emp_type['id'] in ['VZ', 'TL']:
                        emp_type['hours_on_absence'] = 8.0
                    elif emp_type['id'] == 'TZ':
                        emp_type['hours_on_absence'] = 6.0
                    elif emp_type['id'] == 'GFB':
                        emp_type['hours_on_absence'] = 4.0
                    else:
                        emp_type['hours_on_absence'] = 8.0
                
                if 'working_days_per_week' not in emp_type:
                    # Default: 5 days for most, 6 for TL
                    if emp_type['id'] == 'TL':
                        emp_type['working_days_per_week'] = 6
                    else:
                        emp_type['working_days_per_week'] = 5
            
            # Update the record
            connection.execute(
                text("UPDATE settings SET employee_types = :types WHERE id = :id"),
                {"types": json.dumps(types_list), "id": settings_id}
            )


def downgrade():
    """
    Remove hours_on_absence and working_days_per_week from employee_types JSON field.
    """
    connection = op.get_bind()
    
    # Get all settings records
    result = connection.execute(text("SELECT id, employee_types FROM settings"))
    
    for row in result:
        settings_id = row[0]
        employee_types = row[1]
        
        if employee_types:
            import json
            types_list = json.loads(employee_types) if isinstance(employee_types, str) else employee_types
            
            # Remove the new fields from each employee type
            for emp_type in types_list:
                emp_type.pop('hours_on_absence', None)
                emp_type.pop('working_days_per_week', None)
            
            # Update the record
            connection.execute(
                text("UPDATE settings SET employee_types = :types WHERE id = :id"),
                {"types": json.dumps(types_list), "id": settings_id}
            )
