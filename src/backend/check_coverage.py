from app import create_app
from models import Coverage


def check_coverage():
    app = create_app()
    with app.app_context():
        print("Coverage data:")
        coverage_data = Coverage.query.all()
        if not coverage_data:
            print("No coverage data found in the database.")
            return

        for c in coverage_data:
            print(
                f"Day {c.day_index}: {c.start_time}-{c.end_time}, min: {c.min_employees}, max: {c.max_employees}, shift_id: {c.shift_id}"
            )


if __name__ == "__main__":
    check_coverage()
