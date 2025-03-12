from app import create_app
from models import db, ShiftTemplate


def update_shifts():
    app = create_app()
    with app.app_context():
        print("Updating shift templates...")
        shifts = ShiftTemplate.query.all()

        for shift in shifts:
            print(f"Updating shift {shift.id} ({shift.start_time}-{shift.end_time})")
            # min_employees has been removed from the ShiftTemplate model
            # No updates needed

        try:
            db.session.commit()
            print("Successfully updated shift templates.")
        except Exception as e:
            db.session.rollback()
            print(f"Error updating shift templates: {str(e)}")


if __name__ == "__main__":
    update_shifts()
