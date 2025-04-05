"""
Scheduler service for managing and generating schedules with proper app context.
This service ensures all database operations run with the correct Flask app context
and SQLAlchemy session.
"""

import sys
import os
import logging
import traceback
from datetime import date, timedelta
from functools import wraps
from typing import Dict, List, Optional, Any, Union, Callable

# Setup logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Add parent directory to path for imports if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Import the app factory and db
from src.backend.app import create_app
from src.backend.models import db

class SchedulerService:
    """
    Service for managing schedule generation and data retrieval with proper app context.
    This service ensures all database operations run with the correct Flask app context.
    """

    def __init__(self):
        """Initialize the scheduler service with Flask app"""
        self.app = None
        self._init_app()
        logger.info("[SCHEDULER SERVICE] Initialized scheduler service")

    def _init_app(self):
        """Initialize the Flask app and register it with the database"""
        if self.app is None:
            # Create the Flask app - this already registers the database in create_app()
            self.app = create_app()
            logger.info("[SCHEDULER SERVICE] Created Flask app for scheduler service")

    def generate_schedule(self, start_date: date, end_date: date, 
                         version: int = 1, **kwargs) -> Dict[str, Any]:
        """
        Generate a schedule for the specified date range using the scheduler.
        Ensures operations run within Flask app context.
        
        Args:
            start_date: Starting date for the schedule
            end_date: Ending date for the schedule
            version: Schedule version number (default: 1)
            **kwargs: Additional keyword arguments for the scheduler
            
        Returns:
            Dict containing the generation result with success flag and message
        """
        try:
            # Import scheduler components here to ensure they use the correct app context
            from src.backend.services.scheduler import ScheduleGenerator
            from src.backend.services.scheduler.resources import ScheduleResources
            
            logger.info(f"[SCHEDULER SERVICE] Generating schedule from {start_date} to {end_date}, version {version}")
            
            # Push app context for the database operations
            with self.app.app_context():
                # Initialize the schedule generator
                generator = ScheduleGenerator(logger=logger)
                
                # Determine if we should use the generate() or generate_schedule() method
                # based on what's available in the ScheduleGenerator class
                if hasattr(generator, 'generate_schedule') and callable(getattr(generator, 'generate_schedule')):
                    # Use the newer generate_schedule method if available
                    result = generator.generate_schedule(
                        start_date=start_date,
                        end_date=end_date,
                        version=version,
                        **kwargs
                    )
                else:
                    # Use the older generate method
                    session_id = kwargs.get('session_id', 'default_session')
                    result = generator.generate(
                        start_date=start_date,
                        end_date=end_date,
                        version=version,
                        session_id=session_id
                    )
                    
                logger.info(f"[SCHEDULER SERVICE] Schedule generation completed: {result.get('success', False)}")
                return result
                
        except Exception as e:
            logger.error(f"[SCHEDULER SERVICE] Error generating schedule: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Error generating schedule: {str(e)}",
                "error": traceback.format_exc()
            }

    def get_schedule_data(self, start_date: Optional[date] = None, 
                         end_date: Optional[date] = None,
                         employee_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Retrieve schedule entries from the database, optionally filtered by date range and employee.
        Ensures operations run within Flask app context.
        
        Args:
            start_date: Optional starting date for filtering
            end_date: Optional ending date for filtering
            employee_id: Optional employee ID for filtering
            
        Returns:
            Dict containing schedule data with success flag
        """
        try:
            # Push app context for the database operations
            with self.app.app_context():
                # Import models here to ensure they use the correct context
                from src.backend.models import Schedule
                
                query = Schedule.query
                
                # Apply filters if provided
                if start_date:
                    query = query.filter(Schedule.date >= start_date)
                if end_date:
                    query = query.filter(Schedule.date <= end_date)
                if employee_id:
                    query = query.filter(Schedule.employee_id == employee_id)
                
                # Execute query and get results
                entries = query.all()
                
                # Prepare response data
                schedule_entries = []
                for entry in entries:
                    schedule_entries.append({
                        "id": entry.id,
                        "date": entry.date.isoformat() if hasattr(entry.date, 'isoformat') else str(entry.date),
                        "employee_id": entry.employee_id,
                        "shift_id": entry.shift_id,
                        "version": getattr(entry, 'version', 1),
                        # Add other fields as needed
                    })
                
                logger.info(f"[SCHEDULER SERVICE] Retrieved {len(schedule_entries)} schedule entries")
                return {
                    "success": True,
                    "entries": schedule_entries,
                    "count": len(schedule_entries)
                }
                
        except Exception as e:
            logger.error(f"[SCHEDULER SERVICE] Error retrieving schedule data: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Error retrieving schedule data: {str(e)}",
                "error": traceback.format_exc(),
                "entries": []
            }

    def load_resources(self, start_date: Optional[date] = None, 
                      end_date: Optional[date] = None) -> Dict[str, Any]:
        """
        Load scheduler resources for diagnostics and testing.
        Ensures operations run within Flask app context.
        
        Args:
            start_date: Optional starting date for resource loading
            end_date: Optional ending date for resource loading
            
        Returns:
            Dict containing loaded resources summary
        """
        try:
            # Set default dates if not provided
            if not start_date:
                start_date = date.today()
            if not end_date:
                end_date = start_date + timedelta(days=6)  # Default to one week
            
            logger.info(f"[SCHEDULER SERVICE] Loading resources for {start_date} to {end_date}")
            
            # Push app context for the database operations
            with self.app.app_context():
                # Import resource class here to ensure correct context
                from src.backend.services.scheduler.resources import ScheduleResources
                
                # Initialize resources with date range
                resources = ScheduleResources(start_date=start_date, end_date=end_date)
                
                # Load all resources
                success = resources.load()
                
                # Create summary of loaded resources
                resource_summary = {
                    "success": success,
                    "date_range": {
                        "start_date": start_date.isoformat(),
                        "end_date": end_date.isoformat()
                    },
                    "employees": {
                        "count": len(resources.employees),
                        "ids": [emp.id for emp in resources.employees[:10]]  # First 10 employee IDs
                    },
                    "shifts": {
                        "count": len(resources.shifts),
                        "ids": [shift.id for shift in resources.shifts[:10]]  # First 10 shift IDs
                    },
                    "settings": resources.settings is not None,
                    "coverage": {
                        "count": len(resources.coverage)
                    }
                }
                
                logger.info(f"[SCHEDULER SERVICE] Resources loaded: {success}")
                return resource_summary
                
        except Exception as e:
            logger.error(f"[SCHEDULER SERVICE] Error loading resources: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Error loading resources: {str(e)}",
                "error": traceback.format_exc()
            }

# Create a global instance for easier access
_scheduler_service = SchedulerService()

# Helper functions that use the global service instance
def generate_schedule(start_date: date, end_date: date, version: int = 1, **kwargs) -> Dict[str, Any]:
    """Generate a schedule using the scheduler service"""
    return _scheduler_service.generate_schedule(start_date, end_date, version, **kwargs)

def get_schedule_data(start_date=None, end_date=None, employee_id=None) -> Dict[str, Any]:
    """Get schedule data using the scheduler service"""
    return _scheduler_service.get_schedule_data(start_date, end_date, employee_id)

def load_resources(start_date=None, end_date=None) -> Dict[str, Any]:
    """Load scheduler resources using the scheduler service"""
    return _scheduler_service.load_resources(start_date, end_date) 