from app import create_app
from models import db, ShiftTemplate


def create_shifts():
    app = create_app()
    with app.app_context():
        print("Creating additional shift templates...")

        # Early morning shift
        early = ShiftTemplate(
            start_time="08:00",
            end_time="13:00",
            min_employees=0,
            max_employees=2,
            requires_break=False,
        )

        # Mid-morning shift
        mid_morning = ShiftTemplate(
            start_time="10:00",
            end_time="15:00",
            min_employees=0,
            max_employees=2,
            requires_break=False,
        )

        # Mid-day shift
        mid_day = ShiftTemplate(
            start_time="11:00",
            end_time="16:00",
            min_employees=0,
            max_employees=2,
            requires_break=False,
        )

        # Early afternoon shift
        early_afternoon = ShiftTemplate(
            start_time="13:00",
            end_time="18:00",
            min_employees=0,
            max_employees=2,
            requires_break=False,
        )

        # Late afternoon shift
        late_afternoon = ShiftTemplate(
            start_time="15:00",
            end_time="20:00",
            min_employees=0,
            max_employees=2,
            requires_break=False,
        )

        new_shifts = [early, mid_morning, mid_day, early_afternoon, late_afternoon]

        try:
            for shift in new_shifts:
                shift._calculate_duration()  # Calculate duration before adding
                db.session.add(shift)
            db.session.commit()
            print("Successfully created new shift templates.")
        except Exception as e:
            db.session.rollback()
            print(f"Error creating shift templates: {str(e)}")


if __name__ == "__main__":
    create_shifts()
