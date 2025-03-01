from app import create_app
from models import db
from datetime import date, timedelta


def check_shifts_and_coverage():
    app = create_app()
    with app.app_context():
        print("Checking shifts in database...")

        # Get all shifts
        shifts = db.session.execute(db.text("SELECT * FROM shifts")).fetchall()
        print(f"Found {len(shifts)} shifts:")
        for shift in shifts:
            # Print the column names for the first row to see what's available
            if shifts.index(shift) == 0:
                print("  Available columns:", shift._mapping.keys())

            # Access columns by index to be safe
            print(f"  - Shift {shift[0]}: {shift[1]}-{shift[2]}, Duration: {shift[3]}h")

        print("\nChecking coverage requirements...")

        # Calculate next week's dates (same as in test_schedule_generation.py)
        today = date.today()
        next_monday = today + timedelta(days=(7 - today.weekday()))
        next_sunday = next_monday + timedelta(days=6)

        # Get coverage requirements for next week
        coverage_reqs = db.session.execute(db.text("SELECT * FROM coverage")).fetchall()

        print(f"Found {len(coverage_reqs)} coverage requirements:")
        # Print the column names for the first row to see what's available
        if coverage_reqs and len(coverage_reqs) > 0:
            print("  Available columns:", coverage_reqs[0]._mapping.keys())
            for req in coverage_reqs:
                # Access by index to be safe - day_index is col 1, start_time col 2, end_time col 3, min_employees col 4
                print(
                    f"  - Day {req[1]}, Time {req[2]}-{req[3]}: {req[4]} employees required"
                )


if __name__ == "__main__":
    check_shifts_and_coverage()
