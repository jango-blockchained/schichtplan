#!/usr/bin/env python
"""
Script to run performance tests for schedule generation.
This script runs schedule generation with different date ranges and measures performance.
"""

import sys
import logging
import time
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


def run_performance_tests():
    """Run performance tests for schedule generation."""
    logger.info("=" * 80)
    logger.info("SCHEDULE GENERATION PERFORMANCE TESTS")
    logger.info("=" * 80)

    app = create_app()
    with app.app_context():
        # Test with different date ranges
        date_ranges = [
            (1, "1 day"),
            (7, "1 week"),
            (14, "2 weeks"),
            (30, "1 month"),
            (90, "3 months"),
        ]

        results = []

        for days, label in date_ranges:
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=days - 1)

            logger.info(
                f"\nTesting performance for {label} ({start_date} to {end_date})"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules and measure time
            start_time = time.time()
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )
            end_time = time.time()

            # Calculate metrics
            generation_time = end_time - start_time
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])
            errors = result.get("errors", [])

            total_schedules = len(schedules)
            empty_schedules = len(
                [
                    s
                    for s in schedules
                    if s.get("is_empty", False) or not s.get("shift_id")
                ]
            )
            assigned_schedules = total_schedules - empty_schedules

            schedules_per_second = (
                total_schedules / generation_time if generation_time > 0 else 0
            )

            logger.info(f"  Generation time: {generation_time:.2f} seconds")
            logger.info(f"  Total schedules: {total_schedules}")
            logger.info(f"  Assigned schedules: {assigned_schedules}")
            logger.info(f"  Empty schedules: {empty_schedules}")
            logger.info(f"  Warnings: {len(warnings)}")
            logger.info(f"  Errors: {len(errors)}")
            logger.info(f"  Schedules per second: {schedules_per_second:.2f}")

            results.append(
                {
                    "range": label,
                    "days": days,
                    "time": generation_time,
                    "total_schedules": total_schedules,
                    "assigned_schedules": assigned_schedules,
                    "empty_schedules": empty_schedules,
                    "warnings": len(warnings),
                    "errors": len(errors),
                    "schedules_per_second": schedules_per_second,
                }
            )

        # Print summary
        logger.info("\n" + "=" * 80)
        logger.info("PERFORMANCE SUMMARY")
        logger.info("=" * 80)
        logger.info(
            f"{'Range':<10} | {'Days':<5} | {'Time (s)':<10} | {'Total':<10} | {'Assigned':<10} | {'Empty':<10} | {'Schedules/s':<12}"
        )
        logger.info("-" * 80)

        for result in results:
            logger.info(
                f"{result['range']:<10} | {result['days']:<5} | {result['time']:<10.2f} | "
                f"{result['total_schedules']:<10} | {result['assigned_schedules']:<10} | "
                f"{result['empty_schedules']:<10} | {result['schedules_per_second']:<12.2f}"
            )

        return results


if __name__ == "__main__":
    run_performance_tests()
