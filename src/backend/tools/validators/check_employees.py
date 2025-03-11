from app import create_app
from models import Employee


def main():
    app = create_app()
    with app.app_context():
        employees = Employee.query.all()
        print(f"Found {len(employees)} employees:")
        for employee in employees:
            print(
                f"  {employee.id}: {employee.first_name} {employee.last_name} ({employee.employee_group})"
            )


if __name__ == "__main__":
    main()
