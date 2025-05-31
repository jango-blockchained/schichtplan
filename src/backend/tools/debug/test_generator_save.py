#!/usr/bin/env python3
"""
Test script to verify the ScheduleGenerator._save_to_database method works properly.
"""

import os
import sys
import logging
from datetime import date, timedelta

# Add parent directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(current_dir, "generator_save_test.log")),
    ],
)

logger = logging.getLogger(__name__)
logger.info("Starting generator save test")

# Try to initialize the Flask app context
try:
    from app import app

    logger.info("Successfully imported Flask app")
    app_context = app.app_context()
    app_context.push()
    logger.info("Pushed Flask app context")
except ImportError:
    logger.warning("Could not import Flask app, will use models directly")
    app_context = None

# Import necessary models and classes
try:
    from src.backend.models import db, Employee, Schedule, ShiftTemplate
    from services.scheduler.generator import ScheduleGenerator
    from services.scheduler.resources import ScheduleResources

    logger.info("Imports successful")
except ImportError as e:
    logger.error(f"Failed to import required modules: {e}")
    sys.exit(1)


def test_save_to_database():
    """Test the _save_to_database method of ScheduleGenerator"""
    logger.info("Starting save to database test")

    # Create date range for testing
    today = date.today()
    start_date = today
    end_date = today + timedelta(days=6)  # One week
    version = 999  # Use a unique version for testing

    logger.info(
        f"Test parameters: start_date={start_date}, end_date={end_date}, version={version}"
    )

    # Check for existing data in test version
    existing_count = Schedule.query.filter_by(version=version).count()
    logger.info(f"Found {existing_count} existing schedules for version {version}")

    if existing_count > 0:
        logger.info("Cleaning up existing test data")
        try:
            Schedule.query.filter_by(version=version).delete()
            db.session.commit()
            logger.info(f"Deleted {existing_count} existing test schedules")
        except Exception as e:
            logger.error(f"Failed to delete existing test data: {e}")
            db.session.rollback()

    try:
        # Initialize ScheduleGenerator
        resources = ScheduleResources()
        resources.load()
        generator = ScheduleGenerator(resources=resources)

        logger.info("ScheduleGenerator initialized")

        # Generate schedule
        logger.info("Generating schedule")
        result = generator.generate(
            start_date=start_date,
            end_date=end_date,
            create_empty_schedules=True,
            version=version,
        )

        logger.info(
            f"Schedule generation result: {len(result.get('schedules', []))} schedules generated"
        )

        # Test saving to database
        logger.info("Calling _save_to_database")
        save_result = generator._save_to_database()

        logger.info(f"Save result: {save_result}")

        # Verify data was saved
        saved_count = Schedule.query.filter_by(version=version).count()
        logger.info(f"Found {saved_count} schedules in database for version {version}")

        # Get breakdown of saved data
        with_shift = Schedule.query.filter(
            Schedule.version == version, Schedule.shift_id != None
        ).count()
        without_shift = Schedule.query.filter(
            Schedule.version == version, Schedule.shift_id == None
        ).count()

        logger.info(f"Schedules with shift assignments: {with_shift}")
        logger.info(f"Schedules without shift assignments (empty): {without_shift}")

        # Detailed verification
        if saved_count > 0:
            logger.info("Schedule save test PASSED ✅")
            logger.info("Database saving is working correctly")
            return True
        else:
            logger.error("Schedule save test FAILED ❌")
            logger.error("No schedules were saved to the database")
            return False

    except Exception as e:
        logger.error(f"Test failed with error: {e}", exc_info=True)
        return False
    finally:
        # Clean up test data
        try:
            # Optional: uncomment to delete test data after verification
            # Schedule.query.filter_by(version=version).delete()
            # db.session.commit()
            # logger.info(f"Cleaned up test data for version {version}")
            pass
        except Exception as e:
            logger.error(f"Failed to clean up test data: {e}")
            db.session.rollback()


if __name__ == "__main__":
    try:
        logger.info("=== Starting Generator Save Test ===")
        success = test_save_to_database()

        if success:
            logger.info("Test completed successfully!")
            sys.exit(0)
        else:
            logger.error("Test failed!")
            sys.exit(1)
    finally:
        # Pop app context if we pushed it
        if app_context:
            app_context.pop()
            logger.info("Popped Flask app context")
