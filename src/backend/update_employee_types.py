from models import db, Settings
from app import create_app

app = create_app()

with app.app_context():
    settings = Settings.query.first()
    if settings:
        print("Updating employee types...")
        settings.employee_types = [
            {'id': 'VL', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 40},
            {'id': 'TL', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
            {'id': 'TZ', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
            {'id': 'GFB', 'name': 'Geringfügig Beschäftigt', 'min_hours': 0, 'max_hours': 14}
        ]
        try:
            db.session.commit()
            print("Employee types updated successfully!")
        except Exception as e:
            db.session.rollback()
            print(f"Error updating employee types: {str(e)}")
    else:
        print("No settings found in database!") 