from app import create_app, db
from models.employee import Employee, EmployeeGroup


def create_employees():
    """Create test employees"""
    app = create_app()
    with app.app_context():
        print("Creating test employees...")

        # Create some test employees with different groups
        employees = [
            Employee(
                first_name="John",
                last_name="Doe",
                employee_group=EmployeeGroup.VZ,
                contracted_hours=40,
                is_keyholder=True,
                is_active=True,
            ),
            Employee(
                first_name="Jane",
                last_name="Smith",
                employee_group=EmployeeGroup.TZ,
                contracted_hours=30,
                is_keyholder=False,
                is_active=True,
            ),
            Employee(
                first_name="Bob",
                last_name="Johnson",
                employee_group=EmployeeGroup.GFB,
                contracted_hours=15,
                is_keyholder=False,
                is_active=True,
            ),
            Employee(
                first_name="Alice",
                last_name="Brown",
                employee_group=EmployeeGroup.VZ,
                contracted_hours=40,
                is_keyholder=True,
                is_active=True,
            ),
            Employee(
                first_name="Charlie",
                last_name="Wilson",
                employee_group=EmployeeGroup.TZ,
                contracted_hours=25,
                is_keyholder=False,
                is_active=True,
            ),
        ]

        try:
            for employee in employees:
                db.session.add(employee)
            db.session.commit()
            print("Successfully created test employees.")
        except Exception as e:
            db.session.rollback()
            print(f"Error creating test employees: {str(e)}")


if __name__ == "__main__":
    create_employees()
