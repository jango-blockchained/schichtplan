from app import create_app
from models import Employee


def check_employees():
    app = create_app()
    with app.app_context():
        print("Employee data:")
        employees = Employee.query.all()
        if not employees:
            print("No employees found in the database.")
            return

        for e in employees:
            print(
                f"ID {e.id}: {e.first_name} {e.last_name}, Group: {e.employee_group}, Keyholder: {e.is_keyholder}, Hours: {e.contracted_hours}"
            )


if __name__ == "__main__":
    check_employees()
