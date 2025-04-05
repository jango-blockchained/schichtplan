#!/usr/bin/env python3
"""
Scheduler Resources SQLAlchemy Monkey Patch

This script applies a monkey patch to the ScheduleResources class to ensure that
all database operations are executed within the proper Flask app context.

The main issue being addressed is that the SQLAlchemy instance ('db') used in the
scheduler resources file is not correctly bound to the Flask app context for
all database operations.

Usage:
    from src.backend.tools.debug.fix_scheduler_db import apply_monkey_patch
    success = apply_monkey_patch()
    if success:
        print("Successfully applied monkey patch")
    else:
        print("Failed to apply monkey patch")

After applying the patch, calls to ScheduleResources methods will automatically
use the correct Flask app context, resolving the SQLAlchemy registration errors.
"""

import sys
import os
import logging
import traceback
from datetime import date, timedelta
from functools import wraps
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("scheduler_db_patch")

def apply_monkey_patch():
    """
    Apply monkey patch to ScheduleResources class to ensure all
    database operations run within the Flask app context.
    
    Returns:
        bool: True if patch was successfully applied, False otherwise
    """
    start_time = time.time()
    logger.info("Starting to apply ScheduleResources monkey patch...")
    
    try:
        # Import the Flask app factory and database
        logger.info("Importing Flask app and database...")
        from src.backend.app import create_app
        from src.backend.models import db as flask_db
        
        # Create a Flask app instance
        app = create_app()
        
        # Import the ScheduleResources class
        logger.info("Importing ScheduleResources class...")
        from src.backend.services.scheduler.resources import ScheduleResources
        
        # Store original methods for reference
        original_load_settings = ScheduleResources._load_settings
        original_load_coverage = ScheduleResources._load_coverage
        original_load_shifts = ScheduleResources._load_shifts
        original_load_employees = ScheduleResources._load_employees
        original_load_absences = ScheduleResources._load_absences
        original_load_availabilities = ScheduleResources._load_availabilities
        original_load = ScheduleResources.load
        
        # Create a decorator to ensure app context
        def ensure_app_context(func):
            @wraps(func)
            def wrapper(self, *args, **kwargs):
                logger.debug(f"Running {func.__name__} with app context...")
                if not hasattr(self, '_patched_app'):
                    self._patched_app = app
                    
                with self._patched_app.app_context():
                    try:
                        return func(self, *args, **kwargs)
                    except Exception as e:
                        logger.error(f"Error in {func.__name__}: {str(e)}")
                        logger.error(traceback.format_exc())
                        raise
            return wrapper
        
        # Patch the _db reference in ScheduleResources
        logger.info("Patching db reference in ScheduleResources...")
        ScheduleResources._db = flask_db
        
        # Patch each method to ensure app context
        logger.info("Patching ScheduleResources methods...")
        ScheduleResources._load_settings = ensure_app_context(original_load_settings)
        ScheduleResources._load_coverage = ensure_app_context(original_load_coverage)
        ScheduleResources._load_shifts = ensure_app_context(original_load_shifts)
        ScheduleResources._load_employees = ensure_app_context(original_load_employees)
        ScheduleResources._load_absences = ensure_app_context(original_load_absences)
        ScheduleResources._load_availabilities = ensure_app_context(original_load_availabilities)
        
        # Also patch the load method to use the correct app context
        @wraps(original_load)
        def patched_load(self, *args, **kwargs):
            logger.debug("Running patched load method...")
            self._patched_app = app
            with self._patched_app.app_context():
                try:
                    result = original_load(self, *args, **kwargs)
                    return result
                except Exception as e:
                    logger.error(f"Error in load: {str(e)}")
                    logger.error(traceback.format_exc())
                    raise
                
        ScheduleResources.load = patched_load
        
        # Log successful patching
        runtime = time.time() - start_time
        logger.info(f"Successfully applied monkey patch in {runtime:.2f} seconds")
        return True
        
    except Exception as e:
        logger.error(f"Failed to apply monkey patch: {str(e)}")
        logger.error(traceback.format_exc())
        return False

def test_patched_resources():
    """
    Test the patched ScheduleResources class by loading resources
    for a sample date range.
    
    Returns:
        dict: Results of the resource loading test
    """
    logger.info("Testing patched ScheduleResources...")
    
    try:
        from src.backend.services.scheduler.resources import ScheduleResources
        
        # Use a future date range to avoid conflicts
        start_date = date.today() + timedelta(days=365)
        end_date = start_date + timedelta(days=6)
        
        logger.info(f"Creating ScheduleResources for {start_date} to {end_date}")
        resources = ScheduleResources(start_date, end_date)
        
        logger.info("Loading resources...")
        load_result = resources.load()
        
        # Check what was loaded
        results = {
            "success": load_result,
            "settings_loaded": hasattr(resources, 'settings') and resources.settings is not None,
            "employee_count": len(resources.employees) if hasattr(resources, 'employees') else 0,
            "shift_count": len(resources.shifts) if hasattr(resources, 'shifts') else 0,
            "coverage_count": sum(len(day_coverage) for date_str, day_coverage in resources.coverage.items()) 
                              if hasattr(resources, 'coverage') else 0,
        }
        
        logger.info(f"Test results: {results}")
        return results
        
    except Exception as e:
        logger.error(f"Error testing patched resources: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    print("=" * 80)
    print("SCHEDULER RESOURCES MONKEY PATCH")
    print("=" * 80)
    
    patch_success = apply_monkey_patch()
    print(f"\nPatch applied: {'✅ Success' if patch_success else '❌ Failed'}")
    
    if patch_success:
        print("\nTesting patched resources...")
        test_results = test_patched_resources()
        
        if test_results["success"]:
            print("✅ Resources loaded successfully!")
            print(f"- Settings loaded: {test_results['settings_loaded']}")
            print(f"- Employees loaded: {test_results['employee_count']}")
            print(f"- Shifts loaded: {test_results['shift_count']}")
            print(f"- Coverage requirements loaded: {test_results['coverage_count']}")
        else:
            print("❌ Resource test failed!")
            print(f"Error: {test_results.get('error', 'Unknown error')}")
    
    print("\n" + "=" * 80) 