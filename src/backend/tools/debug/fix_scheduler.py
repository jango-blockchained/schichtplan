#!/usr/bin/env python
"""
Utility to fix the Flask SQLAlchemy app registration in the scheduler.
This script properly initializes the app context and tests a scheduler resources load.
"""

import sys
import os
import traceback
from datetime import date, timedelta

# Add the parent directory to Python path to ensure imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
project_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

def fix_scheduler():
    """Test the scheduler resources with a proper app context."""
    try:
        # Import the Flask app
        print("Importing app...")
        from src.backend.app import create_app
        
        # Create app instance
        app = create_app()
        print("App created successfully")
        
        # Run inside app context
        with app.app_context():
            print("Inside app context...")
            
            # Import models and scheduler resources
            from src.backend.models import db, Employee, ShiftTemplate, Settings, Coverage
            from src.backend.services.scheduler.resources import ScheduleResources
            
            # Check database connection
            print("\n--- CHECKING DATABASE CONNECTION ---")
            try:
                engine_url = str(db.engine.url)
                print(f"Database URL: {engine_url}")
                connection = db.engine.connect()
                print("Database connection successful!")
                connection.close()
            except Exception as e:
                print(f"Database connection error: {e}")
                traceback.print_exc()
            
            # Check if tables exist
            print("\n--- CHECKING DATABASE TABLES ---")
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            tables = inspector.get_table_names()
            print(f"Tables in database: {', '.join(tables[:10])}{'...' if len(tables) > 10 else ''}")
            
            # Check if models can be queried
            print("\n--- CHECKING MODELS ---")
            try:
                employee_count = Employee.query.count()
                shift_count = ShiftTemplate.query.count()
                settings = Settings.query.first()
                coverage_count = Coverage.query.count()
                
                print(f"Employees: {employee_count}")
                print(f"Shift templates: {shift_count}")
                print(f"Settings: {'Found' if settings else 'Not found'}")
                print(f"Coverage requirements: {coverage_count}")
            except Exception as e:
                print(f"Model query error: {e}")
                traceback.print_exc()
            
            # Test scheduler resources
            print("\n--- TESTING SCHEDULER RESOURCES ---")
            try:
                today = date.today()
                end_date = today + timedelta(days=6)
                
                resources = ScheduleResources(start_date=today, end_date=end_date)
                load_success = resources.load()
                
                print(f"Resources loaded successfully: {load_success}")
                print(f"Employees loaded: {len(resources.employees)}")
                print(f"Shifts loaded: {len(resources.shifts)}")
                print(f"Coverage requirements loaded: {len(resources.coverage)}")
                
                if not load_success:
                    print("\nDIAGNOSTIC: The app context is properly initialized but resource loading failed.")
                    print("Check resource loading methods and database state for issues.")
                else:
                    print("\nDIAGNOSTIC: Scheduler resources loaded successfully with proper app context.")
            except Exception as e:
                print(f"Scheduler resources error: {e}")
                traceback.print_exc()
            
            # Verify app registration for SQLAlchemy
            print("\n--- CHECKING SQLALCHEMY APP REGISTRATION ---")
            try:
                print(f"db._app: {getattr(db, '_app', 'Not available')}")
                print(f"db.app: {getattr(db, 'app', 'Not available')}")
                print(f"Current app in app context: {app}")
                print(f"Is database extension initialized: {db.get_app() is not None}")
            except Exception as e:
                print(f"SQLAlchemy app check error: {e}")
                traceback.print_exc()
            
            print("\n--- COMPLETED ---")
            print("If any errors occurred, check the app factory and database initialization.")
            print("Ensure app.app_context() is used when accessing db.session or model queries.")
    
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    fix_scheduler() 