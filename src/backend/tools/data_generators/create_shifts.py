from app import create_app
from src.backend.models import db, ShiftTemplate


def create_default_shifts():
    app = create_app()
    with app.app_context():
        print("Creating default shifts...")
        default_shifts = ShiftTemplate.create_default_shifts()
        for shift in default_shifts:
            db.session.add(shift)
        db.session.commit()
        print("Default shifts created successfully.")


if __name__ == "__main__":
    create_default_shifts()
