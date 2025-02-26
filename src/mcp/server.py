import os
import sys
from flask import Flask

# Add the src directory to the path to access backend modules
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.dirname(os.path.dirname(current_dir))
if src_dir not in sys.path:
    sys.path.append(src_dir)

# Import backend modules
from backend.routes import shifts as resources  # Temporary mapping until we create proper resources
from backend.services import tools  # We'll need to create this

class FastMCP:
    def __init__(self, app):
        self.app = app
        self._setup_resources()
        self._setup_tools()
    
    def _setup_resources(self):
        # Register resources with proper URLs
        self.resource('http://localhost:8000/greeting')(resources.greeting)
        self.resource('http://localhost:8000/employees')(resources.get_employees)
        self.resource('http://localhost:8000/employees/{employee_id}')(resources.get_employee)
        self.resource('http://localhost:8000/employees/group/{employee_group}')(resources.get_employees_by_group)
        self.resource('http://localhost:8000/shifts')(resources.get_shifts)
        self.resource('http://localhost:8000/shifts/{shift_id}')(resources.get_shift)
        self.resource('http://localhost:8000/shifts/employee/{employee_id}')(resources.get_shifts_by_employee)
        self.resource('http://localhost:8000/shifts/date/{date}')(resources.get_shifts_by_date)
        self.resource('http://localhost:8000/shifts/date_range/{start_date}/{end_date}')(resources.get_shifts_by_date_range)
        self.resource('http://localhost:8000/schedules')(resources.get_schedules)
        self.resource('http://localhost:8000/schedules/{schedule_id}')(resources.get_schedule)
        self.resource('http://localhost:8000/schedules/current')(resources.get_current_schedule)
        self.resource('http://localhost:8000/absences')(resources.get_absences)
        self.resource('http://localhost:8000/absences/{absence_id}')(resources.get_absence)
        self.resource('http://localhost:8000/absences/employee/{employee_id}')(resources.get_absences_by_employee)
        self.resource('http://localhost:8000/settings')(resources.get_settings)
        self.resource('http://localhost:8000/system_info')(resources.get_system_info)

        # Register query resources
        self.resource('http://localhost:8000/query/employee_availability/{date}')(resources.query_employee_availability)
        self.resource('http://localhost:8000/query/schedule_conflicts/{schedule_id}')(resources.query_schedule_conflicts)
        self.resource('http://localhost:8000/query/employee_hours/{employee_id}/{start_date}/{end_date}')(resources.query_employee_hours)
        self.resource('http://localhost:8000/query/shift_coverage/{date}')(resources.query_shift_coverage)

    def _setup_tools(self):
        # Register tools
        self.tool('create_employee')(tools.create_employee)
        self.tool('update_employee')(tools.update_employee)
        self.tool('delete_employee')(tools.delete_employee)
        self.tool('create_shift')(tools.create_shift)
        self.tool('update_shift')(tools.update_shift)
        self.tool('delete_shift')(tools.delete_shift)
        self.tool('assign_shift')(tools.assign_shift)
        self.tool('unassign_shift')(tools.unassign_shift)
        self.tool('create_absence')(tools.create_absence)
        self.tool('update_absence')(tools.update_absence)
        self.tool('delete_absence')(tools.delete_absence)
        self.tool('generate_schedule')(tools.generate_schedule)
        self.tool('publish_schedule')(tools.publish_schedule)
        self.tool('export_schedule_pdf')(tools.export_schedule_pdf)
        self.tool('export_employee_schedule_pdf')(tools.export_employee_schedule_pdf)
        self.tool('update_settings')(tools.update_settings)
        self.tool('backup_database')(tools.backup_database)
        self.tool('restore_database')(tools.restore_database)

    def resource(self, url):
        def decorator(f):
            self.app.route(url)(f)
            return f
        return decorator

    def tool(self, name):
        def decorator(f):
            setattr(self, name, f)
            return f
        return decorator 