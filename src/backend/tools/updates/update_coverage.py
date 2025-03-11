from app import create_app
from models import Coverage, db
from api.demo_data import generate_coverage_data


def update_coverage():
    app = create_app()
    with app.app_context():
        # Clear existing coverage data
        Coverage.query.delete()
        db.session.commit()

        # Generate and add new coverage data
        coverage_slots = generate_coverage_data()
        for slot in coverage_slots:
            db.session.add(slot)
        db.session.commit()
        print("Coverage data updated successfully!")


if __name__ == "__main__":
    update_coverage()
