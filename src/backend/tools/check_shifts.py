import sys
import os
import logging

# Add the current directory to the path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Import app and models after path setup
from app import create_app
from models import ShiftTemplate


def main():
    app = create_app()
    with app.app_context():
        shifts = ShiftTemplate.query.all()
        print(f"Found {len(shifts)} shifts:")
        for shift in shifts:
            print(
                f"  {shift.id}: {shift.start_time}-{shift.end_time} ({shift.duration_hours}h)"
            )


def check_shifts():
    app = create_app()
    with app.app_context():
        shifts = ShiftTemplate.query.all()
        print("Shift templates:")
        for s in shifts:
            print(
                f"ID: {s.id}, Start: {s.start_time}, End: {s.end_time}, Duration: {s.duration_hours}, Type: {s.shift_type}"
            )


if __name__ == "__main__":
    main()
