"""
Tools for the ShiftWise MCP server.
These are functions that can be called by Claude to perform actions in the application.
"""
import sys
from pathlib import Path
from datetime import datetime

# Add the parent directory to Python path to access backend modules
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.append(str(parent_dir))

from backend.models import db, Employee, Shift, Schedule, Settings, Absence
from backend.app import create_app

# Initialize the Flask app
app = create_app()

# Employee tools
def create_employee(first_name: str, last_name: str, employee_group: str, contracted_hours: float, is_keyholder: bool = False):
    """
    Create a new employee in the database.
    
    Args:
        first_name: Employee's first name
        last_name: Employee's last name
        employee_group: Employee group (VL, TZ, GfB, TL)
        contracted_hours: Contracted weekly hours
        is_keyholder: Whether the employee is a keyholder
        
    Returns:
        The created employee data
    """
    with app.app_context():
        try:
            employee = Employee(
                first_name=first_name,
                last_name=last_name,
                employee_group=employee_group,
                contracted_hours=contracted_hours,
                is_keyholder=is_keyholder
            )
            db.session.add(employee)
            db.session.commit()
            return {"success": True, "employee": employee.to_dict()}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def update_employee(employee_id: str, **kwargs):
    """
    Update an existing employee in the database.
    
    Args:
        employee_id: The ID of the employee to update
        **kwargs: Fields to update (first_name, last_name, employee_group, contracted_hours, is_keyholder)
        
    Returns:
        The updated employee data
    """
    with app.app_context():
        try:
            employee = Employee.query.get(employee_id)
            if not employee:
                return {"success": False, "error": f"Employee with ID {employee_id} not found"}
            
            for key, value in kwargs.items():
                if hasattr(employee, key):
                    setattr(employee, key, value)
            
            db.session.commit()
            return {"success": True, "employee": employee.to_dict()}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def delete_employee(employee_id: str):
    """
    Delete an employee from the database.
    
    Args:
        employee_id: The ID of the employee to delete
        
    Returns:
        Success status
    """
    with app.app_context():
        try:
            employee = Employee.query.get(employee_id)
            if not employee:
                return {"success": False, "error": f"Employee with ID {employee_id} not found"}
            
            db.session.delete(employee)
            db.session.commit()
            return {"success": True, "message": f"Employee {employee_id} deleted successfully"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

# Schedule tools
def generate_schedule(start_date: str, end_date: str):
    """
    Generate a new schedule for the specified date range.
    
    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        
    Returns:
        The generated schedule data
    """
    # This would call the schedule generation algorithm
    # For now, return a placeholder
    return {
        "success": True, 
        "message": f"Schedule generation requested for {start_date} to {end_date}",
        "note": "This is a placeholder. The actual implementation would call the schedule generation algorithm."
    }

def publish_schedule(schedule_id: int):
    """
    Publish a schedule to make it visible to employees.
    
    Args:
        schedule_id: The ID of the schedule to publish
        
    Returns:
        Success status
    """
    with app.app_context():
        try:
            schedule = Schedule.query.get(schedule_id)
            if not schedule:
                return {"success": False, "error": f"Schedule with ID {schedule_id} not found"}
            
            schedule.is_published = True
            db.session.commit()
            return {"success": True, "message": f"Schedule {schedule_id} published successfully"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def export_schedule_pdf(schedule_id: int):
    """
    Export a schedule as PDF.
    
    Args:
        schedule_id: The ID of the schedule to export
        
    Returns:
        PDF file data or error
    """
    # This would call the PDF generation functionality
    # For now, return a placeholder
    return {
        "success": True,
        "message": f"PDF export requested for schedule {schedule_id}",
        "note": "This is a placeholder. The actual implementation would generate a PDF file."
    }

def export_employee_schedule_pdf(employee_id: str, start_date: str, end_date: str):
    """
    Export a specific employee's schedule as PDF.
    
    Args:
        employee_id: The ID of the employee
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        
    Returns:
        PDF file data or error
    """
    # This would call the PDF generation functionality
    # For now, return a placeholder
    return {
        "success": True,
        "message": f"PDF export requested for employee {employee_id} from {start_date} to {end_date}",
        "note": "This is a placeholder. The actual implementation would generate a PDF file."
    }

# Shift tools
def create_shift(shift_type: str, start_time: str, end_time: str):
    """
    Create a new shift in the database.
    
    Args:
        shift_type: Type of shift (Früh, Mittel, Spät)
        start_time: Start time in HH:MM format
        end_time: End time in HH:MM format
        
    Returns:
        The created shift data
    """
    with app.app_context():
        try:
            shift = Shift(
                shift_type=shift_type,
                start_time=start_time,
                end_time=end_time
            )
            db.session.add(shift)
            db.session.commit()
            return {"success": True, "shift": shift.to_dict()}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def update_shift(shift_id: int, **kwargs):
    """
    Update an existing shift in the database.
    
    Args:
        shift_id: The ID of the shift to update
        **kwargs: Fields to update (shift_type, start_time, end_time)
        
    Returns:
        The updated shift data
    """
    with app.app_context():
        try:
            shift = Shift.query.get(shift_id)
            if not shift:
                return {"success": False, "error": f"Shift with ID {shift_id} not found"}
            
            for key, value in kwargs.items():
                if hasattr(shift, key):
                    setattr(shift, key, value)
            
            db.session.commit()
            return {"success": True, "shift": shift.to_dict()}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def delete_shift(shift_id: int):
    """
    Delete a shift from the database.
    
    Args:
        shift_id: The ID of the shift to delete
        
    Returns:
        Success status
    """
    with app.app_context():
        try:
            shift = Shift.query.get(shift_id)
            if not shift:
                return {"success": False, "error": f"Shift with ID {shift_id} not found"}
            
            db.session.delete(shift)
            db.session.commit()
            return {"success": True, "message": f"Shift {shift_id} deleted successfully"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def assign_shift(shift_id: int, employee_id: str):
    """
    Assign a shift to an employee.
    
    Args:
        shift_id: The ID of the shift to assign
        employee_id: The ID of the employee to assign the shift to
        
    Returns:
        Success status
    """
    with app.app_context():
        try:
            shift = Shift.query.get(shift_id)
            if not shift:
                return {"success": False, "error": f"Shift with ID {shift_id} not found"}
            
            employee = Employee.query.get(employee_id)
            if not employee:
                return {"success": False, "error": f"Employee with ID {employee_id} not found"}
            
            shift.employee_id = employee_id
            db.session.commit()
            return {"success": True, "message": f"Shift {shift_id} assigned to employee {employee_id}"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def unassign_shift(shift_id: int):
    """
    Unassign a shift from an employee.
    
    Args:
        shift_id: The ID of the shift to unassign
        
    Returns:
        Success status
    """
    with app.app_context():
        try:
            shift = Shift.query.get(shift_id)
            if not shift:
                return {"success": False, "error": f"Shift with ID {shift_id} not found"}
            
            shift.employee_id = None
            db.session.commit()
            return {"success": True, "message": f"Shift {shift_id} unassigned"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

# Absence tools
def create_absence(employee_id: str, start_date: str, end_date: str, reason: str):
    """
    Create a new absence record in the database.
    
    Args:
        employee_id: The ID of the employee
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        reason: Reason for absence
        
    Returns:
        The created absence data
    """
    with app.app_context():
        try:
            # Convert string dates to datetime objects
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            
            absence = Absence(
                employee_id=employee_id,
                start_date=start_date_obj,
                end_date=end_date_obj,
                reason=reason
            )
            db.session.add(absence)
            db.session.commit()
            return {"success": True, "absence": absence.to_dict()}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def update_absence(absence_id: int, **kwargs):
    """
    Update an existing absence record in the database.
    
    Args:
        absence_id: The ID of the absence to update
        **kwargs: Fields to update (start_date, end_date, reason)
        
    Returns:
        The updated absence data
    """
    with app.app_context():
        try:
            absence = Absence.query.get(absence_id)
            if not absence:
                return {"success": False, "error": f"Absence with ID {absence_id} not found"}
            
            for key, value in kwargs.items():
                if key in ['start_date', 'end_date'] and isinstance(value, str):
                    # Convert string dates to datetime objects
                    value = datetime.strptime(value, "%Y-%m-%d").date()
                
                if hasattr(absence, key):
                    setattr(absence, key, value)
            
            db.session.commit()
            return {"success": True, "absence": absence.to_dict()}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

def delete_absence(absence_id: int):
    """
    Delete an absence record from the database.
    
    Args:
        absence_id: The ID of the absence to delete
        
    Returns:
        Success status
    """
    with app.app_context():
        try:
            absence = Absence.query.get(absence_id)
            if not absence:
                return {"success": False, "error": f"Absence with ID {absence_id} not found"}
            
            db.session.delete(absence)
            db.session.commit()
            return {"success": True, "message": f"Absence {absence_id} deleted successfully"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

# Settings tools
def update_settings(**kwargs):
    """
    Update application settings.
    
    Args:
        **kwargs: Settings to update
        
    Returns:
        The updated settings data
    """
    with app.app_context():
        try:
            settings = Settings.query.first()
            if not settings:
                settings = Settings()
                db.session.add(settings)
            
            for key, value in kwargs.items():
                if hasattr(settings, key):
                    setattr(settings, key, value)
            
            db.session.commit()
            return {"success": True, "settings": settings.to_dict()}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": str(e)}

# Database tools
def backup_database():
    """
    Create a backup of the database.
    
    Returns:
        Success status
    """
    # This would call the database backup functionality
    # For now, return a placeholder
    return {
        "success": True,
        "message": "Database backup requested",
        "note": "This is a placeholder. The actual implementation would create a database backup."
    }

def restore_database(backup_file: str):
    """
    Restore the database from a backup file.
    
    Args:
        backup_file: Path to the backup file
        
    Returns:
        Success status
    """
    # This would call the database restore functionality
    # For now, return a placeholder
    return {
        "success": True,
        "message": f"Database restore requested from {backup_file}",
        "note": "This is a placeholder. The actual implementation would restore the database from the backup file."
    } 