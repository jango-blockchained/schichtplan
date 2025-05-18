#!/usr/bin/env python
"""
Script to check if schedule entries are being saved to the database.
"""

from src.backend.app import create_app
from src.backend.models import Schedule, Employee, ShiftTemplate, db
from src.backend.services.scheduler import ScheduleGenerator
from datetime import date, timedelta


def check_schedule_entries():
    """Check if schedule entries exist in the database."""
    app = create_app()
    with app.app_context():
        # Check for existing schedule entries
        schedule_entries = Schedule.query.all()
        print(f"Found {len(schedule_entries)} existing schedule entries in database")

        # If there are entries, print some sample data
        if schedule_entries:
            print("\nSample schedule entries:")
            for i, entry in enumerate(schedule_entries[:5]):  # Show first 5 entries
                print(f"Entry {i + 1}:")
                print(f"  ID: {entry.id}")
                print(f"  Employee ID: {entry.employee_id}")
                print(f"  Date: {entry.date}")
                print(f"  Version: {entry.version}")
                print(f"  Status: {entry.status}")

                # Try to get employee name
                employee = db.session.get(Employee, entry.employee_id)
                if employee:
                    print(f"  Employee: {employee.first_name} {employee.last_name}")

                # Try to get shift info
                if entry.shift_id:
                    shift = db.session.get(ShiftTemplate, entry.shift_id)
                    if shift:
                        print(f"  Shift: {shift.start_time} - {shift.end_time}")

                print("")

        # Now generate a schedule and check if entries are created
        print("\nGenerating new schedule...")
        generator = ScheduleGenerator()
        today = date.today()
        start_date = today
        end_date = today + timedelta(days=6)

        result = generator.generate_schedule(
            start_date=start_date, end_date=end_date, create_empty_schedules=True
        )

        print(f"Schedule generation result: {len(result.get('schedule', []))} entries")

        # Check if entries were saved to database
        new_schedule_entries = Schedule.query.filter(
            Schedule.date >= start_date, Schedule.date <= end_date
        ).all()

        print(
            f"Found {len(new_schedule_entries)} schedule entries in database after generation"
        )

        # Check which employees have assigned shifts
        employee_counts = {}
        for entry in new_schedule_entries:
            if entry.shift_id:
                employee_counts[entry.employee_id] = (
                    employee_counts.get(entry.employee_id, 0) + 1
                )

        print(f"\nEmployees with assigned shifts: {len(employee_counts)}")
        for emp_id, count in employee_counts.items():
            employee = db.session.get(Employee, emp_id)
            if employee:
                print(f"  {employee.first_name} {employee.last_name}: {count} shifts")
            else:
                print(f"  Employee ID {emp_id}: {count} shifts")

        # Check coverage data
        print("\nChecking coverage requirements:")
        from src.backend.models import Coverage

        coverage_reqs = Coverage.query.all()
        print(f"Found {len(coverage_reqs)} coverage requirements")

        for cov in coverage_reqs[:5]:  # Show first 5
            print(
                f"  Day {cov.day_index}: {cov.start_time}-{cov.end_time}, "
                f"Min: {cov.min_employees}, Max: {cov.max_employees}, "
                f"Requires keyholder: {cov.requires_keyholder}"
            )


if __name__ == "__main__":
    check_schedule_entries()
