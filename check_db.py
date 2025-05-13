import sys
import os

# Add the current directory to the Python path
sys.path.append('.')

from src.backend.models import db, Schedule, ScheduleVersionMeta
from src.backend.app import create_app

def check_database():
    # Create app instance
    app = create_app()
    
    # Use app context to access the database
    with app.app_context():
        # Check for version 2 schedules
        v2_schedules = db.session.query(Schedule).filter(Schedule.version == 2).all()
        print(f"\nFound {len(v2_schedules)} schedule entries for version 2")
        
        # Check version metadata
        version_meta = db.session.query(ScheduleVersionMeta).filter(ScheduleVersionMeta.version == 2).first()
        if version_meta:
            print(f"\nVersion 2 metadata found:")
            print(f"  Created at: {version_meta.created_at}")
            print(f"  Date range: {version_meta.date_range_start} to {version_meta.date_range_end}")
            print(f"  Status: {version_meta.status}")
            print(f"  Notes: {version_meta.notes}")
        else:
            print("\nNo metadata found for version 2")
        
        # Display a few schedules if they exist
        if v2_schedules:
            print("\nSample schedules for version 2:")
            for i, schedule in enumerate(v2_schedules[:5]):
                print(f"\nSchedule {i+1}:")
                print(f"  ID: {schedule.id}")
                print(f"  Employee ID: {schedule.employee_id}")
                print(f"  Shift ID: {schedule.shift_id}")
                print(f"  Date: {schedule.date}")
                print(f"  Status: {schedule.status}")
                print(f"  Shift Type: {schedule.shift_type}")
        
        # Check total schedule count
        total_schedules = db.session.query(Schedule).count()
        print(f"\nTotal schedules in database: {total_schedules}")
        
        # Check which versions exist
        versions = db.session.query(Schedule.version).distinct().all()
        version_numbers = [v[0] for v in versions]
        print(f"\nVersions in database: {version_numbers}")
        
        # Check the generator method that should be saving schedules
        print("\nLooking for scheduler database save code...")
        # This is just informational since we can't actually check the code from within Python
        print("Check src/backend/services/scheduler/generator.py for the _save_to_database method")

if __name__ == "__main__":
    check_database() 