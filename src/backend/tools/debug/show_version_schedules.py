import os
import sys
from datetime import datetime

# Add the project root to sys.path to allow imports from src
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from src.backend.app import create_app
    from src.backend.models import db
    from src.backend.models.schedule import Schedule
except ImportError as e:
    print(f"Error importing necessary modules: {e}")
    print("Please ensure this script is run from a context where 'src.backend' can be imported,")
    print("typically from the project root or after setting PYTHONPATH appropriately.")
    sys.exit(1)

def get_schedules_for_version(version_id):
    """
    Fetches and prints all schedule entries for a given version ID.
    """
    app = create_app()
    with app.app_context():
        print(f"Fetching schedule entries for version {version_id}...")
        
        schedules = Schedule.query.filter_by(version=version_id).all()
        
        if not schedules:
            print(f"No schedule entries found for version {version_id}.")
            return
            
        print(f"\nFound {len(schedules)} schedule entries for version {version_id}:\n")
        
        for i, schedule_entry in enumerate(schedules):
            print(f"--- Schedule Entry {i+1} (ID: {schedule_entry.id}) ---")
            details = schedule_entry.to_dict()
            for key, value in details.items():
                # Handle datetime objects specifically if they are not already strings
                if isinstance(value, datetime):
                    print(f"  {key}: {value.isoformat()}")
                else:
                    print(f"  {key}: {value}")
            print("-" * 30)

if __name__ == "__main__":
    target_version = 4
    try:
        get_schedules_for_version(target_version)
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc() 