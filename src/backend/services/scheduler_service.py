"""
Scheduler Service Module

This module provides a service layer for scheduler operations, ensuring proper
Flask app context management and SQLAlchemy session handling.

It applies the monkey patch to fix SQLAlchemy app context issues for all
scheduler database operations.
"""

import logging
import traceback
from datetime import date, timedelta
from functools import wraps
import inspect

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("scheduler_service")

# Apply the monkey patch to fix SQLAlchemy issues
try:
    from src.backend.tools.debug.fix_scheduler_db import apply_monkey_patch
    patch_success = apply_monkey_patch()
    if not patch_success:
        logger.warning("Failed to apply scheduler resources monkey patch")
    else:
        logger.info("Successfully applied scheduler resources monkey patch")
except Exception as e:
    logger.error(f"Error applying monkey patch: {str(e)}")
    logger.error(traceback.format_exc())

# Create a Flask app instance
try:
    from src.backend.app import create_app
    app = create_app()
    logger.info("Successfully created Flask app instance")
except Exception as e:
    logger.error(f"Error creating Flask app: {str(e)}")
    logger.error(traceback.format_exc())
    app = None


class SchedulerService:
    """
    Service class for scheduler operations with proper context management.
    
    This service handles all scheduler operations including:
    - Loading scheduler resources
    - Generating schedules
    - Retrieving schedule data from the database
    
    All operations are performed within the Flask app context to ensure
    proper SQLAlchemy registration.
    """
    
    def __init__(self):
        """Initialize the scheduler service with app context management"""
        self.app = app
        logger.info("Initialized SchedulerService")
    
    def _ensure_app_context(func):
        """Decorator to ensure function runs within Flask app context"""
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            # Check if we're already in an app context
            if self.app is None:
                logger.error("Flask app is not available")
                return {
                    "success": False,
                    "error": "Flask app is not available for context management"
                }
                
            # Run the function within app context if not already in one
            try:
                with self.app.app_context():
                    logger.debug(f"Running {func.__name__} within app context")
                    return func(self, *args, **kwargs)
            except Exception as e:
                logger.error(f"Error in {func.__name__}: {str(e)}")
                logger.error(traceback.format_exc())
                return {
                    "success": False,
                    "error": str(e),
                    "message": f"An error occurred in {func.__name__}"
                }
                
        return wrapper
    
    @_ensure_app_context
    def generate_schedule(self, start_date, end_date, version=1, session_id=None):
        """
        Generate a schedule for the given date range.
        
        This method ensures all operations are performed within
        the Flask app context, and handles backward compatibility with
        different versions of the ScheduleGenerator class.
        
        Args:
            start_date (date): Start date for the schedule
            end_date (date): End date for the schedule
            version (int, optional): Version of the schedule generation algorithm. Defaults to 1.
            session_id (str, optional): Session ID for logging. Defaults to None.
            
        Returns:
            dict: Result of the schedule generation including:
                - success: Whether the generation was successful
                - entries: List of generated schedule entries (if successful)
                - error: Error message (if unsuccessful)
        """
        logger.info(f"Generating schedule from {start_date} to {end_date}, version={version}")
        
        try:
            # Import scheduler components
            from src.backend.services.scheduler.generator import ScheduleGenerator
            from src.backend.services.scheduler.resources import ScheduleResources
            
            # Initialize scheduler resources
            logger.info("Initializing scheduler resources")
            resources = ScheduleResources(start_date, end_date)
            
            # Load resources
            resources_loaded = resources.load()
            if not resources_loaded:
                logger.warning("Failed to load critical scheduler resources")
                return {
                    "success": False,
                    "message": "Failed to load critical scheduler resources",
                    "entries": []
                }
            
            # Check if resources were loaded properly
            if not hasattr(resources, 'employees') or not resources.employees:
                logger.warning("No employees loaded in scheduler resources")
                return {
                    "success": False,
                    "message": "No employees available for scheduling",
                    "entries": []
                }
            
            if not hasattr(resources, 'shifts') or not resources.shifts:
                logger.warning("No shifts loaded in scheduler resources")
                return {
                    "success": False,
                    "message": "No shifts available for scheduling",
                    "entries": []
                }
            
            # Initialize schedule generator
            logger.info("Initializing schedule generator")
            generator = ScheduleGenerator(resources)
            
            # Check which method to use (backward compatibility)
            logger.info("Checking available generator methods")
            
            # Check if generate_schedule exists and its signature
            if hasattr(generator, 'generate_schedule'):
                generate_method = generator.generate_schedule
                # Check if it accepts version parameter
                generate_sig = inspect.signature(generate_method)
                params = list(generate_sig.parameters.keys())
                
                if 'version' in params and 'session_id' in params:
                    logger.info("Using generate_schedule method with version and session_id")
                    result = generate_method(version=version, session_id=session_id)
                elif 'version' in params:
                    logger.info("Using generate_schedule method with version only")
                    result = generate_method(version=version)
                else:
                    logger.info("Using generate_schedule method without parameters")
                    result = generate_method()
            
            # Fall back to older generate method if needed
            elif hasattr(generator, 'generate'):
                generate_method = generator.generate
                # Check signature for backward compatibility
                generate_sig = inspect.signature(generate_method)
                params = list(generate_sig.parameters.keys())
                
                if 'version' in params:
                    logger.info("Using generate method with version parameter")
                    result = generate_method(version=version)
                else:
                    logger.info("Using generate method without parameters")
                    result = generate_method()
            else:
                logger.error("No generation method found in ScheduleGenerator")
                return {
                    "success": False,
                    "error": "No generation method available in scheduler",
                    "entries": []
                }
            
            logger.info(f"Schedule generation completed with result: {result is not None}")
            return {
                "success": True,
                "entries": result if result is not None else [],
                "message": "Schedule generated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error generating schedule: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e),
                "message": "An error occurred during schedule generation",
                "entries": []
            }
    
    @_ensure_app_context
    def get_schedule_data(self, start_date=None, end_date=None, employee_id=None):
        """
        Retrieve schedule entries from the database.
        
        Args:
            start_date (date, optional): Start date for filtering. Defaults to None.
            end_date (date, optional): End date for filtering. Defaults to None.
            employee_id (int, optional): Employee ID for filtering. Defaults to None.
            
        Returns:
            dict: Result containing:
                - success: Whether the retrieval was successful
                - entries: List of schedule entries
                - error: Error message (if unsuccessful)
        """
        logger.info(f"Retrieving schedule data: {start_date} to {end_date}, employee={employee_id}")
        
        try:
            # Import the models directly
            from src.backend.models import Schedule, Employee, ShiftTemplate, db
            
            # Build query with filters
            query = db.session.query(
                Schedule, 
                Employee, 
                ShiftTemplate
            ).join(
                Employee, 
                Schedule.employee_id == Employee.id
            ).join(
                ShiftTemplate, 
                Schedule.shift_id == ShiftTemplate.id
            )
            
            # Apply date filters if provided
            if start_date:
                query = query.filter(Schedule.date >= start_date)
            if end_date:
                query = query.filter(Schedule.date <= end_date)
            if employee_id:
                query = query.filter(Schedule.employee_id == employee_id)
                
            # Execute query
            results = query.all()
            
            # Format results
            entries = []
            for entry, employee, shift in results:
                entries.append({
                    "id": entry.id,
                    "date": entry.date.isoformat() if hasattr(entry.date, 'isoformat') else str(entry.date),
                    "employee_id": entry.employee_id,
                    "employee_name": f"{employee.first_name} {employee.last_name}",
                    "shift_id": entry.shift_id,
                    "shift_name": shift.name,
                    "shift_start": shift.start_time,
                    "shift_end": shift.end_time
                })
            
            logger.info(f"Retrieved {len(entries)} schedule entries")
            return {
                "success": True,
                "entries": entries,
                "message": f"Retrieved {len(entries)} schedule entries"
            }
            
        except Exception as e:
            logger.error(f"Error retrieving schedule data: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e),
                "message": "An error occurred while retrieving schedule data",
                "entries": []
            }
    
    @_ensure_app_context
    def load_resources(self, start_date=None, end_date=None):
        """
        Load scheduler resources for diagnostics and testing.
        
        Args:
            start_date (date, optional): Start date for resources. Defaults to today.
            end_date (date, optional): End date for resources. Defaults to a week from today.
            
        Returns:
            dict: Summary of loaded resources and any errors encountered
        """
        logger.info(f"Loading scheduler resources: {start_date} to {end_date}")
        
        # Set default dates if not provided
        if start_date is None:
            start_date = date.today()
        if end_date is None:
            end_date = start_date + timedelta(days=6)
            
        logger.info(f"Using date range: {start_date} to {end_date}")
        
        try:
            # Import scheduler resources
            from src.backend.services.scheduler.resources import ScheduleResources
            
            # Initialize resources and load them
            resources = ScheduleResources(start_date, end_date)
            load_result = resources.load()
            
            # Check what was loaded
            settings_loaded = hasattr(resources, 'settings') and resources.settings is not None
            employees_loaded = hasattr(resources, 'employees') and len(resources.employees) > 0
            shifts_loaded = hasattr(resources, 'shifts') and len(resources.shifts) > 0
            
            # Get counts
            employee_count = len(resources.employees) if hasattr(resources, 'employees') else 0
            shift_count = len(resources.shifts) if hasattr(resources, 'shifts') else 0
            
            # Calculate coverage count
            coverage_count = 0
            if hasattr(resources, 'coverage'):
                for date_str, day_coverage in resources.coverage.items():
                    coverage_count += len(day_coverage)
            
            # Check for critical issues
            has_critical_issues = False
            critical_messages = []
            
            if not settings_loaded:
                has_critical_issues = True
                critical_messages.append("Settings not loaded")
                
            if not employees_loaded:
                has_critical_issues = True
                critical_messages.append("No employees loaded")
                
            if not shifts_loaded:
                has_critical_issues = True
                critical_messages.append("No shifts loaded")
            
            # Prepare result
            result = {
                "success": load_result and not has_critical_issues,
                "settings": settings_loaded,
                "employees": {
                    "loaded": employees_loaded,
                    "count": employee_count
                },
                "shifts": {
                    "loaded": shifts_loaded,
                    "count": shift_count
                },
                "coverage": {
                    "loaded": coverage_count > 0,
                    "count": coverage_count
                }
            }
            
            if has_critical_issues:
                result["message"] = "Critical resources missing: " + ", ".join(critical_messages)
            else:
                result["message"] = "All critical resources loaded successfully"
                
            logger.info(f"Resource loading completed: {result['message']}")
            return result
            
        except Exception as e:
            logger.error(f"Error loading scheduler resources: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "success": False,
                "error": str(e),
                "message": "An error occurred while loading scheduler resources"
            }


# Create a global scheduler service instance for easier access
_service = SchedulerService()

# Helper functions that use the global service instance
def generate_schedule(start_date, end_date, version=1, session_id=None):
    """
    Generate a schedule for the given date range.
    
    This helper function uses the global SchedulerService instance.
    
    Args:
        start_date (date): Start date for the schedule
        end_date (date): End date for the schedule
        version (int, optional): Version of the schedule generation algorithm. Defaults to 1.
        session_id (str, optional): Session ID for logging. Defaults to None.
        
    Returns:
        dict: Result of the schedule generation
    """
    return _service.generate_schedule(start_date, end_date, version, session_id)

def get_schedule_data(start_date=None, end_date=None, employee_id=None):
    """
    Retrieve schedule entries from the database.
    
    This helper function uses the global SchedulerService instance.
    
    Args:
        start_date (date, optional): Start date for filtering. Defaults to None.
        end_date (date, optional): End date for filtering. Defaults to None.
        employee_id (int, optional): Employee ID for filtering. Defaults to None.
        
    Returns:
        dict: Result containing schedule entries
    """
    return _service.get_schedule_data(start_date, end_date, employee_id)

def load_resources(start_date=None, end_date=None):
    """
    Load scheduler resources for diagnostics and testing.
    
    This helper function uses the global SchedulerService instance.
    
    Args:
        start_date (date, optional): Start date for resources. Defaults to today.
        end_date (date, optional): End date for resources. Defaults to a week from today.
        
    Returns:
        dict: Summary of loaded resources
    """
    return _service.load_resources(start_date, end_date) 