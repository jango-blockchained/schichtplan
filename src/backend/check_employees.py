from app import create_app
from models.employee import Employee, EmployeeAvailability


def check_employees():
    app = create_app()
    with app.app_context():
        print("Checking employees in database...")

        # Get all employees
        employees = Employee.query.all()
        print(f"Found {len(employees)} employees:")
        for emp in employees:
            print(
                f"  - {emp.first_name} {emp.last_name} ({emp.employee_group}): {emp.contracted_hours}h"
            )

            # Check availabilities
            availabilities = EmployeeAvailability.query.filter_by(
                employee_id=emp.id
            ).all()
            print(f"    - {len(availabilities)} availability records")

            # Print a few availability details if they exist
            for i, avail in enumerate(availabilities[:3]):
                print(
                    f"      - Day: {avail.day_of_week}, Hour: {avail.hour}, Available: {avail.is_available}, Type: {avail.availability_type}"
                )

            if len(availabilities) > 3:
                print(f"      - ... and {len(availabilities) - 3} more")


if __name__ == "__main__":
    check_employees()
