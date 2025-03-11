#!/usr/bin/env python3
"""
Application diagnostic script for Schichtplan schedule generator
This script directly uses the Flask application factory pattern
"""

import os
import sys
import time
import traceback
from datetime import date, timedelta
from pathlib import Path

# Add the backend directory to Python path
script_dir = Path(__file__).resolve().parent
backend_dir = script_dir.parent.parent
project_root = backend_dir.parent

# Ensure backend directory is in Python path
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


def run_diagnostic():
    """Run diagnostic tests for the Schichtplan schedule generator."""
    try:
        # Print environment information
        print("\n==== ENVIRONMENT INFORMATION ====")
        print(f"Python version: {sys.version}")
        print(f"Current directory: {os.getcwd()}")
        print(f"Project root: {project_root}")
        print(f"Backend directory: {backend_dir}")
        print(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
        print(f"FLASK_APP: {os.environ.get('FLASK_APP')}")
        print(f"sys.path: {sys.path}")

        # Set up environment variables
        os.environ["PYTHONPATH"] = str(project_root)
        os.environ["FLASK_APP"] = "src.backend.app"
        os.environ["FLASK_ENV"] = "development"

        # Import Flask and create app
        print("\n==== TEST 1: Initialize Flask App ====")
        from app import create_app

        app = create_app()
        print("Flask app created successfully")
        print(f"App instance path: {app.instance_path}")
        print(f"App root path: {app.root_path}")
        print(f"Debug mode: {app.debug}")
        print(f"Testing mode: {app.testing}")
        print(f"Database URI: {app.config.get('SQLALCHEMY_DATABASE_URI')}")

        # Import models
        print("\n==== TEST 2: Import Models ====")
        from models import db, Employee, ShiftTemplate, Coverage

        print("Models imported successfully")

        # Test database connection
        print("\n==== TEST 3: Database Connection ====")
        with app.app_context():
            try:
                from sqlalchemy import text

                # Test basic connectivity
                result = db.session.execute(text("SELECT 1")).scalar()
                print(f"Basic database query result: {result}")

                # Check tables
                employee_count = Employee.query.count()
                shift_count = ShiftTemplate.query.count()
                coverage_count = Coverage.query.count()

                print("Database status:")
                print(f"  - Employee count: {employee_count}")
                print(f"  - Shift template count: {shift_count}")
                print(f"  - Coverage requirement count: {coverage_count}")
            except Exception as e:
                print(f"Database connection error: {e}")
                traceback.print_exc()
                sys.exit(1)

        # Import scheduler
        print("\n==== TEST 4: Import Scheduler ====")
        try:
            from services.scheduler import ScheduleGenerator

            print("Scheduler imported successfully")
        except Exception as e:
            print(f"Scheduler import error: {e}")
            traceback.print_exc()
            sys.exit(1)

        # Initialize scheduler
        print("\n==== TEST 5: Initialize Scheduler ====")
        with app.app_context():
            try:
                generator = ScheduleGenerator()
                print("ScheduleGenerator initialized successfully")
                print(f"Generator resources loaded: {hasattr(generator, 'resources')}")
            except Exception as e:
                print(f"Scheduler initialization error: {e}")
                traceback.print_exc()
                sys.exit(1)

        # Generate schedule (simple test)
        print("\n==== TEST 6: Generate Schedule (Simple Test) ====")
        with app.app_context():
            try:
                generator = ScheduleGenerator()
                print("Generating schedule...")

                # Use today and the next 2 days for a quick test
                today = date.today()
                end_date = today + timedelta(days=2)

                start_time = time.time()
                result = generator.generate(
                    start_date=today, end_date=end_date, version=1
                )
                end_time = time.time()

                schedule_entries = result.get("schedule", [])
                warnings = result.get("warnings", [])
                errors = result.get("errors", [])

                print(f"Schedule generated in {end_time - start_time:.2f} seconds:")
                print(f"  - Date range: {today} to {end_date}")
                print(f"  - Entries: {len(schedule_entries)}")
                print(f"  - Warnings: {len(warnings)}")
                print(f"  - Errors: {len(errors)}")

                if errors:
                    print("\nSample errors:")
                    for i, error in enumerate(errors[:3]):
                        print(f"  {i + 1}. {error.get('message', 'Unknown error')}")
                    if len(errors) > 3:
                        print(f"  ... and {len(errors) - 3} more")
            except Exception as e:
                print(f"Schedule generation error: {e}")
                traceback.print_exc()
                sys.exit(1)

        # All tests passed
        print("\n==== ALL TESTS PASSED ====")
        print("Diagnostic completed successfully")

    except Exception as e:
        print(f"\nDIAGNOSTIC FAILED: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    run_diagnostic()
