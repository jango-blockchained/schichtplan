#!/usr/bin/env python
"""
Simple diagnostic script for the schedule generator.
This script uses Flask's application factory pattern to create the app
and test the database connection and scheduler.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy import text
from collections import defaultdict

# Set up paths
project_root = Path(__file__).resolve().parent.parent.parent.parent
backend_dir = project_root / "src" / "backend"

# Add backend directory to Python path
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

print("Schedule Generator Simple Diagnostic")
print("=" * 80)


def get_shift_details(engine, shift_id):
    """Get shift details from the database"""
    with engine.connect() as conn:
        result = conn.execute(
            text(
                "SELECT id, shift_type, start_time, end_time FROM shifts WHERE id = :id"
            ),
            {"id": shift_id},
        ).fetchone()
        if result:
            return {
                "id": result[0],
                "shift_type": result[1],
                "start_time": result[2],
                "end_time": result[3],
            }
    return None


def get_employee_name(engine, employee_id):
    """Get employee name from the database"""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT first_name, last_name FROM employees WHERE id = :id"),
            {"id": employee_id},
        ).fetchone()
        if result:
            return f"{result[0]} {result[1]}"
    return f"Employee {employee_id}"


def analyze_schedule(schedule_entries, engine):
    """Analyze schedule entries and return statistics"""
    shifts_by_date = defaultdict(list)
    shifts_by_employee = defaultdict(list)
    total_hours = 0

    for entry in schedule_entries:
        # Convert SQLAlchemy model to dict if needed
        if hasattr(entry, "__dict__"):
            entry = {k: v for k, v in entry.__dict__.items() if not k.startswith("_")}

        date = entry.get("date")
        employee_id = entry.get("employee_id")
        shift_id = entry.get("shift_id")

        # Get shift details from database
        shift_details = get_shift_details(engine, shift_id) if shift_id else None
        employee_name = (
            get_employee_name(engine, employee_id) if employee_id else "Unknown"
        )

        # Create enriched entry with shift details
        enriched_entry = {
            "date": date,
            "employee_id": employee_id,
            "employee_name": employee_name,
            "shift_type": shift_details.get("shift_type") if shift_details else None,
            "start_time": shift_details.get("start_time") if shift_details else None,
            "end_time": shift_details.get("end_time") if shift_details else None,
        }

        if date:
            shifts_by_date[date].append(enriched_entry)
        if employee_id:
            shifts_by_employee[employee_id].append(enriched_entry)

        # Calculate hours if times are available
        if (
            shift_details
            and shift_details.get("start_time")
            and shift_details.get("end_time")
        ):
            try:
                start = datetime.strptime(shift_details["start_time"], "%H:%M")
                end = datetime.strptime(shift_details["end_time"], "%H:%M")
                hours = (end - start).total_seconds() / 3600
                total_hours += hours
            except ValueError:
                pass

    return {
        "total_shifts": len(schedule_entries),
        "days_covered": len(shifts_by_date),
        "employees_scheduled": len(shifts_by_employee),
        "shifts_by_date": dict(shifts_by_date),
        "shifts_by_employee": dict(shifts_by_employee),
        "total_hours": total_hours,
    }


def run_diagnostic():
    print("Checking environment...")
    print(f"Project root: {project_root}")
    print(f"Backend directory: {backend_dir}")
    print(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
    print(f"FLASK_APP: {os.environ.get('FLASK_APP')}")
    print(f"FLASK_ENV: {os.environ.get('FLASK_ENV')}")
    print(f"DEBUG_MODE: {os.environ.get('DEBUG_MODE')}")
    print()

    print("Step 1: Importing required modules...")
    try:
        print("  Importing Flask...")
        from flask import Flask

        print("  ✅ Flask imported successfully")
    except ImportError as e:
        print(f"  ❌ Error importing Flask: {e}")
        return

    try:
        print("  Importing app module...")
        from src.backend.app import create_app

        print("  ✅ App module imported successfully")
    except ImportError as e:
        print(f"  ❌ Error importing app module: {e}")
        return

    print("\nStep 2: Creating Flask application...")
    app = create_app()
    print(f"  Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print("  ✅ Flask app created successfully")

    print("\nStep 3: Testing database connection...")
    with app.app_context():
        try:
            print("  Importing models...")
            # Import db first to ensure it's initialized with the app
            from src.backend.models import db

            # Then import the models
            from src.backend.models.employee import Employee
            from src.backend.models.fixed_shift import ShiftTemplate
            from src.backend.models.coverage import Coverage

            print("  ✅ Models imported successfully")
        except ImportError as e:
            print(f"  ❌ Error importing models: {e}")
            return

        try:
            print("  Testing database connection...")
            # Use engine directly from app config
            from sqlalchemy import create_engine

            engine = create_engine(app.config["SQLALCHEMY_DATABASE_URI"])
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1")).scalar()
                if result == 1:
                    print("  ✅ Database connection successful")
                else:
                    print("  ❌ Database connection failed: Unexpected result")
                    return
        except Exception as e:
            print(f"  ❌ Database error: {str(e)}")
            print(f"  Error type: {type(e).__name__}")
            import traceback

            print(traceback.format_exc())
            return

        print("\nStep 4: Checking database status...")
        try:
            # Use raw SQL queries to check table counts
            with engine.connect() as conn:
                # Get table names
                tables = conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                ).fetchall()
                print("  Tables in database:")
                for table in tables:
                    print(f"    - {table[0]}")

                # Get table counts using raw SQL with correct table names
                employee_count = conn.execute(
                    text("SELECT COUNT(*) FROM employees")
                ).scalar()
                shift_count = conn.execute(text("SELECT COUNT(*) FROM shifts")).scalar()
                coverage_count = conn.execute(
                    text("SELECT COUNT(*) FROM coverage")
                ).scalar()

            print("\n  Table counts:")
            print(f"    - Employees: {employee_count}")
            print(f"    - Shifts: {shift_count}")
            print(f"    - Coverage requirements: {coverage_count}")
            print("  ✅ Database queries successful")
        except Exception as e:
            print(f"  ❌ Error querying database: {str(e)}")
            print(f"  Error type: {type(e).__name__}")
            import traceback

            print(traceback.format_exc())
            return

        print("\nStep 5: Testing scheduler...")
        try:
            from src.backend.services.scheduler import ScheduleGenerator

            print("  ✅ Scheduler imported successfully")

            start_date = datetime.now().date()
            end_date = start_date + timedelta(days=2)

            print(f"\nGenerating schedule from {start_date} to {end_date}...")
            start_time = datetime.now()

            generator = ScheduleGenerator()
            schedule = generator.generate_schedule(start_date, end_date)

            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            print(f"  Schedule generation completed in {duration:.2f} seconds")

            # Analyze schedule entries
            schedule_entries = schedule.get("schedule", [])
            stats = analyze_schedule(schedule_entries, engine)

            print("\n  Schedule Statistics:")
            print(f"    - Total shifts assigned: {stats['total_shifts']}")
            print(f"    - Days covered: {stats['days_covered']}")
            print(f"    - Employees scheduled: {stats['employees_scheduled']}")
            print(f"    - Total scheduled hours: {stats['total_hours']:.1f}")

            print("\n  Shifts per day:")
            for date, shifts in sorted(stats["shifts_by_date"].items()):
                print(f"    - {date}: {len(shifts)} shifts")
                for shift in shifts:
                    print(
                        f"      * {shift['employee_name']} - {shift['shift_type']} ({shift['start_time']} to {shift['end_time']})"
                    )

            print(f"\n  Warnings: {len(schedule.get('warnings', []))}")
            if schedule.get("warnings"):
                print("\n  Warning details:")
                for warning in schedule.get("warnings", []):
                    print(
                        f"    - {warning.get('type', 'Unknown')}: {warning.get('message', 'No message')}"
                    )

            print(f"  Errors: {len(schedule.get('errors', []))}")
            print("  ✅ Schedule generation successful")
        except Exception as e:
            print(f"  ❌ Error testing scheduler: {str(e)}")
            print(f"  Error type: {type(e).__name__}")
            import traceback

            print(traceback.format_exc())
            return

    print("\n✅ All tests passed!")
    print("Diagnostic completed successfully.")


if __name__ == "__main__":
    run_diagnostic()
