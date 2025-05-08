#!/usr/bin/env python
"""
Script to test schedule generation and saving to the database.
"""

from app import create_app
from datetime import date, timedelta
import sys


def test_save_schedule():
    """Test that schedule entries are being saved to the database"""
    print("Starting test of schedule saving...")

    # Create app and get context
    app = create_app()
    with app.app_context():
        # Import models and services within the app context
        from services.scheduler import ScheduleGenerator
        from models import Schedule

        # Check for existing schedule entries
        existing_entries = Schedule.query.all()
        print(f"Found {len(existing_entries)} existing schedule entries in database")

        # Generate a new schedule
        print("\nGenerating new schedule...")
        generator = ScheduleGenerator()

        today = date.today()
        start_date = today
        end_date = today + timedelta(days=6)

        try:
            # Generate and save schedule
            result = generator.generate_schedule(
                start_date=start_date, end_date=end_date, create_empty_schedules=True
            )

            print(
                f"Schedule generation completed with {len(result.get('schedule', []))} entries"
            )

            # Check warnings
            warnings = result.get("warnings", [])
            print(f"Warnings: {len(warnings)}")
            for i, warning in enumerate(warnings[:3]):
                print(
                    f"  Warning {i + 1}: {warning.get('message')} ({warning.get('type')})"
                )

            # Now check if entries were saved to database
            print("\nChecking database after generation...")
            new_entries = Schedule.query.filter(
                Schedule.date >= start_date, Schedule.date <= end_date
            ).all()

            print(f"Found {len(new_entries)} entries in database for the date range")

            # Check if any entries have shifts assigned
            entries_with_shifts = [e for e in new_entries if e.shift_id is not None]
            print(f"Entries with shifts assigned: {len(entries_with_shifts)}")

            # Print example entries
            if new_entries:
                print("\nExample entries from database:")
                for i, entry in enumerate(new_entries[:3]):
                    print(f"  Entry {i + 1}:")
                    print(f"    ID: {entry.id}")
                    print(f"    Employee ID: {entry.employee_id}")
                    print(f"    Date: {entry.date}")
                    print(f"    Shift ID: {entry.shift_id}")
                    print(f"    Status: {entry.status}")

            return True

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            import traceback

            traceback.print_exc()
            return False


if __name__ == "__main__":
    test_save_schedule()
