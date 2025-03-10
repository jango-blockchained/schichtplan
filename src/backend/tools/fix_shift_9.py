import sys

sys.path.append(".")

from app import create_app, db
from models.fixed_shift import ShiftTemplate

app = create_app()
with app.app_context():
    # Check if shift 9 exists
    shift_9 = ShiftTemplate.query.filter_by(id=9).first()

    if shift_9:
        print(
            f"Found shift 9: {shift_9.start_time}-{shift_9.end_time}, duration: {shift_9.duration_hours}h"
        )
        print(
            f"Current min_employees: {shift_9.min_employees}, max_employees: {shift_9.max_employees}"
        )

        # Update shift 9 with valid values
        shift_9.start_time = "09:00"
        shift_9.end_time = "12:00"
        shift_9.duration_hours = 3.0
        shift_9.min_employees = 1
        shift_9.max_employees = 2

        # Commit the changes
        db.session.commit()

        print(
            f"Updated shift 9: {shift_9.start_time}-{shift_9.end_time}, duration: {shift_9.duration_hours}h"
        )
        print(
            f"New min_employees: {shift_9.min_employees}, max_employees: {shift_9.max_employees}"
        )
    else:
        print("Shift 9 does not exist in the database")
