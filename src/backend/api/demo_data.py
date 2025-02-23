from flask import Blueprint, jsonify, request
from models import db, Settings, Employee, Shift, Coverage, EmployeeAvailability
from http import HTTPStatus
from datetime import datetime, timedelta
import random

bp = Blueprint('demo_data', __name__, url_prefix='/api/demo_data')

def generate_employee_data():
    """Generate demo employee data"""
    employee_types = [
        {'id': 'full_time', 'name': 'Vollzeit', 'contracted_hours': 40},
        {'id': 'part_time', 'name': 'Teilzeit', 'contracted_hours': 20},
        {'id': 'mini_job', 'name': 'Minijob', 'contracted_hours': 10}
    ]
    
    first_names = ['Anna', 'Max', 'Sophie', 'Liam', 'Emma', 'Noah', 'Mia', 'Lucas']
    last_names = ['Müller', 'Schmidt', 'Weber', 'Wagner', 'Fischer', 'Meyer']
    
    employees = []
    for i in range(10):
        emp_type = random.choice(employee_types)
        employee = Employee(
            name=f"{random.choice(first_names)} {random.choice(last_names)}",
            email=f"employee{i+1}@example.com",
            phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}",
            employee_group=emp_type['id'],
            contracted_hours=emp_type['contracted_hours'],
            is_keyholder=i < 3,  # First 3 employees are keyholders
            is_active=True
        )
        employees.append(employee)
    
    return employees

def generate_shift_data():
    """Generate demo shift data"""
    shifts = [
        Shift(
            start_time="09:00",
            end_time="14:00",
            min_employees=1,
            max_employees=2,
            duration_hours=5.0,
            requires_break=False,
            active_days=[1, 2, 3, 4, 5, 6]  # Monday to Saturday
        ),
        Shift(
            start_time="14:00",
            end_time="20:00",
            min_employees=1,
            max_employees=2,
            duration_hours=6.0,
            requires_break=True,
            active_days=[1, 2, 3, 4, 5, 6]  # Monday to Saturday
        )
    ]
    return shifts

def generate_coverage_data():
    """Generate demo coverage data"""
    coverage_slots = []
    for day_index in range(1, 7):  # Monday to Saturday
        # Morning slot
        coverage_slots.append(Coverage(
            day_index=day_index,
            start_time="09:00",
            end_time="14:00",
            min_employees=1,
            max_employees=2,
            employee_types=["full_time", "part_time"]
        ))
        # Afternoon slot
        coverage_slots.append(Coverage(
            day_index=day_index,
            start_time="14:00",
            end_time="20:00",
            min_employees=1,
            max_employees=2,
            employee_types=["full_time", "part_time", "mini_job"]
        ))
    return coverage_slots

def generate_availability_data(employees):
    """Generate demo availability data"""
    availabilities = []
    for employee in employees:
        # Generate recurring availability for each employee
        for day_index in range(7):  # 0-6 (Sunday-Saturday)
            if day_index != 0:  # Skip Sunday
                availability = EmployeeAvailability(
                    employee_id=employee.id,
                    is_recurring=True,
                    day_index=day_index,
                    start_time="09:00",
                    end_time="20:00",
                    availability_type="available"
                )
                availabilities.append(availability)
    return availabilities

@bp.route('/', methods=['POST'])
def generate_demo_data():
    """Generate demo data based on selected module"""
    data = request.get_json()
    module = data.get('module', 'all')
    
    try:
        if module in ['employees', 'all']:
            # Clear existing employees
            Employee.query.delete()
            employees = generate_employee_data()
            db.session.add_all(employees)
            db.session.commit()
            
            if module == 'all':
                # Generate availability for new employees
                availabilities = generate_availability_data(employees)
                db.session.add_all(availabilities)
                db.session.commit()
        
        if module in ['shifts', 'all']:
            # Clear existing shifts
            Shift.query.delete()
            shifts = generate_shift_data()
            db.session.add_all(shifts)
            db.session.commit()
        
        if module in ['coverage', 'all']:
            # Clear existing coverage
            Coverage.query.delete()
            coverage_slots = generate_coverage_data()
            db.session.add_all(coverage_slots)
            db.session.commit()
        
        if module in ['availability', 'all']:
            # Clear existing availability
            EmployeeAvailability.query.delete()
            if module != 'all':  # If 'all', availability was already generated with employees
                employees = Employee.query.all()
                availabilities = generate_availability_data(employees)
                db.session.add_all(availabilities)
                db.session.commit()
        
        # Update settings to record the execution
        settings = Settings.query.first()
        if settings:
            settings.actions_demo_data = {
                'selected_module': module,
                'last_execution': datetime.utcnow().isoformat()
            }
            db.session.commit()
        
        return jsonify({
            'message': f'Successfully generated demo data for module: {module}',
            'timestamp': datetime.utcnow().isoformat()
        }), HTTPStatus.OK
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Failed to generate demo data',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR 