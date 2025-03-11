from models import Employee
from app import create_app

app = create_app()

with app.app_context():
    employee_count = Employee.query.count()
    active_employees = Employee.query.filter_by(is_active=True).count()
    print(f"Total employees in database: {employee_count}")
    print(f"Active employees: {active_employees}")
