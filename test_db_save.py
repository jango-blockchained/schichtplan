#!/usr/bin/env python3
"""
Test script to verify the database saving of schedules.
"""

import os
import sys
from datetime import date, timedelta

# Add the project root to the Python path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Create the Flask app and set up context
from src.backend.app import create_app
from src.backend.models import db, Schedule, ScheduleVersionMeta

print("Starting schedule database save test")
print("===================================")

# Create and configure the app
app = create_app()

# Set up the context
with app.app_context():
    # Test parameters
    today = date.today()
    start_date = today
    end_date = today + timedelta(days=6)  # One week
    version = 2  # Version 2 for testing
    
    print(f"Test parameters: start_date={start_date}, end_date={end_date}, version={version}")
    
    # Check for existing schedules with version 2
    existing_count = db.session.query(Schedule).filter(Schedule.version == version).count()
    print(f"Found {existing_count} existing schedules for version {version}")
    
    # Check for version metadata
    version_meta = db.session.query(ScheduleVersionMeta).filter(ScheduleVersionMeta.version == version).first()
    if version_meta:
        print(f"Version {version} metadata found:")
        print(f"  Created at: {version_meta.created_at}")
        print(f"  Date range: {version_meta.date_range_start} to {version_meta.date_range_end}")
        print(f"  Status: {version_meta.status}")
        print(f"  Notes: {version_meta.notes}")
    else:
        print(f"No metadata found for version {version}")
    
    # If we have existing schedules, display a few samples
    if existing_count > 0:
        print("\nSample schedules:")
        schedules = db.session.query(Schedule).filter(Schedule.version == version).limit(5).all()
        for i, schedule in enumerate(schedules):
            print(f"\nSchedule {i+1}:")
            print(f"  ID: {schedule.id}")
            print(f"  Employee ID: {schedule.employee_id}")
            print(f"  Shift ID: {schedule.shift_id}")
            print(f"  Date: {schedule.date}")
            print(f"  Status: {schedule.status}")
            print(f"  Shift Type: {schedule.shift_type}")
    
    # Initialize schedule generator and generate schedules
    try:
        print("\nInitializing schedule generator...")
        from src.backend.services.scheduler import ScheduleGenerator
        
        generator = ScheduleGenerator()
        
        print(f"Generating schedule for {start_date} to {end_date} (version {version})...")
        result = generator.generate(
            start_date=start_date,
            end_date=end_date,
            create_empty_schedules=True,
            version=version
        )
        
        # Check the result
        print(f"\nGeneration result: {len(result.get('schedules', []))} schedules created")
        
        # Explicitly call save_to_database method
        print("Explicitly calling _save_to_database method...")
        generator._save_to_database()
        
        # Check for schedules after save
        new_count = db.session.query(Schedule).filter(Schedule.version == version).count()
        print(f"\nFound {new_count} schedules for version {version} after generation")
        
        if new_count > existing_count:
            print(f"SUCCESS: {new_count - existing_count} new schedules were added to the database")
        else:
            print("WARNING: No new schedules were added to the database")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc() 