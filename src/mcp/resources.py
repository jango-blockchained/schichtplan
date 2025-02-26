"""
Resources for the ShiftWise MCP server.
These are functions that return data from the application.
"""
import sys
from pathlib import Path

# Add the parent directory to Python path to access backend modules
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.append(str(parent_dir))

from backend.models import db, Employee, Shift, Schedule, Settings, Absence
from backend.app import create_app

# Initialize the Flask app
app = create_app()

def greeting():
    """Returns a greeting message to verify the MCP server is running."""
    return {"message": "Welcome to ShiftWise MCP Server!"}

# Employee resources
def get_employees():
    """Get all employees from the database."""
    with app.app_context():
        employees = Employee.query.all()
        return [employee.to_dict() for employee in employees]

def get_employee(employee_id: str):
    """Get a specific employee by ID."""
    with app.app_context():
        employee = Employee.query.get(employee_id)
        if employee:
            return employee.to_dict()
        return {"error": f"Employee with ID {employee_id} not found"}

def get_employees_by_group(employee_group: str):
    """Get all employees in a specific group."""
    with app.app_context():
        employees = Employee.query.filter_by(employee_group=employee_group).all()
        return [employee.to_dict() for employee in employees]

def get_keyholders():
    """Get all employees who are keyholders."""
    with app.app_context():
        keyholders = Employee.query.filter_by(is_keyholder=True).all()
        return [employee.to_dict() for employee in keyholders]

# Shift resources
def get_shifts():
    """Get all shifts from the database."""
    with app.app_context():
        shifts = Shift.query.all()
        return [shift.to_dict() for shift in shifts]

def get_shift(shift_id: int):
    """Get a specific shift by ID."""
    with app.app_context():
        shift = Shift.query.get(shift_id)
        if shift:
            return shift.to_dict()
        return {"error": f"Shift with ID {shift_id} not found"}

def get_shifts_by_type(shift_type: str):
    """Get all shifts of a specific type."""
    with app.app_context():
        shifts = Shift.query.filter_by(shift_type=shift_type).all()
        return [shift.to_dict() for shift in shifts]

def get_shifts_by_employee(employee_id: str):
    """Get all shifts assigned to a specific employee."""
    with app.app_context():
        # This would need to be implemented based on your Shift model
        # For now, return a placeholder
        return {
            "message": f"Shifts for employee {employee_id}",
            "note": "This is a placeholder. The actual implementation would query shifts for the employee."
        }

def get_shifts_by_date(date: str):
    """Get all shifts on a specific date."""
    with app.app_context():
        # This would need to be implemented based on your Shift model
        # For now, return a placeholder
        return {
            "message": f"Shifts for date {date}",
            "note": "This is a placeholder. The actual implementation would query shifts for the date."
        }

def get_shifts_by_date_range(start_date: str, end_date: str):
    """Get all shifts within a date range."""
    with app.app_context():
        # This would need to be implemented based on your Shift model
        # For now, return a placeholder
        return {
            "message": f"Shifts from {start_date} to {end_date}",
            "note": "This is a placeholder. The actual implementation would query shifts within the date range."
        }

# Schedule resources
def get_schedules():
    """Get all schedules from the database."""
    with app.app_context():
        schedules = Schedule.query.all()
        return [schedule.to_dict() for schedule in schedules]

def get_schedule(schedule_id: int):
    """Get a specific schedule by ID."""
    with app.app_context():
        schedule = Schedule.query.get(schedule_id)
        if schedule:
            return schedule.to_dict()
        return {"error": f"Schedule with ID {schedule_id} not found"}

def get_schedule_by_date_range(start_date: str, end_date: str):
    """Get schedules within a date range."""
    with app.app_context():
        # This would need to be implemented based on your Schedule model
        # For now, return a placeholder
        return {
            "message": f"Schedules for {start_date} to {end_date}",
            "note": "This is a placeholder. The actual implementation would query schedules within the date range."
        }

def get_employee_schedule(employee_id: str):
    """Get all schedules for a specific employee."""
    with app.app_context():
        # This would need to be implemented based on your Schedule model
        # For now, return a placeholder
        return {
            "message": f"Schedules for employee {employee_id}",
            "note": "This is a placeholder. The actual implementation would query schedules for the employee."
        }

def get_current_schedule():
    """Get the current active schedule."""
    with app.app_context():
        # This would need to be implemented based on your Schedule model
        # For now, return a placeholder
        return {
            "message": "Current active schedule",
            "note": "This is a placeholder. The actual implementation would query the current active schedule."
        }

# Settings resources
def get_settings():
    """Get application settings."""
    with app.app_context():
        settings = Settings.query.first()
        if settings:
            return settings.to_dict()
        return {"error": "Settings not found"}

def get_store_hours():
    """Get store opening and closing hours."""
    with app.app_context():
        settings = Settings.query.first()
        if settings:
            return {
                "opening_time": settings.opening_time,
                "closing_time": settings.closing_time
            }
        return {"error": "Settings not found"}

# Absence resources
def get_absences():
    """Get all absences from the database."""
    with app.app_context():
        absences = Absence.query.all()
        return [absence.to_dict() for absence in absences]

def get_absence(absence_id: int):
    """Get a specific absence by ID."""
    with app.app_context():
        absence = Absence.query.get(absence_id)
        if absence:
            return absence.to_dict()
        return {"error": f"Absence with ID {absence_id} not found"}

def get_employee_absences(employee_id: str):
    """Get all absences for a specific employee."""
    with app.app_context():
        absences = Absence.query.filter_by(employee_id=employee_id).all()
        return [absence.to_dict() for absence in absences]

def get_absences_by_employee(employee_id: str):
    """Get all absences for a specific employee (alias for get_employee_absences)."""
    return get_employee_absences(employee_id)

# System resources
def get_system_info():
    """Get system information."""
    return {
        "name": "ShiftWise MCP Server",
        "version": "1.0.0",
        "database": "SQLite",
        "api_version": "1.0"
    }

def get_api_endpoints():
    """Get a list of available API endpoints."""
    return {
        "resources": [
            "greeting",
            "get_employees",
            "get_employee",
            "get_employees_by_group",
            "get_keyholders",
            "get_shifts",
            "get_shift",
            "get_shifts_by_type",
            "get_shifts_by_employee",
            "get_shifts_by_date",
            "get_shifts_by_date_range",
            "get_schedules",
            "get_schedule",
            "get_current_schedule",
            "get_schedule_by_date_range",
            "get_employee_schedule",
            "get_settings",
            "get_store_hours",
            "get_absences",
            "get_absence",
            "get_absences_by_employee",
            "get_system_info",
            "get_api_endpoints"
        ],
        "tools": [
            "create_employee",
            "update_employee",
            "delete_employee",
            "create_shift",
            "update_shift",
            "delete_shift",
            "assign_shift",
            "unassign_shift",
            "create_absence",
            "update_absence",
            "delete_absence",
            "generate_schedule",
            "publish_schedule",
            "export_schedule_pdf",
            "export_employee_schedule_pdf",
            "update_settings",
            "backup_database",
            "restore_database"
        ]
    }

# Query resources
def query_employee_availability(date: str):
    """Query employee availability for a specific date."""
    with app.app_context():
        # This would need to be implemented based on your models
        # For now, return a placeholder
        return {
            "message": f"Employee availability for {date}",
            "note": "This is a placeholder. The actual implementation would query employee availability."
        }

def query_schedule_conflicts(schedule_id: int):
    """Query conflicts in a specific schedule."""
    with app.app_context():
        # This would need to be implemented based on your models
        # For now, return a placeholder
        return {
            "message": f"Conflicts in schedule {schedule_id}",
            "note": "This is a placeholder. The actual implementation would query schedule conflicts."
        }

def query_employee_hours(employee_id: str, start_date: str, end_date: str):
    """Query hours worked by an employee within a date range."""
    with app.app_context():
        # This would need to be implemented based on your models
        # For now, return a placeholder
        return {
            "message": f"Hours worked by employee {employee_id} from {start_date} to {end_date}",
            "note": "This is a placeholder. The actual implementation would calculate employee hours."
        }

def query_shift_coverage(date: str):
    """Query shift coverage for a specific date."""
    with app.app_context():
        # This would need to be implemented based on your models
        # For now, return a placeholder
        return {
            "message": f"Shift coverage for {date}",
            "note": "This is a placeholder. The actual implementation would calculate shift coverage."
        } 