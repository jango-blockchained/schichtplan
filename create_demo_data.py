import os
os.environ['FLASK_ENV'] = 'development'
from src.backend.app import create_app
from src.backend.models import db, Employee, Coverage, EmployeeGroup
from src.backend.models.employee import AvailabilityType
from datetime import date
import random

app = create_app()
with app.app_context():
    # Create some employees with valid hours for their groups
    for i in range(10):
        if i < 5:
            # Full-time employees (VZ) - 35-48 hours
            emp_group = EmployeeGroup.VZ
            hours = random.choice([35, 38, 40])
        else:
            # Part-time employees (TZ) - 10-35 hours  
            emp_group = EmployeeGroup.TZ
            hours = random.choice([15, 20, 25, 30])
            
        emp = Employee(
            first_name=f'Employee',
            last_name=f'{i}',
            is_keyholder=(i < 3),
            is_active=True,
            employee_group=emp_group,
            contracted_hours=hours
        )
        db.session.add(emp)
    
    # Create some coverage rules
    for day in range(7):
        for hour in [8, 12, 16]:
            coverage = Coverage(
                day_index=day,
                start_time=f'{hour:02d}:00',
                end_time=f'{hour+4:02d}:00',
                min_employees=1,
                max_employees=3,
                requires_keyholder=(hour == 8)
            )
            db.session.add(coverage)
    
    db.session.commit()
    print(f'Created {Employee.query.count()} employees and {Coverage.query.count()} coverage rules') 