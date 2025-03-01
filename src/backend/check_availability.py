from backend.app import create_app
from datetime import date
import traceback
import sys


def check_employee_availability():
    print("Starting availability check...")
    try:
        app = create_app()
        print("App created")

        # Ensure we're using the app context
        with app.app_context():
            print("In app context")

            # Import the models inside the app context
            from backend.models import Employee

            employees = Employee.query.all()
            print(f"Found {len(employees)} employees")

            day = date(2025, 3, 3)  # Monday
            check_shift = ("13:00", "18:00")

            available = []
            for e in employees:
                print(f"Checking {e.first_name} {e.last_name}")
                if e.is_available_for_date(day, check_shift[0], check_shift[1]):
                    available.append(e)

            print(f"Available employees for {day} {check_shift[0]}-{check_shift[1]}:")
            for e in available:
                print(
                    f"- {e.first_name} {e.last_name} (Group: {e.employee_group}, Hours: {e.contracted_hours})"
                )
            print(f"Total: {len(available)} employees available")
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    check_employee_availability()
