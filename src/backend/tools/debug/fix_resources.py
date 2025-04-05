#!/usr/bin/env python
"""
Utility to fix the ScheduleResources class by wrapping it with proper Flask app context.
This provides a drop-in replacement for the ScheduleResources class that ensures
all database operations happen within a Flask app context.
"""

import sys
import os
import traceback
from datetime import date, timedelta
from functools import wraps

# Add the parent directory to Python path to ensure imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
project_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

class AppContextScheduleResources:
    """A wrapper around ScheduleResources that ensures all methods run within a Flask app context."""
    
    def __init__(self, start_date=None, end_date=None, verbose=False):
        """
        Initialize with optional date range and verbosity setting.
        
        Args:
            start_date: The start date for the schedule resources
            end_date: The end date for the schedule resources
            verbose: Whether to print verbose output
        """
        self.app = None
        self.verbose = verbose
        self.resources = None
        self.start_date = start_date if start_date else date.today()
        self.end_date = end_date if end_date else date.today() + timedelta(days=6)
        self._initialize()
    
    def _initialize(self):
        """Create and configure the app and ScheduleResources instance."""
        try:
            if self.verbose:
                print("Initializing app...")
            
            # Import the Flask app
            from src.backend.app import create_app
            
            # Create app instance
            self.app = create_app()
            
            if self.verbose:
                print("App created successfully")
            
            # Create the resources inside app context
            with self.app.app_context():
                from src.backend.services.scheduler.resources import ScheduleResources
                self.resources = ScheduleResources(
                    start_date=self.start_date,
                    end_date=self.end_date
                )
                
                if self.verbose:
                    print("ScheduleResources created successfully")
                    print(f"Date range: {self.start_date} to {self.end_date}")
        
        except Exception as e:
            print(f"Error initializing AppContextScheduleResources: {e}")
            traceback.print_exc()
            raise
    
    def _with_app_context(self, method_name, *args, **kwargs):
        """Run a method of the underlying resources object with app context."""
        try:
            with self.app.app_context():
                method = getattr(self.resources, method_name)
                result = method(*args, **kwargs)
                return result
        except Exception as e:
            if self.verbose:
                print(f"Error calling {method_name}: {e}")
                traceback.print_exc()
            raise
    
    def load(self):
        """Load all resources with app context."""
        if self.verbose:
            print("Loading resources...")
        return self._with_app_context('load')
    
    def is_loaded(self):
        """Check if resources are loaded with app context."""
        return self._with_app_context('is_loaded')
    
    def get_keyholders(self):
        """Get keyholders with app context."""
        return self._with_app_context('get_keyholders')
    
    def get_employees_by_group(self, group):
        """Get employees by group with app context."""
        return self._with_app_context('get_employees_by_group', group)
    
    def get_daily_coverage(self, day):
        """Get daily coverage with app context."""
        return self._with_app_context('get_daily_coverage', day)
    
    def get_employee_absences(self, employee_id, start_date, end_date):
        """Get employee absences with app context."""
        return self._with_app_context('get_employee_absences', employee_id, start_date, end_date)
    
    def get_employee_availability(self, employee_id, day_of_week):
        """Get employee availability with app context."""
        return self._with_app_context('get_employee_availability', employee_id, day_of_week)
    
    def is_employee_available(self, employee_id, day, start_hour, end_hour):
        """Check if an employee is available with app context."""
        return self._with_app_context('is_employee_available', employee_id, day, start_hour, end_hour)
    
    def get_schedule_data(self):
        """Get schedule data with app context."""
        return self._with_app_context('get_schedule_data')
    
    def add_schedule_entry(self, employee_id, date, schedule):
        """Add a schedule entry with app context."""
        return self._with_app_context('add_schedule_entry', employee_id, date, schedule)
    
    def get_schedule_entry(self, employee_id, date):
        """Get a schedule entry with app context."""
        return self._with_app_context('get_schedule_entry', employee_id, date)
    
    def remove_schedule_entry(self, employee_id, date):
        """Remove a schedule entry with app context."""
        return self._with_app_context('remove_schedule_entry', employee_id, date)
    
    def clear_schedule_data(self):
        """Clear schedule data with app context."""
        return self._with_app_context('clear_schedule_data')
    
    def get_employees(self):
        """Get all employees with app context."""
        return self._with_app_context('get_employees')
    
    def get_active_employees(self):
        """Get active employees with app context."""
        return self._with_app_context('get_active_employees')
    
    def get_employee(self, employee_id):
        """Get an employee by ID with app context."""
        return self._with_app_context('get_employee', employee_id)
    
    def get_employee_availabilities(self, employee_id, day):
        """Get employee availabilities with app context."""
        return self._with_app_context('get_employee_availabilities', employee_id, day)
    
    def get_shift(self, shift_id):
        """Get a shift by ID with app context."""
        return self._with_app_context('get_shift', shift_id)
    
    def verify_loaded_resources(self):
        """Verify loaded resources with app context."""
        if hasattr(self.resources, 'verify_loaded_resources'):
            return self._with_app_context('verify_loaded_resources')
        return True

# Utility function to get a pre-configured resources object
def get_resources(start_date=None, end_date=None, verbose=False):
    """
    Get an initialized AppContextScheduleResources instance.
    
    Args:
        start_date: The start date for the schedule resources
        end_date: The end date for the schedule resources
        verbose: Whether to print verbose output
        
    Returns:
        An initialized AppContextScheduleResources instance
    """
    return AppContextScheduleResources(
        start_date=start_date,
        end_date=end_date,
        verbose=verbose
    )

# Example usage
if __name__ == "__main__":
    resources = get_resources(verbose=True)
    load_success = resources.load()
    
    print("\n--- RESOURCES LOAD RESULT ---")
    print(f"Resources loaded successfully: {load_success}")
    
    if load_success:
        print(f"Employees loaded: {len(resources.resources.employees)}")
        print(f"Shifts loaded: {len(resources.resources.shifts)}")
        print(f"Coverage requirements loaded: {len(resources.resources.coverage)}")
        print(f"Absences loaded: {len(resources.resources.absences)}")
        print(f"Availabilities loaded: {len(resources.resources.availabilities)}")
        
        # Show first few employees
        for i, emp in enumerate(resources.resources.employees[:3]):
            print(f"  Employee {i+1}: {getattr(emp, 'first_name', '')} {getattr(emp, 'last_name', '')} "
                  f"- ID: {getattr(emp, 'id', 'Unknown')}")
        
        # Show first few shifts
        for i, shift in enumerate(resources.resources.shifts[:3]):
            print(f"  Shift {i+1}: {getattr(shift, 'start_time', '')}-{getattr(shift, 'end_time', '')} "
                  f"- ID: {getattr(shift, 'id', 'Unknown')}")
    else:
        print("Resources failed to load. Check the logs for details.") 