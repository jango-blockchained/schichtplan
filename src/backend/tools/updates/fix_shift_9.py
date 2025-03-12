import os
import sys

# Add the backend directory to the path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
sys.path.insert(0, backend_dir)

from models import db
from models.shift import Shift
from models.settings import Settings
from flask import Flask

# Create a Flask application context
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///../../instance/app.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

with app.app_context():
    # Check if shift 9 exists
    shift = Shift.query.filter_by(id=9).first()
    if shift:
        print(f"Found shift 9: {shift.name}")

        # Update shift 9
        shift.name = "Closing"
        shift.color = "#3b82f6"  # Blue
        db.session.commit()
        print(f"Updated shift 9: {shift.name}, color: {shift.color}")

        # Update settings to include min_employees_per_shift and max_employees_per_shift
        settings = Settings.query.first()
        if settings:
            print("Found settings")

            # Initialize scheduling_advanced if it doesn't exist
            if settings.scheduling_advanced is None:
                settings.scheduling_advanced = {}

            # Set min_employees_per_shift and max_employees_per_shift
            settings.scheduling_advanced["min_employees_per_shift"] = 1
            settings.scheduling_advanced["max_employees_per_shift"] = 2

            db.session.commit()
            print(
                "Updated settings with min_employees_per_shift: 1, max_employees_per_shift: 2"
            )
        else:
            print("Settings not found")
    else:
        print("Shift 9 not found")
