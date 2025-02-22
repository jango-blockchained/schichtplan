from models import db, Settings
from app import create_app
import json

app = create_app()

with app.app_context():
    settings = Settings.query.first()
    if settings:
        print("Settings found!")
        print("\nEmployee Types:")
        print(json.dumps(settings.employee_types, indent=2))
        print("\nMin Employees Per Shift:", settings.min_employees_per_shift)
        print("Max Employees Per Shift:", settings.max_employees_per_shift)
    else:
        print("No settings found in database!") 