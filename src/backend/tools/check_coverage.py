from app import create_app
from models import Coverage


def main():
    app = create_app()
    with app.app_context():
        coverage = Coverage.query.all()
        print(f"Found {len(coverage)} coverage requirements:")
        for c in coverage:
            print(
                f"  Day {c.day_index}: {c.start_time}-{c.end_time} (min: {c.min_employees}, max: {c.max_employees})"
            )


if __name__ == "__main__":
    main()
