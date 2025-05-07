#!/usr/bin/env python3
"""
Test script to verify the database saving of schedules.
This script should be run from the project root where the Flask app is initialized.
"""

import os
import sys
from datetime import date, datetime, timedelta

print("Starting schedule generator database save test")
print("==========================================")

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), "src", "backend"))

# Import the Flask app creator function
from src.backend.app import create_app
from src.backend.models import db, Schedule, Employee
from src.backend.services.scheduler.generator import ScheduleGenerator
from src.backend.services.scheduler.resources import ScheduleResources

# Create the Flask app
app = create_app()

# Push application context
with app.app_context():
    print("Entered Flask app context")
    
    # Create date range for testing
    today = date.today()
    start_date = today
    end_date = today + timedelta(days=6)  # One week
    version = 999  # Use a unique version for testing
    
    print(f"Test parameters: start_date={start_date}, end_date={end_date}, version={version}")
    
    # Check for existing data in test version
    existing_count = Schedule.query.filter_by(version=version).count()
    print(f"Found {existing_count} existing schedules for version {version}")
    
    if existing_count > 0:
        print("Cleaning up existing test data")
        try:
            Schedule.query.filter_by(version=version).delete()
            db.session.commit()
            print(f"Deleted {existing_count} existing test schedules")
        except Exception as e:
            print(f"Failed to delete existing test data: {e}")
            db.session.rollback()
    
    try:
        # Initialize ScheduleGenerator
        resources = ScheduleResources()
        resources.load()
        generator = ScheduleGenerator(resources=resources)
        
        print("ScheduleGenerator initialized")
        
        # Generate schedule
        print("Generating schedule")
        result = generator.generate(
            start_date=start_date,
            end_date=end_date,
            create_empty_schedules=True,
            version=version
        )
        
        print(f"Schedule generation result: {len(result.get('schedules', []))} schedules generated")
        
        # Test saving to database
        print("Calling _save_to_database")
        save_result = generator._save_to_database()
        
        print(f"Save result: {save_result}")
        
        # Verify data was saved
        saved_count = Schedule.query.filter_by(version=version).count()
        print(f"Found {saved_count} schedules in database for version {version}")
        
        # Get breakdown of saved data
        with_shift = Schedule.query.filter(Schedule.version == version, Schedule.shift_id != None).count()
        without_shift = Schedule.query.filter(Schedule.version == version, Schedule.shift_id == None).count()
        
        print(f"Schedules with shift assignments: {with_shift}")
        print(f"Schedules without shift assignments (empty): {without_shift}")
        
        # Detailed verification
        if saved_count > 0:
            print("Schedule save test PASSED ✅")
            print("Database saving is working correctly")
        else:
            print("Schedule save test FAILED ❌")
            print("No schedules were saved to the database")
            
    except Exception as e:
        import traceback
        print(f"Test failed with error: {e}")
        traceback.print_exc()
    finally:
        # Clean up test data (optional)
        # Schedule.query.filter_by(version=version).delete()
        # db.session.commit()
        # print(f"Cleaned up test data for version {version}")
        
        print("Test completed") 