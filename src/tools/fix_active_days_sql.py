import os
import sys
import json

# Set Python path
sys.path.insert(0, os.path.abspath('.'))

# Import the app directly
from src.backend.app import create_app

app = create_app()

with app.app_context():
    from src.backend.models import db
    from sqlalchemy.sql import text
    
    # Step 1: First get the current values to show the before state
    print("Current active_days values:")
    select_query = text("SELECT id, start_time, end_time, shift_type, active_days FROM shifts")
    result = db.session.execute(select_query)
    shifts_before = []
    
    for row in result:
        shift_id, start_time, end_time, shift_type, active_days = row
        print(f"Shift ID {shift_id}: {start_time}-{end_time}, Type: {shift_type}")
        print(f"  Current active_days: {active_days}")
        shifts_before.append((shift_id, active_days))
    
    # Step 2: Update all shifts to make Monday (day 0) active
    print("\nUpdating active_days for all shifts...")
    
    for shift_id, active_days in shifts_before:
        # Parse current active_days
        if isinstance(active_days, str):
            try:
                active_days_dict = json.loads(active_days)
            except json.JSONDecodeError:
                print(f"  Error: Could not parse active_days as JSON for shift {shift_id}")
                continue
        else:
            active_days_dict = active_days
        
        # Update to enable Monday (day 0)
        active_days_dict['0'] = True
        
        # Convert back to JSON string for SQL update
        new_active_days = json.dumps(active_days_dict)
        
        # Update in database
        update_query = text(f"UPDATE shifts SET active_days = :active_days WHERE id = :shift_id")
        db.session.execute(update_query, {"active_days": new_active_days, "shift_id": shift_id})
        print(f"  Updated shift ID {shift_id}: '0' set to True")
    
    # Commit changes
    try:
        db.session.commit()
        print("\nChanges committed successfully!")
    except Exception as e:
        db.session.rollback()
        print(f"\nError committing changes: {e}")
    
    # Step 3: Verify changes
    print("\nVerifying changes:")
    verify_query = text("SELECT id, start_time, end_time, shift_type, active_days FROM shifts")
    result = db.session.execute(verify_query)
    
    for row in result:
        shift_id, start_time, end_time, shift_type, active_days = row
        print(f"Shift ID {shift_id}: {start_time}-{end_time}, Type: {shift_type}")
        print(f"  Updated active_days: {active_days}")
        
        # Check if Monday is now active
        if isinstance(active_days, str):
            try:
                active_days_dict = json.loads(active_days)
                monday_active = active_days_dict.get('0', False)
                print(f"  Monday active: {monday_active}")
            except json.JSONDecodeError:
                print(f"  Error: Could not parse active_days as JSON")
        else:
            monday_active = active_days.get('0', False)
            print(f"  Monday active: {monday_active}") 