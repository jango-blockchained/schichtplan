import os
import sys

# Set Python path
sys.path.insert(0, os.path.abspath('.'))

# Import the app directly
from src.backend.app import create_app

app = create_app()

with app.app_context():
    from src.backend.models import ShiftTemplate, db
    import json
    
    # Get all shift templates
    shifts = ShiftTemplate.query.all()
    print(f"Found {len(shifts)} shift templates to update")
    
    # Update active_days for each shift
    for shift in shifts:
        print(f"Updating shift ID {shift.id}: {shift.start_time}-{shift.end_time}, Type: {shift.shift_type}")
        
        # Get current active_days
        current_active_days = shift.active_days
        print(f"  Current active_days: {current_active_days}")
        
        # Update to enable Monday (day 0)
        if isinstance(current_active_days, dict):
            current_active_days['0'] = True
        elif isinstance(current_active_days, str):
            # If stored as JSON string, parse it first
            try:
                active_days_dict = json.loads(current_active_days)
                active_days_dict['0'] = True
                current_active_days = json.dumps(active_days_dict)
            except json.JSONDecodeError:
                print(f"  Error: Could not parse active_days as JSON for shift {shift.id}")
        
        # Update the shift
        shift.active_days = current_active_days
        print(f"  Updated active_days: {shift.active_days}")
    
    # Commit changes
    try:
        db.session.commit()
        print("Changes committed successfully!")
    except Exception as e:
        db.session.rollback()
        print(f"Error committing changes: {e}")
        
    # Verify changes
    print("\nVerifying changes:")
    for i, shift in enumerate(ShiftTemplate.query.limit(5).all()):
        print(f"Shift {i+1} (ID: {shift.id}): active_days = {shift.active_days}") 