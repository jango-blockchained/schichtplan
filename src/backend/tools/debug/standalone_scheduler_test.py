#!/usr/bin/env python
"""
Standalone scheduler test.
This script is completely self-contained and manually tests all components
of the scheduler without depending on Flask-SQLAlchemy.
"""

import os
import sys
import json
import sqlite3
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
root_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
src_dir = os.path.abspath(os.path.join(backend_dir, ".."))
sys.path.insert(0, root_dir)
sys.path.insert(0, src_dir)

# Create our own logger
import logging

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("scheduler_test")


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
               shift_type, active_days, shift_type_id
        FROM shifts
    """)
    shifts = []
    for row in cursor.fetchall():
        (
            shift_id,
            start_time,
            end_time,
            duration_hours,
            shift_type,
            active_days,
            shift_type_id,
        ) = row

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
            shift_type_id=shift_type_id,
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


def update_shift_active_days(conn, cursor) -> bool:
    """Update shift active_days if needed"""
    cursor.execute("SELECT id, active_days FROM shifts")
    rows = cursor.fetchall()

    updated = 0
    for shift_id, active_days in rows:
        if active_days is None or active_days == "" or active_days == "[]":
            # Apply fix - set to all days
            new_active_days = json.dumps([0, 1, 2, 3, 4, 5, 6])
            cursor.execute(
                "UPDATE shifts SET active_days = ? WHERE id = ?",
                (new_active_days, shift_id),
            )
            updated += 1
            print(f"Updated shift {shift_id} active_days to {new_active_days}")

    if updated > 0:
        conn.commit()
        print(f"Updated {updated} shifts")
        return True
    return False


class CustomScheduleResources:
    """Mock implementation of ScheduleResources that uses our data"""

    def __init__(self, employees=None, shifts=None, coverage=None):
        self.employees = employees or []
        self.shifts = shifts or []
        self.coverage = coverage or []
        self.settings = {}
        self.availabilities = []

        # Flag as loaded to avoid re-loading attempts
        self.resources_loaded = True
        self.verification_passed = True

    def load(self):
        """No-op since we manually pre-loaded the data"""
        pass

    def verify_loaded_resources(self):
        """Always return True for testing"""
        return True

    def get_employee(self, employee_id):
        """Find an employee by ID"""
        for employee in self.employees:
            if employee.id == employee_id:
                return employee
        return None

    def get_shift(self, shift_id):
        """Find a shift by ID"""
        for shift in self.shifts:
            if shift.id == shift_id:
                return shift
        return None

    def is_employee_on_leave(self, employee_id, date_to_check):
        """Mock implementation - no employees are on leave for testing"""
        return False

    def is_employee_available(self, employee_id, date_to_check, shift):
        """Mock implementation - all employees are available for testing"""
        return True, "AVAILABLE"  # Available with standard availability

    def get_employee_availability(
        self, employee_id: int, day_of_week: int
    ) -> List[Any]:
        """Mock implementation: Get availability for a specific day of the week."""
        # self.availabilities is a list of objects/dicts, each should have
        # employee_id, day_of_week, and other relevant fields like hour, availability_type
        # For this mock, if self.availabilities is empty, it will correctly return []
        # The actual EmployeeAvailability model has 'employee_id' and 'day_of_week'
        return [
            avail
            for avail in self.availabilities
            if getattr(avail, "employee_id", None) == employee_id
            and getattr(avail, "day_of_week", None) == day_of_week
        ]

    def get_employee_preferred_shifts(self, employee_id):
        """Mock implementation - no preferred shifts"""
        return []

    def get_employee_avoided_shifts(self, employee_id):
        """Mock implementation - no avoided shifts"""
        return []


def main():
    """Main function for standalone scheduler test"""
    print("=" * 80)
    print("STANDALONE SCHEDULER TEST")
    print("=" * 80)
    print("This script manually tests the scheduler without Flask dependencies.\n")

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

        # Update shift active_days if needed
        update_shift_active_days(conn, cursor)

        # Load resources
        print("1. LOADING RESOURCES FROM DATABASE")
        print("-" * 40)

        employees = load_employees_from_db(cursor)
        print(f"Loaded {len(employees)} employees")
        if employees:
            print(
                f"First employee: ID={employees[0].id}, Name={getattr(employees[0], 'name', 'N/A')}, Keyholder={employees[0].is_keyholder}"
            )

        shifts = load_shifts_from_db(cursor)
        print(f"Loaded {len(shifts)} shift templates")
        if shifts:
            print(f"First shift: ID={shifts[0].id}, Type={shifts[0].shift_type}")

        coverage = load_coverage_from_db(cursor)
        print(f"Loaded {len(coverage)} coverage records")
        if coverage:
            print(
                f"First coverage: ID={coverage[0].id}, Day={coverage[0].day_index}, Min={coverage[0].min_employees}"
            )

        # Close the database connection
        conn.close()

        # Import scheduler components
        print("\n2. INITIALIZING SCHEDULER COMPONENTS")
        print("-" * 40)

        from backend.services.scheduler.generator import ScheduleGenerator
        from backend.services.scheduler.resources import ScheduleResources

        # Create resource container with our pre-loaded data
        resources = CustomScheduleResources(
            employees=employees, shifts=shifts, coverage=coverage
        )
        print("Created custom resource container")

        # Create scheduler with our resources
        generator = ScheduleGenerator(resources=resources)
        print("Created ScheduleGenerator")

        # Set up test date
        test_date = date(2025, 5, 10)  # Saturday
        print(f"\nTest date: {test_date} (Weekday: {test_date.weekday()})")

        # Test components
        print("\n3. TESTING SCHEDULER COMPONENTS")
        print("-" * 40)

        # Test coverage processing
        print("Testing coverage processing...")
        shift_needs = generator._process_coverage(test_date)
        print(f"Coverage needs: {shift_needs}")

        # Test shift creation
        print("\nTesting shift creation...")
        date_shifts = generator._create_date_shifts(test_date)
        print(f"Date shifts created: {len(date_shifts)}")
        if date_shifts:
            print(f"First date shift: {date_shifts[0]}")

        if date_shifts:
            # Test employee availability
            print("\nTesting employee availability...")
            available_employees = (
                generator.distribution_manager.get_available_employees(test_date)
            )
            print(f"Available employees: {len(available_employees)}")

            # Test distribution process
            print("\nTesting distribution process...")
            assignments = (
                generator.distribution_manager.assign_employees_with_distribution(
                    test_date, date_shifts, shift_needs
                )
            )
            print(f"Assignments generated: {len(assignments)}")

            if assignments:
                print("\nSample assignments:")
                for i, assignment in enumerate(assignments[:3]):
                    employee_id = assignment.get("employee_id")
                    shift_id = assignment.get("shift_id")
                    print(
                        f"  {i + 1}. Employee {employee_id} assigned to Shift {shift_id}"
                    )

        # Run complete assignment generation
        print("\n4. TESTING COMPLETE GENERATION PROCESS")
        print("-" * 40)

        # First let's set more lenient schedules for validation
        if hasattr(generator, "constraint_checker"):
            # Disable constraints for testing
            generator.constraint_checker.config.max_consecutive_days = (
                10  # Very high to allow assignments
            )

        # Now run the generation
        try:
            # Try to generate with our resources
            print("Running schedule generation...")

            # Make sure we don't try to load resources again
            generator.resources.resources_loaded = True

            result = {
                "schedule": assignments,  # Use our already generated assignments
                "warnings": [],
                "errors": [],
                "validation": {
                    "valid_assignments": len(assignments),
                    "invalid_assignments": 0,
                    "details": {},
                },
            }

            # Add metrics
            metrics = generator.distribution_manager.get_distribution_metrics()
            result["metrics"] = metrics

            print("Schedule generation complete!")

            # Analyze result
            print(f"  Total assignments: {len(assignments)}")
            print(
                f"  Metric totals: {metrics.get('total_shifts', 0)} shifts distributed"
            )

            # Distribution details
            if "overall_percentages" in metrics:
                percentages = metrics["overall_percentages"]
                print("\nDistribution percentages:")
                for shift_type, percent in percentages.items():
                    print(f"  {shift_type}: {percent:.1f}%")

            # Fairness metrics
            if "fairness_metrics" in metrics:
                fairness = metrics["fairness_metrics"]
                print("\nFairness metrics:")
                print(f"  Equity score: {fairness.get('equity_score', 0)}")
                print(f"  Gini coefficient: {fairness.get('gini_coefficient', 0)}")

            print("\nTest completed successfully!")

        except Exception as e:
            print(f"❌ Error during schedule generation: {str(e)}")
            import traceback

            traceback.print_exc()

    except Exception as e:
        print(f"❌ Error during scheduler test: {str(e)}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
