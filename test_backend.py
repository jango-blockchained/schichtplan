#!/usr/bin/env python3
"""
Test script that follows the normal backend workflow to test if the schedule generation
and database save are working properly.
"""

import os
import sys
from datetime import date, timedelta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("test_backend")

# Path to the root of the project
project_root = os.path.abspath(os.path.dirname(__file__))
sys.path.append(project_root)

# Set environment variables
os.environ["FLASK_APP"] = "src.backend.run"
os.environ["FLASK_ENV"] = "development"
os.environ["DEBUG_MODE"] = "1"

# Import backend modules
logger.info("Importing modules...")
try:
    from src.backend.app import create_app
    from src.backend.models import db, Schedule, ScheduleVersionMeta
    from src.backend.services.scheduler import ScheduleGenerator
    logger.info("Modules imported successfully")
except ImportError as e:
    logger.error(f"Failed to import required modules: {e}")
    sys.exit(1)

def run_test():
    """Run the test by creating an app context and testing schedule generation and DB save"""
    try:
        # Create the Flask app
        logger.info("Creating Flask app...")
        app = create_app()
        
        # Test parameters
        today = date.today()
        start_date = today
        end_date = today + timedelta(days=6)  # One week
        version = 2  # Use version 2 for testing
        
        logger.info(f"Test parameters: start_date={start_date}, end_date={end_date}, version={version}")
        
        # Enter the app context
        logger.info("Entering app context...")
        with app.app_context():
            logger.info("App context created successfully")
            
            # Check for existing schedules with version 2
            existing_count = db.session.query(Schedule).filter(Schedule.version == version).count()
            logger.info(f"Found {existing_count} existing schedules for version {version}")
            
            # Initialize schedule generator
            logger.info("Initializing ScheduleGenerator...")
            generator = ScheduleGenerator()
            
            # Generate schedule
            logger.info(f"Generating schedule for {start_date} to {end_date} (version {version})...")
            result = generator.generate(
                start_date=start_date,
                end_date=end_date,
                create_empty_schedules=True,
                version=version
            )
            
            # Check the result
            schedules_count = len(result.get('schedules', []))
            logger.info(f"Generation result: {schedules_count} schedules created")
            
            # Explicitly call save_to_database method
            logger.info("Explicitly calling _save_to_database method...")
            generator._save_to_database()
            
            # Check for schedules after save
            new_count = db.session.query(Schedule).filter(Schedule.version == version).count()
            logger.info(f"Found {new_count} schedules for version {version} after generation")
            
            if new_count > existing_count:
                logger.info(f"SUCCESS: {new_count - existing_count} new schedules were added to the database")
            else:
                logger.warning("WARNING: No new schedules were added to the database")
                
            # Display a sample of the newly created schedules
            if new_count > existing_count:
                logger.info("Displaying sample of new schedules:")
                schedules = db.session.query(Schedule).filter(Schedule.version == version).limit(5).all()
                for i, schedule in enumerate(schedules):
                    logger.info(f"Schedule {i+1}:")
                    logger.info(f"  ID: {schedule.id}")
                    logger.info(f"  Employee ID: {schedule.employee_id}")
                    logger.info(f"  Shift ID: {schedule.shift_id}")
                    logger.info(f"  Date: {schedule.date}")
                    logger.info(f"  Status: {schedule.status}")
                    logger.info(f"  Shift Type: {schedule.shift_type}")
                    
    except Exception as e:
        logger.error(f"Error in test: {e}", exc_info=True)
        return False
    
    return True

if __name__ == "__main__":
    success = run_test()
    if success:
        logger.info("Test completed successfully")
        sys.exit(0)
    else:
        logger.error("Test failed")
        sys.exit(1) 