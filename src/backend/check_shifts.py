from app import create_app
from models import ShiftTemplate


def check_shifts():
    app = create_app()
    with app.app_context():
        print("Shift templates:")
        shifts = ShiftTemplate.query.all()
        if not shifts:
            print("No shift templates found in the database.")
            return

        for s in shifts:
            print(
                f"ID {s.id}: {s.start_time}-{s.end_time}, min: {s.min_employees}, max: {s.max_employees}, break: {s.requires_break}, duration: {s.duration_hours}h"
            )


if __name__ == "__main__":
    check_shifts()
