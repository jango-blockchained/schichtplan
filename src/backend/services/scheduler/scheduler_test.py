#!/usr/bin/env python3
"""
Example script for testing the scheduler with proper application context
and enhanced logging.

This script demonstrates how to use the helper functions to run the scheduler
with appropriate logging.
"""

import os
import sys
import logging
from datetime import date, timedelta

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.append(parent_dir)

from services.scheduler.utils import (
    setup_scheduler_with_context,
    run_scheduler_test,
)


def test_scheduler_basic():
    """Basic test of scheduler with application context"""
    print("Setting up scheduler with application context...")

    # Get dates for testing (current week)
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)

    # Initialize the scheduler within app context
    scheduler = setup_scheduler_with_context(log_level=logging.DEBUG)

    print(f"Running schedule generation for {start_of_week} to {end_of_week}...")
    try:
        # Generate schedule
        result = scheduler.generate_schedule(
            start_date=start_of_week, end_date=end_of_week, create_empty_schedules=True
        )

        print("Schedule generation complete")
        print(f"Log path: {scheduler.logging_manager.get_log_path()}")
        print(f"Diagnostic log: {scheduler.logging_manager.get_diagnostic_log_path()}")
        print(f"App log: {scheduler.logging_manager.get_app_log_path()}")

        # Output summary of result
        print("\nSchedule generation summary:")
        if "schedule_info" in result:
            info = result["schedule_info"]
            print(f"- Date range: {info['start_date']} to {info['end_date']}")
            print(f"- Version: {info['version']}")
            print(f"- Total dates: {info['date_count']}")
            print(f"- Dates with coverage: {info['dates_with_coverage']}")
            print(f"- Empty dates: {info['empty_dates']}")

        if "validation" in result:
            validation = result["validation"]
            print(f"- Valid assignments: {validation['valid_assignments']}")
            print(f"- Invalid assignments: {validation['invalid_assignments']}")

        if "metrics" in result:
            print(f"- Metrics included: {', '.join(result['metrics'].keys())}")

        return True
    except Exception as e:
        print(f"Error during schedule generation: {str(e)}")
        return False


def test_scheduler_helper():
    """Test the scheduler using the all-in-one helper function"""
    print("Using run_scheduler_test helper function...")

    # Get dates for testing (current week)
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)

    # Define a custom diagnostic path
    diagnostic_path = os.path.join(parent_dir, "src", "logs", "diagnostics")

    try:
        # Use the helper function
        result = run_scheduler_test(
            start_date=start_of_week,
            end_date=end_of_week,
            create_empty_schedules=True,
            log_level=logging.DEBUG,
            diagnostic_path=diagnostic_path,
        )

        print("Schedule generation complete using helper function")
        print(f"Result contains {len(result.keys())} keys")

        return True
    except Exception as e:
        print(f"Error during schedule generation with helper: {str(e)}")
        return False


if __name__ == "__main__":
    # Run the basic test
    print("\n=== Running Basic Test ===\n")
    test_result = test_scheduler_basic()
    print(f"\nBasic test result: {'SUCCESS' if test_result else 'FAILED'}")

    # Run the helper function test
    print("\n=== Running Helper Function Test ===\n")
    helper_result = test_scheduler_helper()
    print(f"\nHelper test result: {'SUCCESS' if helper_result else 'FAILED'}")
