import sys

sys.path.append(".")

from app import create_app
from models.fixed_shift import ShiftTemplate

app = create_app()
with app.app_context():
    shifts = ShiftTemplate.query.all()
    print(f"Found {len(shifts)} shifts:")
    for shift in shifts:
        print(
            f"  Shift {shift.id}: {shift.start_time}-{shift.end_time}, duration: {shift.duration_hours}h"
        )

    # Check if shift 9 exists
    shift_9 = ShiftTemplate.query.filter_by(id=9).first()
    if shift_9:
        print("\nShift 9 details:")
        print(f"  ID: {shift_9.id}")
        print(f"  Start time: {shift_9.start_time}")
        print(f"  End time: {shift_9.end_time}")
        print(f"  Duration: {shift_9.duration_hours}h")
        print(f"  Min employees: {shift_9.min_employees}")
        print(f"  Max employees: {shift_9.max_employees}")
    else:
        print("\nShift 9 does not exist in the database")
