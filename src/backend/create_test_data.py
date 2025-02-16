from app import create_app
from models import db, Employee, EmployeeGroup

def create_test_data():
    app = create_app()
    with app.app_context():
        # Create test employees
        test_employees = []
        
        # John Doe
        john = Employee(
            first_name='John',
            last_name='Doe',
            employee_group='VL',
            contracted_hours=40.0
        )
        john.employee_id = 'JD1'
        john.is_keyholder = True
        test_employees.append(john)
        
        # Jane Smith
        jane = Employee(
            first_name='Jane',
            last_name='Smith',
            employee_group='TZ',
            contracted_hours=20.0
        )
        jane.employee_id = 'JS1'
        jane.is_keyholder = False
        test_employees.append(jane)
        
        # Bob Johnson
        bob = Employee(
            first_name='Bob',
            last_name='Johnson',
            employee_group='GFB',
            contracted_hours=10.0
        )
        bob.employee_id = 'BJ1'
        bob.is_keyholder = False
        test_employees.append(bob)
        
        for employee in test_employees:
            try:
                existing = Employee.query.filter_by(employee_id=employee.employee_id).first()
                if existing:
                    print(f'Employee {employee.employee_id} already exists, skipping...')
                    continue
                    
                db.session.add(employee)
                print(f'Added employee: {employee.first_name} {employee.last_name}')
            except Exception as e:
                print(f'Error adding employee: {str(e)}')
        
        try:
            db.session.commit()
            print('All test employees added successfully')
        except Exception as e:
            db.session.rollback()
            print(f'Error committing changes: {str(e)}')

if __name__ == '__main__':
    create_test_data() 