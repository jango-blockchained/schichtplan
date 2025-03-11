#!/usr/bin/env python
"""
Debug script for the scheduler service.
"""

import traceback
import sys
from datetime import date, timedelta


def debug_scheduler():
    """Debug the scheduler service."""
    try:
        # Import from the correct location
        from src.backend.app import create_app

        print("Importing app...")

        # Create app instance
        app = create_app()
        print("App created successfully")

        # Run inside app context
        with app.app_context():
            print("Inside app context...")

            # Now import models - this should be done inside the app context
            from src.backend.models import Schedule, Employee, ShiftTemplate, Coverage
            from src.backend.services.scheduler import ScheduleGenerator

            # Check data in the database
            print("\n--- CHECKING DATA ---")
            employees = Employee.query.filter_by(is_active=True).all()
            print(f"Active employees: {len(employees)}")
            for i, emp in enumerate(employees[:3]):
                print(
                    f"  {i + 1}. {emp.first_name} {emp.last_name} - Group: {emp.employee_group}, Keyholder: {emp.is_keyholder}"
                )

            shifts = ShiftTemplate.query.all()
            print(f"Shift templates: {len(shifts)}")
            for i, shift in enumerate(shifts[:3]):
                print(
                    f"  {i + 1}. {shift.start_time}-{shift.end_time} ({shift.duration_hours}h)"
                )

            coverage = Coverage.query.all()
            print(f"Coverage requirements: {len(coverage)}")
            for i, cov in enumerate(coverage[:3]):
                print(
                    f"  {i + 1}. Day {cov.day_index}: {cov.start_time}-{cov.end_time}, Min: {cov.min_employees}"
                )

            # Generate a schedule
            print("\n--- GENERATING SCHEDULE ---")
            generator = ScheduleGenerator()

            today = date.today()
            start_date = today
            end_date = today + timedelta(days=6)

            print(f"Generating schedule from {start_date} to {end_date}...")

            # Try to enable debug logging
            import logging

            logging.basicConfig(level=logging.DEBUG)

            # Generate the schedule
            result = generator.generate_schedule(
                start_date=start_date, end_date=end_date, create_empty_schedules=True
            )

            # Analyze the result
            print("\n--- SCHEDULE RESULT ---")
            schedule_entries = result.get("schedule", [])
            print(f"Generated {len(schedule_entries)} schedule entries")

            # Check for entries with shifts
            entries_with_shifts = [e for e in schedule_entries if e.get("shift_id")]
            print(f"Entries with assigned shifts: {len(entries_with_shifts)}")

            # Look at the first few entries
            print("\nFirst few entries:")
            for i, entry in enumerate(schedule_entries[:5]):
                print(f"  Entry {i + 1}:")
                print(f"    Employee ID: {entry.get('employee_id')}")
                print(f"    Date: {entry.get('date')}")
                print(f"    Shift ID: {entry.get('shift_id')}")
                print(f"    Version: {entry.get('version')}")

            # Check warnings and errors
            warnings = result.get("warnings", [])
            errors = result.get("errors", [])

            print(f"\nWarnings: {len(warnings)}")
            for i, warning in enumerate(warnings[:3]):
                print(
                    f"  Warning {i + 1}: {warning.get('message')} ({warning.get('type')})"
                )
                print(f"    Details: {warning.get('details')}")

            print(f"\nErrors: {len(errors)}")
            for i, error in enumerate(errors[:3]):
                print(f"  Error {i + 1}: {error.get('message')} ({error.get('type')})")

            # Check database for saved entries
            print("\n--- DATABASE CHECK ---")
            db_entries = Schedule.query.filter(
                Schedule.date >= start_date, Schedule.date <= end_date
            ).all()
            print(f"Entries in database for date range: {len(db_entries)}")

            # Check for entries with shifts
            db_entries_with_shifts = [e for e in db_entries if e.shift_id is not None]
            print(
                f"Database entries with assigned shifts: {len(db_entries_with_shifts)}"
            )

            # Print first few entries from database
            print("\nFirst few database entries:")
            for i, entry in enumerate(db_entries[:5]):
                print(f"  Entry {i + 1}:")
                print(f"    ID: {entry.id}")
                print(f"    Employee ID: {entry.employee_id}")
                print(f"    Date: {entry.date}")
                print(f"    Shift ID: {entry.shift_id}")
                print(f"    Version: {entry.version}")
                print(f"    Status: {entry.status}")

    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    debug_scheduler()
