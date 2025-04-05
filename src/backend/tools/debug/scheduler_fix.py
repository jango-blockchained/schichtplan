#!/usr/bin/env python
"""
Script to fix the SQLAlchemy Flask app registration issue in the scheduler resources.
This script creates a monkey patch for the db in resources.py to ensure proper app context.
"""

import sys
import os
import importlib
from flask_sqlalchemy import SQLAlchemy
from unittest.mock import MagicMock
from datetime import date, timedelta

# Add the parent directory to Python path to ensure imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
project_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

class DBProxy:
    """A proxy for the SQLAlchemy database instance that ensures app context is used."""
    
    def __init__(self, app, db):
        """Initialize with the Flask app and SQLAlchemy instance."""
        self._app = app
        self._db = db
        
    def __getattr__(self, name):
        """
        Proxy attribute access to ensure app context.
        
        Args:
            name: The attribute name to access
            
        Returns:
            The requested attribute with proper app context handling
        """
        # Handle special attributes for session access
        if name == 'session':
            # Check if we're already in app context
            try:
                from flask import current_app
                if current_app:
                    # Already in app context
                    return getattr(self._db, name)
            except RuntimeError:
                # Not in app context, create one
                with self._app.app_context():
                    return getattr(self._db, name)
        
        # Handle engine attribute specially
        if name in ('engine', 'engines'):
            # Always use app context for engine operations
            with self._app.app_context():
                return getattr(self._db, name)
        
        # For other attributes, return directly
        return getattr(self._db, name)
    
    def __setattr__(self, name, value):
        """
        Proxy attribute setting.
        
        Args:
            name: The attribute name to set
            value: The value to set
            
        Returns:
            None
        """
        if name in ('_app', '_db'):
            # Set internal attributes directly
            super().__setattr__(name, value)
        else:
            # Set other attributes on the proxied db
            setattr(self._db, name, value)

def run_with_patched_db():
    """Run the scheduler resources with a patched db connection."""
    try:
        # Import the Flask app
        print("Importing app...")
        from src.backend.app import create_app
        
        # Create app instance
        app = create_app()
        print("App created successfully")
        
        # Import the original db
        from src.backend.models import db as original_db
        
        # Create a proxy for the db
        db_proxy = DBProxy(app, original_db)
        
        # Monkey patch the db in the resources module
        print("Setting up DB proxy...")
        
        # First, reload the module to ensure we're patching the latest version
        # This forces reloading of the module with our patched db
        if 'src.backend.services.scheduler.resources' in sys.modules:
            del sys.modules['src.backend.services.scheduler.resources']
        
        # Import the module
        from src.backend.services.scheduler import resources
        
        # Replace the db with our proxy
        resources.db = db_proxy
        print("DB proxy installed successfully")
        
        # Now test the patched resources
        print("\n--- TESTING PATCHED SCHEDULER RESOURCES ---")
        with app.app_context():
            # Import models
            from src.backend.models import Employee, ShiftTemplate, Settings, Coverage
            
            # Create resources instance
            today = date.today()
            end_date = today + timedelta(days=6)
            
            # Create resources with our patched module
            resources = resources.ScheduleResources(start_date=today, end_date=end_date)
            print(f"Resources object created for date range: {today} to {end_date}")
            
            # Try to load resources
            print("Loading resources...")
            load_success = resources.load()
            
            print(f"\nResources loaded successfully: {load_success}")
            
            if load_success:
                print(f"Employees loaded: {len(resources.employees)}")
                print(f"Shifts loaded: {len(resources.shifts)}")
                print(f"Coverage requirements loaded: {len(resources.coverage)}")
                print(f"Absences loaded: {len(resources.absences)}")
                print(f"Availabilities loaded: {len(resources.availabilities)}")
                
                # Show first few employees
                for i, emp in enumerate(resources.employees[:3]):
                    print(f"  Employee {i+1}: {getattr(emp, 'first_name', '')} {getattr(emp, 'last_name', '')} "
                        f"- ID: {getattr(emp, 'id', 'Unknown')}")
                
                # Show first few shifts
                for i, shift in enumerate(resources.shifts[:3]):
                    print(f"  Shift {i+1}: {getattr(shift, 'start_time', '')}-{getattr(shift, 'end_time', '')} "
                        f"- ID: {getattr(shift, 'id', 'Unknown')}")
            else:
                print("Resources failed to load even with patched DB.")
                print("This suggests there may be deeper issues with the database or models.")
            
            print("\n--- CREATING FIXED MODULE ---")
            print("To fix this issue permanently, you need to:")
            print("1. Modify the resources.py file to properly use Flask app context")
            print("2. Ensure all database operations in resources.py occur within app_context()")
            print("3. Consider refactoring to use dependency injection for the db instance")
            
            # Create an example fixed version
            print("\nExample fix for the _load_settings method:")
            print("-------------------------------------------")
            print("def _load_settings(self):")
            print("    from flask import current_app")
            print("    with current_app.app_context():")
            print("        settings = Settings.query.first()")
            print("        if not settings:")
            print("            settings = Settings()")
            print("            db.session.add(settings)")
            print("            db.session.commit()")
            print("    return settings")
            
            print("\n--- COMPLETED ---")
            
    except Exception as e:
        import traceback
        print(f"Error in monkey patching: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    run_with_patched_db() 