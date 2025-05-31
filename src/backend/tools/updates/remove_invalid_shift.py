from app import create_app
from src.backend.models import db, ShiftTemplate


def remove_invalid_shift():
    app = create_app()
    with app.app_context():
        invalid_shift = db.session.get(ShiftTemplate, 4)
        if invalid_shift:
            db.session.delete(invalid_shift)
            db.session.commit()
            print("Invalid shift template removed.")
        else:
            print("Invalid shift template not found.")


if __name__ == "__main__":
    remove_invalid_shift()
