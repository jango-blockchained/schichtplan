#!/usr/bin/env python
"""
Wrapper for the scheduler that ensures proper Flask app context.
This provides a properly configured ScheduleGenerator that can be used independently.
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

class AppContextScheduler:
    """A class that provides a ScheduleGenerator with proper app context management."""
    
    def __init__(self, verbose=False):
        """Initialize with optional verbosity setting."""
        self.app = None
        self.verbose = verbose
        self.generator = None
        self._initialize()
    
    def _initialize(self):
        """Create and configure the app and scheduler generator."""
        try:
            if self.verbose:
                print("Initializing app...")
            
            # Import the Flask app
            from src.backend.app import create_app
            
            # Create app instance
            self.app = create_app()
            
            if self.verbose:
                print("App created successfully")
            
            # Create the generator inside app context to ensure it's properly initialized
            with self.app.app_context():
                from src.backend.services.scheduler import ScheduleGenerator
                self.generator = ScheduleGenerator()
                
                if self.verbose:
                    print("ScheduleGenerator created successfully")
        
        except Exception as e:
            print(f"Error initializing AppContextScheduler: {e}")
            traceback.print_exc()
            raise
    
    def generate_schedule(self, start_date=None, end_date=None, days=7, version=None, **kwargs):
        """
        Generate a schedule with proper app context.
        
        Args:
            start_date: The start date for the schedule
            end_date: The end date for the schedule
            days: Number of days if start_date is provided but not end_date
            version: Schedule version number
            **kwargs: Additional arguments for the generate method
            
        Returns:
            The result from the schedule generator
        """
        if not start_date:
            start_date = date.today()
        elif isinstance(start_date, str):
            from datetime import datetime
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            
        if not end_date:
            end_date = start_date + timedelta(days=days-1)
        elif isinstance(end_date, str):
            from datetime import datetime
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            
        if self.verbose:
            print(f"Generating schedule from {start_date} to {end_date}")
            
        try:
            # Always run inside app context
            with self.app.app_context():
                result = self.generator.generate(
                    start_date=start_date,
                    end_date=end_date,
                    version=version,
                    **kwargs
                )
                
                if self.verbose:
                    print("Schedule generation completed successfully")
                    
                return result
                
        except Exception as e:
            print(f"Error during schedule generation: {e}")
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "schedule": [],
                "warnings": [],
                "errors": [{
                    "type": "schedule_generation_error",
                    "message": str(e),
                    "details": traceback.format_exc()
                }]
            }

# Utility function to get a pre-configured scheduler
def get_scheduler(verbose=False):
    """Get an initialized AppContextScheduler instance."""
    return AppContextScheduler(verbose=verbose)

# Example usage
if __name__ == "__main__":
    scheduler = get_scheduler(verbose=True)
    today = date.today()
    result = scheduler.generate_schedule(
        start_date=today,
        end_date=today + timedelta(days=6),
        version=1
    )
    
    print("\n--- GENERATION RESULT ---")
    schedule_entries = result.get("schedule", [])
    print(f"Generated {len(schedule_entries)} schedule entries")
    
    # Check for entries with shifts
    entries_with_shifts = [e for e in schedule_entries if e.get("shift_id")]
    print(f"Entries with assigned shifts: {len(entries_with_shifts)}")
    
    # Check warnings and errors
    warnings = result.get("warnings", [])
    errors = result.get("errors", [])
    
    print(f"\nWarnings: {len(warnings)}")
    for i, warning in enumerate(warnings[:3]):
        print(f"  Warning {i + 1}: {warning.get('message')} ({warning.get('type')})")
    
    print(f"\nErrors: {len(errors)}")
    for i, error in enumerate(errors[:3]):
        print(f"  Error {i + 1}: {error.get('message')} ({error.get('type')})") 