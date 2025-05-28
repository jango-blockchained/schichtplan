from src.backend.app import create_app
from src.backend.models import db, Settings
import json

app = create_app()

with app.app_context():
    settings = db.session.query(Settings).first()
    
    if settings:
        print("\nSettings Details:")
        
        # Convert settings to dict and pretty print
        settings_dict = settings.to_dict()
        
        # Print each top-level category
        for category, values in settings_dict.items():
            print(f"\n=== {category.upper()} ===")
            
            if isinstance(values, dict):
                for key, value in values.items():
                    if isinstance(value, (dict, list)) and len(str(value)) > 100:
                        print(f"  {key}: [Complex data with {len(str(value))} characters]")
                    else:
                        print(f"  {key}: {value}")
            elif isinstance(values, list):
                print(f"  List with {len(values)} items")
                for item in values[:3]:  # Show first 3 items as examples
                    print(f"    - {item}")
                if len(values) > 3:
                    print(f"    ... and {len(values) - 3} more items")
            else:
                print(f"  {values}")
                
        # Specifically examine relevant settings for scheduling
        print("\n=== SCHEDULING SPECIFIC SETTINGS ===")
        if hasattr(settings, 'shift_types') and getattr(settings, 'shift_types'):
            shift_types = settings.shift_types
            print(f"Shift Types: {json.dumps(shift_types, indent=2)}")
        else:
            print("No shift_types found in settings")
            
        if hasattr(settings, 'employee_types') and getattr(settings, 'employee_types'):
            employee_types = settings.employee_types
            print(f"Employee Types: {json.dumps(employee_types, indent=2)}")
        else:
            print("No employee_types found in settings")
            
        if hasattr(settings, 'absence_types') and getattr(settings, 'absence_types'):
            absence_types = settings.absence_types
            print(f"Absence Types: {json.dumps(absence_types, indent=2)}")
        else:
            print("No absence_types found in settings")
            
        if hasattr(settings, 'availability_types') and getattr(settings, 'availability_types'):
            availability_types = settings.availability_types
            print(f"Availability Types: {json.dumps(availability_types, indent=2)}")
        else:
            print("No availability_types found in settings")
    else:
        print("No settings found in database") 