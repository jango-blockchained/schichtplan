#!/usr/bin/env python
"""
Resource loading diagnostic and fix tool.
This script examines the resource loading issue in the scheduler
and attempts to fix it by creating or updating the database entries.
"""

import os
import sys
import json
from datetime import date, datetime, timedelta
import random
import sqlite3

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
root_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
sys.path.insert(0, root_dir)


def main():
    """Main function for diagnosing and fixing resource loading"""
    print("=" * 80)
    print("RESOURCE LOADING DIAGNOSTIC AND FIXED TOOL")
    print("=" * 80)
    print(
        "This tool examines resource loading and ensures the database has the necessary data.\n"
    )

    # Import necessary modules
    try:
        from src.backend.app import create_app
        from src.backend.models import db, Employee, ShiftTemplate, Coverage

        print("✅ Successfully imported required modules")
    except ImportError as e:
        print(f"❌ Error importing modules: {e}")
        return

    # Find and check the database file directly
    db_path = os.path.join(root_dir, "src/instance/app.db")
    if not os.path.exists(db_path):
        print(f"❌ Database file not found at {db_path}")
        return

    print(f"Database found at: {db_path}")

    # Direct sqlite3 check of tables and count
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Database tables: {[t[0] for t in tables]}")

        # Get counts
        for table in ["employees", "shifts", "coverage"]:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                print(f"Direct count of {table}: {count}")
            except sqlite3.OperationalError:
                print(f"❌ Table {table} not found")

        conn.close()
    except Exception as e:
        print(f"❌ Error accessing database directly: {e}")

    # Create Flask application context
    app = create_app()
    with app.app_context():
        try:
            # Check existing data
            print("\n1. CHECKING EXISTING DATA")
            print("-" * 40)

            employees = Employee.query.all()
            print(f"Employees: {len(employees)}")

            shifts = ShiftTemplate.query.all()
            print(f"Shift templates: {len(shifts)}")

            coverage = Coverage.query.all()
            print(f"Coverage records: {len(coverage)}")

            # Determine if we need to create test data
            needs_data = len(employees) == 0 or len(shifts) == 0 or len(coverage) == 0

            if needs_data:
                print("\n2. CREATING TEST DATA")
                print("-" * 40)
                print("Some resources are missing. Creating test data...")

                # Create employees if needed
                if len(employees) == 0:
                    print("Creating test employees...")
                    create_test_employees(db)

                # Create shift templates if needed
                if len(shifts) == 0:
                    print("Creating test shift templates...")
                    create_test_shifts(db)

                # Create coverage if needed
                if len(coverage) == 0:
                    print("Creating test coverage...")
                    create_test_coverage(db)

                # Recheck data
                employees = Employee.query.all()
                shifts = ShiftTemplate.query.all()
                coverage = Coverage.query.all()

                print("\nAfter creating test data:")
                print(f"Employees: {len(employees)}")
                print(f"Shift templates: {len(shifts)}")
                print(f"Coverage records: {len(coverage)}")

            # Check resource loading in scheduler
            print("\n3. TESTING SCHEDULER RESOURCE LOADING")
            print("-" * 40)

            from src.backend.services.scheduler.resources import ScheduleResources
            from src.backend.services.scheduler.generator import ScheduleGenerator

            # Test resource loader directly
            resources = ScheduleResources()
            resources.load()

            print(f"Resource loader got:")
            print(f"- Employees: {len(resources.employees)}")
            print(f"- Shifts: {len(resources.shifts)}")
            print(f"- Coverage: {len(resources.coverage)}")

            # Test scheduler with resources
            generator = ScheduleGenerator(resources=resources)

            # Generate schedule for one day to test
            print("\n4. TESTING SCHEDULE GENERATION WITH LOADED RESOURCES")
            print("-" * 40)

            test_date = date(2025, 5, 10)  # Saturday
            print(f"Testing with date: {test_date}")

            # Try to generate assignments for just this one day
            shift_needs = generator._process_coverage(test_date)
            print(f"Coverage needs: {shift_needs}")

            date_shifts = generator._create_date_shifts(test_date)
            print(f"Shift instances: {len(date_shifts)}")

            available_employees = (
                generator.distribution_manager.get_available_employees(test_date)
            )
            print(f"Available employees: {len(available_employees)}")

            print("\nResource loading diagnostics complete.")
            if shift_needs and date_shifts and available_employees:
                print("✅ All resources are now loading correctly.")
            else:
                print("⚠️ There are still issues with resource loading.")

        except Exception as e:
            print(f"❌ Error during resource loading diagnostics: {str(e)}")
            import traceback

            traceback.print_exc()


def create_test_employees(db):
    """Create test employees in the database"""
    from src.backend.models import Employee

    try:
        # Create test employees
        for i in range(1, 6):
            employee = Employee(
                name=f"Test Employee {i}",
                email=f"employee{i}@example.com",
                is_active=True,
                is_keyholder=(i == 1),  # Make first employee a keyholder
                contracted_hours=random.choice([20, 30, 40]),
                employee_group="Staff",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.session.add(employee)

        db.session.commit()
        print("✅ Created test employees")
        return True
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating test employees: {e}")
        return False


def create_test_shifts(db):
    """Create test shift templates in the database"""
    from src.backend.models import ShiftTemplate

    try:
        # Create early, middle, and late shift types
        shifts = [
            # Early shifts
            {
                "name": "Morning A",
                "start_time": "09:00",
                "end_time": "14:00",
                "shift_type": "EARLY",
                "active_days": "0,1,2,3,4,5,6",
            },
            {
                "name": "Morning B",
                "start_time": "10:00",
                "end_time": "15:00",
                "shift_type": "EARLY",
                "active_days": "0,1,2,3,4,5,6",
            },
            # Middle shifts
            {
                "name": "Midday A",
                "start_time": "11:00",
                "end_time": "16:00",
                "shift_type": "MIDDLE",
                "active_days": "0,1,2,3,4,5,6",
            },
            {
                "name": "Midday B",
                "start_time": "12:00",
                "end_time": "17:00",
                "shift_type": "MIDDLE",
                "active_days": "0,1,2,3,4,5,6",
            },
            # Late shifts
            {
                "name": "Evening A",
                "start_time": "15:00",
                "end_time": "20:00",
                "shift_type": "LATE",
                "active_days": "0,1,2,3,4,5,6",
            },
            {
                "name": "Evening B",
                "start_time": "16:00",
                "end_time": "21:00",
                "shift_type": "LATE",
                "active_days": "0,1,2,3,4,5,6",
            },
        ]

        for shift in shifts:
            template = ShiftTemplate(
                name=shift["name"],
                start_time=shift["start_time"],
                end_time=shift["end_time"],
                shift_type=shift["shift_type"],
                active_days=shift["active_days"],
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.session.add(template)

        db.session.commit()
        print("✅ Created test shift templates")
        return True
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating test shift templates: {e}")
        return False


def create_test_coverage(db):
    """Create test coverage records in the database"""
    from src.backend.models import Coverage

    try:
        # Create coverage for every day of the week
        for day in range(7):  # 0=Monday, 6=Sunday
            # First block (morning)
            morning = Coverage(
                day_index=day,
                start_time="09:00",
                end_time="13:00",
                min_employees=1,
                max_employees=2,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.session.add(morning)

            # Second block (afternoon)
            afternoon = Coverage(
                day_index=day,
                start_time="13:00",
                end_time="17:00",
                min_employees=1,
                max_employees=2,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.session.add(afternoon)

            # Third block (evening)
            evening = Coverage(
                day_index=day,
                start_time="17:00",
                end_time="21:00",
                min_employees=1,
                max_employees=2,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.session.add(evening)

        db.session.commit()
        print("✅ Created test coverage records")
        return True
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating test coverage records: {e}")
        return False


if __name__ == "__main__":
    main()
