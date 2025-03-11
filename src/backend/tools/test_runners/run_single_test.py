#!/usr/bin/env python
"""
Script to run a single schedule generation test for demonstration purposes.
This script runs the basic schedule generation test and displays the results.
"""

import sys
import logging
from datetime import datetime, timedelta
from app import create_app
from services.scheduler.generator import ScheduleGenerator

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def get_next_monday():
    """Get the date of the next Monday."""
    today = datetime.now().date()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # If today is Monday, get next Monday
    return today + timedelta(days=days_ahead)


def run_basic_test():
    """Run a basic schedule generation test."""
    logger.info("=" * 80)
    logger.info("BASIC SCHEDULE GENERATION TEST")
    logger.info("=" * 80)

    app = create_app()
    with app.app_context():
        # Calculate dates for next week (Monday to Sunday)
        start_date = get_next_monday()
        end_date = start_date + timedelta(days=6)

        logger.info(
            f"Testing schedule generation for period: {start_date} to {end_date}"
        )

        # Initialize schedule generator
        generator = ScheduleGenerator()

        # Generate schedules
        logger.info("Generating schedule...")
        result = generator.generate_schedule(
            start_date, end_date, create_empty_schedules=True
        )

        # Get the schedules from the result
        schedules = result.get("schedule", [])
        warnings = result.get("warnings", [])
        errors = result.get("errors", [])

        # Log results
        total_schedules = len(schedules)
        empty_schedules = len(
            [s for s in schedules if s.get("is_empty", False) or not s.get("shift_id")]
        )
        assigned_schedules = total_schedules - empty_schedules

        logger.info("Schedule generation completed")
        logger.info(f"Total schedules: {total_schedules}")
        logger.info(f"Assigned schedules: {assigned_schedules}")
        logger.info(f"Empty schedules: {empty_schedules}")
        logger.info(f"Warnings: {len(warnings)}")
        logger.info(f"Errors: {len(errors)}")

        # Display some sample schedules
        if schedules:
            logger.info("\nSample schedules:")
            for i, schedule in enumerate(schedules[:5]):  # Show first 5 schedules
                logger.info(
                    f"  {i + 1}. Employee ID: {schedule.get('employee_id')}, Date: {schedule.get('date')}, Shift ID: {schedule.get('shift_id')}"
                )

            if len(schedules) > 5:
                logger.info(f"  ... and {len(schedules) - 5} more")

        # Display some warnings if any
        if warnings:
            logger.info("\nSample warnings:")
            for i, warning in enumerate(warnings[:5]):  # Show first 5 warnings
                logger.info(f"  {i + 1}. {warning}")

            if len(warnings) > 5:
                logger.info(f"  ... and {len(warnings) - 5} more")

        return result


if __name__ == "__main__":
    run_basic_test()
