#!/usr/bin/env python
"""
Script to check if schedule entries are being saved to the database.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

# Add the src directory to the path for imports
src_dir = Path(__file__).resolve().parent / "src"
sys.path.append(str(src_dir))

# Now we can import from the src folder
from backend.app import create_app
from backend.models import Schedule, Employee, Coverage
from backend.services.scheduler import ScheduleGenerator


def main():
    """Main function to check schedule entries"""
    # Create the app and push an application context
    app = create_app()
    with app.app_context():
        # Check existing schedule entries
        print("Checking existing schedule entries...")
        schedule_entries = Schedule.query.all()
        print(f"Found {len(schedule_entries)} schedule entries in database\n")

        # Check coverage requirements
        print("Checking coverage requirements...")
        coverage_reqs = Coverage.query.all()
        print(f"Found {len(coverage_reqs)} coverage requirements")
        for i, cov in enumerate(coverage_reqs[:5]):
            print(
                f"  {i + 1}. Day {cov.day_index}: {cov.start_time}-{cov.end_time}, "
                f"Min: {cov.min_employees}, Max: {cov.max_employees}, "
                f"Requires keyholder: {cov.requires_keyholder}"
            )
        print()

        # Check employees
        print("Checking employees...")
        employees = Employee.query.filter_by(is_active=True).all()
        print(f"Found {len(employees)} active employees")
        for i, emp in enumerate(employees[:5]):
            print(f"  {i + 1}. {emp.first_name} {emp.last_name} (ID: {emp.id})")
            print(
                f"     Group: {emp.employee_group}, Keyholder: {emp.is_keyholder}, "
                f"Hours: {emp.contracted_hours}"
            )
        print()

        # Generate a new schedule
        print("Generating a new schedule...")
        generator = ScheduleGenerator()
        today = date.today()
        result = generator.generate_schedule(
            start_date=today,
            end_date=today + timedelta(days=6),
            create_empty_schedules=True,
        )

        print(f"Generated {len(result.get('schedule', []))} schedule entries")

        # Check if any entries have shifts assigned
        entries_with_shifts = 0
        unique_employees = set()
        for entry in result.get("schedule", []):
            if entry.get("shift_id"):
                entries_with_shifts += 1
                unique_employees.add(entry.get("employee_id"))

        print(f"Entries with shifts assigned: {entries_with_shifts}")
        print(f"Unique employees with shifts: {len(unique_employees)}")

        # Check database after generation
        print("\nChecking database after generation...")
        new_entries = Schedule.query.filter(
            Schedule.date >= today, Schedule.date <= today + timedelta(days=6)
        ).all()

        print(f"Found {len(new_entries)} entries in database for the date range")

        entries_with_shift_db = 0
        for entry in new_entries:
            if entry.shift_id:
                entries_with_shift_db += 1

        print(f"Database entries with shifts assigned: {entries_with_shift_db}")


if __name__ == "__main__":
    main()
