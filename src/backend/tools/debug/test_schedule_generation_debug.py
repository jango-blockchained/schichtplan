#!/usr/bin/env python
"""
Test script for schedule generation with our fixes.
This script runs the schedule generator with detailed logging
for a specific date range and analyzes the results.
"""

import os
import sys
import logging
from datetime import date, datetime, timedelta

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
root_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
sys.path.insert(0, root_dir)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("test_scheduler")


def main():
    """Main function to test schedule generation"""
    print("=" * 80)
    print("SCHEDULE GENERATION TEST TOOL")
    print("=" * 80)
    print("This tool runs the schedule generator with our fixes.\n")

    # Import necessary modules
    try:
        from src.backend.app import create_app
        from src.backend.models import db
        from src.backend.services.scheduler.generator import ScheduleGenerator

        print("✅ Successfully imported required modules")
    except ImportError as e:
        print(f"❌ Error importing modules: {e}")
        return

    # Create Flask application context
    app = create_app()
    with app.app_context():
        try:
            # Create a schedule generator
            print("\nInitializing ScheduleGenerator...")
            generator = ScheduleGenerator()

            # Define test date range - start with a very short range for testing
            start_date = date.today() + timedelta(days=1)  # Tomorrow
            end_date = start_date + timedelta(days=2)  # 3 days total

            print(f"\nGenerating schedule from {start_date} to {end_date}")
            print("-" * 40)

            # Set high log level to get detailed diagnostic information
            result = generator.generate_schedule(
                start_date=start_date,
                end_date=end_date,
                create_empty_schedules=True,  # Create empty entries for days with no assignments
            )

            # Analyze the results
            print("\nSchedule Generation Results:")
            print("-" * 40)

            # Check if we have a schedule
            schedule = result.get("schedule", [])
            print(f"Total schedule entries: {len(schedule)}")

            # Count assignments vs. empty entries
            assignments = [
                entry for entry in schedule if entry.get("employee_id") is not None
            ]
            empty_entries = [
                entry for entry in schedule if entry.get("employee_id") is None
            ]
            print(f"Assignments with employees: {len(assignments)}")
            print(f"Empty schedule entries: {len(empty_entries)}")

            # Analyze assignments by date
            assignments_by_date = {}
            for entry in assignments:
                entry_date = entry.get("date")
                if entry_date not in assignments_by_date:
                    assignments_by_date[entry_date] = []
                assignments_by_date[entry_date].append(entry)

            print("\nAssignments by date:")
            for d, entries in sorted(assignments_by_date.items()):
                print(f"  {d}: {len(entries)} assignments")

            # Show sample of actual assignments if there are any
            if assignments:
                print("\nSample assignments:")
                for i, entry in enumerate(assignments[:5]):  # Show first 5
                    employee_id = entry.get("employee_id")
                    shift_id = entry.get("shift_id")
                    entry_date = entry.get("date")
                    print(
                        f"  {i + 1}. Employee {employee_id} assigned to Shift {shift_id} on {entry_date}"
                    )
            else:
                print("\nNo assignments were made.")

                # Check for errors
                errors = result.get("errors", [])
                warnings = result.get("warnings", [])
                if errors:
                    print("\nErrors during schedule generation:")
                    for error in errors:
                        print(f"  - {error}")
                if warnings:
                    print("\nWarnings during schedule generation:")
                    for warning in warnings:
                        print(f"  - {warning}")

                print("\nChecking for distribution issues...")
                metrics = result.get("metrics", {})
                if metrics:
                    print(f"Distribution metrics: {metrics}")

            # Analyze validation results
            validation = result.get("validation", {})
            valid_count = validation.get("valid_assignments", 0)
            invalid_count = validation.get("invalid_assignments", 0)
            print(
                f"\nValidation: {valid_count} valid, {invalid_count} invalid assignments"
            )

            if invalid_count > 0:
                validation_details = validation.get("details", {})
                print("\nInvalid assignment details:")
                for employee_id, violations in validation_details.items():
                    print(f"  Employee {employee_id}: {len(violations)} violations")
                    for violation in violations[
                        :2
                    ]:  # Show only first 2 violations per employee
                        print(
                            f"    - Date: {violation.get('date')}, Violations: {violation.get('violations')}"
                        )

            print("\nSchedule generation test completed.")

        except Exception as e:
            print(f"❌ Error during schedule generation test: {str(e)}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    main()
