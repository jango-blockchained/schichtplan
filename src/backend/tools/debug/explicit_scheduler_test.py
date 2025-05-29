#!/usr/bin/env python
"""
Explicit scheduler test.
This script directly loads resources from the database and runs the scheduler
without relying on Flask-SQLAlchemy to retrieve the data.
"""

import os
import sys
import json
import sqlite3
from datetime import date, datetime, timedelta
from typing import List, Dict, Any

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
root_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
sys.path.insert(0, root_dir)


# Create mock versions of the database models
class MockEmployee:
    """Mock implementation of Employee model"""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockShiftTemplate:
    """Mock implementation of ShiftTemplate model"""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockCoverage:
    """Mock implementation of Coverage model"""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def load_employees_from_db(cursor) -> List[MockEmployee]:
    """Load employees from the database"""
    cursor.execute("""
        SELECT id, employee_id, first_name, last_name, contracted_hours, 
               employee_group, is_keyholder, is_active
        FROM employees
        WHERE is_active = 1
    """)
    employees = []
    for row in cursor.fetchall():
        emp = MockEmployee(
            id=row[0],
            employee_id=row[1],
            first_name=row[2],
            last_name=row[3],
            contracted_hours=row[4],
            employee_group=row[5],
            is_keyholder=bool(row[6]),
            is_active=bool(row[7]),
            name=f"{row[2]} {row[3]}",  # Add composite name
        )
        employees.append(emp)
    return employees


def load_shifts_from_db(cursor) -> List[MockShiftTemplate]:
    """Load shift templates from the database"""
    cursor.execute("""
        SELECT id, start_time, end_time, duration_hours, 
               shift_type, active_days
        FROM shifts
    """)
    shifts = []
    for row in cursor.fetchall():
        shift_id, start_time, end_time, duration_hours, shift_type, active_days = row

        # Parse active_days
        days_list = None
        if active_days:
            try:
                days_list = json.loads(active_days)
            except (json.JSONDecodeError, TypeError):
                try:
                    days_list = [
                        int(day.strip())
                        for day in active_days.split(",")
                        if day.strip()
                    ]
                except:
                    days_list = []

        shift = MockShiftTemplate(
            id=shift_id,
            start_time=start_time,
            end_time=end_time,
            duration_hours=duration_hours,
            shift_type=shift_type,
            active_days=days_list,
        )
        shifts.append(shift)
    return shifts


def load_coverage_from_db(cursor) -> List[MockCoverage]:
    """Load coverage records from the database"""
    cursor.execute("""
        SELECT id, day_index, start_time, end_time, 
               min_employees, max_employees
        FROM coverage
    """)
    coverage_records = []
    for row in cursor.fetchall():
        cov_id, day_index, start_time, end_time, min_employees, max_employees = row
        coverage = MockCoverage(
            id=cov_id,
            day_index=day_index,
            start_time=start_time,
            end_time=end_time,
            min_employees=min_employees,
            max_employees=max_employees,
        )
        coverage_records.append(coverage)
    return coverage_records


def main():
    """Main function to run an explicit scheduler test"""
    print("=" * 80)
    print("EXPLICIT SCHEDULER TEST")
    print("=" * 80)
    print("This script directly loads resources and runs the scheduler.\n")

    # Find and connect to the database
    db_path = os.path.join(root_dir, "src/instance/app.db")
    if not os.path.exists(db_path):
        print(f"❌ Database file not found at {db_path}")
        return

    print(f"Database found at: {db_path}\n")

    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Load resources
        print("1. LOADING RESOURCES FROM DATABASE")
        print("-" * 40)

        employees = load_employees_from_db(cursor)
        print(f"Loaded {len(employees)} employees")
        if employees:
            print(
                f"First employee: ID={employees[0].id}, Name={employees[0].name}, Keyholder={employees[0].is_keyholder}"
            )

        shifts = load_shifts_from_db(cursor)
        print(f"Loaded {len(shifts)} shift templates")
        if shifts:
            print(
                f"First shift: ID={shifts[0].id}, Type={shifts[0].shift_type}, Hours={shifts[0].duration_hours}"
            )

        coverage = load_coverage_from_db(cursor)
        print(f"Loaded {len(coverage)} coverage records")
        if coverage:
            print(
                f"First coverage: ID={coverage[0].id}, Day={coverage[0].day_index}, Min staffing={coverage[0].min_employees}"
            )

        # Close the database connection
        conn.close()

        # Import scheduler components
        print("\n2. INITIALIZING SCHEDULER COMPONENTS")
        print("-" * 40)

        from src.backend.services.scheduler.resources import ScheduleResources
        from src.backend.services.scheduler.generator import ScheduleGenerator

        # Create custom resource container and load our data
        resources = ScheduleResources()
        resources.employees = employees
        resources.shifts = shifts
        resources.coverage = coverage

        # Set verification flag to avoid needing to reload data
        resources.resources_loaded = True
        resources.verification_passed = True

        print("Created resource container with pre-loaded data")

        # Create scheduler with our resources
        generator = ScheduleGenerator(resources=resources)
        print("Created schedule generator with custom resources")

        # Test date
        test_date = date(2025, 5, 10)  # Saturday
        print(f"\nTest date: {test_date} (Weekday: {test_date.weekday()})")

        # Run basic tests
        print("\n3. TESTING SCHEDULE COMPONENTS")
        print("-" * 40)

        # Test coverage processing
        shift_needs = generator._process_coverage(test_date)
        print(f"Coverage needs result: {shift_needs}")

        # Test shift creation
        date_shifts = generator._create_date_shifts(test_date)
        print(f"Date shifts created: {len(date_shifts)}")
        if date_shifts:
            print(f"First date shift: {date_shifts[0]}")

        # Test distribution
        if date_shifts:
            available_employees = (
                generator.distribution_manager.get_available_employees(test_date)
            )
            print(f"Available employees: {len(available_employees)}")

            assignments = (
                generator.distribution_manager.assign_employees_with_distribution(
                    test_date, date_shifts, shift_needs
                )
            )
            print(f"Generated assignments: {len(assignments)}")

            if assignments:
                print("\nSample assignments:")
                for i, assignment in enumerate(assignments[:3]):
                    print(
                        f"  {i + 1}. Employee {assignment.get('employee_id')} assigned to Shift {assignment.get('shift_id')}"
                    )

        # Generate full schedule for the date
        print("\n4. GENERATING FULL SCHEDULE")
        print("-" * 40)

        result = generator.generate_schedule(
            start_date=test_date, end_date=test_date, create_empty_schedules=True
        )

        # Analyze result
        schedule = result.get("schedule", [])
        assignments = [
            entry for entry in schedule if entry.get("employee_id") is not None
        ]

        print(f"Schedule generation complete:")
        print(f"  Total entries: {len(schedule)}")
        print(f"  Assignments: {len(assignments)}")

        if assignments:
            print("\nSuccessfully generated schedule with assignments!")
            print("Sample assignments:")
            for i, entry in enumerate(assignments[:3]):
                employee_id = entry.get("employee_id")
                shift_id = entry.get("shift_id")
                entry_date = entry.get("date")
                print(
                    f"  {i + 1}. Employee {employee_id} assigned to Shift {shift_id} on {entry_date}"
                )
        else:
            print("\nNo assignments were generated in the schedule.")

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

            metrics = result.get("metrics", {})
            if metrics:
                print(f"\nDistribution metrics: {metrics}")

            # Summarize what we've found
            print("\nIssues preventing assignment generation:")
            if not shift_needs:
                print("  - No coverage needs were determined for the test date")
            if not date_shifts:
                print("  - No shift instances were created for the test date")
            if date_shifts and not available_employees:
                print("  - No employees were available for the test date")

    except Exception as e:
        print(f"❌ Error during scheduler test: {str(e)}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
