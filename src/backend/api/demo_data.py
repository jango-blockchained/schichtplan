from flask import Blueprint, jsonify, request
from models import db, Settings, Employee, Shift, Coverage, EmployeeAvailability
from http import HTTPStatus
from datetime import datetime, timedelta
import random
import logging

bp = Blueprint('demo_data', __name__, url_prefix='/api/demo_data')

def generate_employee_types():
    """Generate demo employee types"""
    return [
        {
            'id': 'VZ',
            'name': 'Vollzeit',
            'min_hours': 35,
            'max_hours': 40,
            'type': 'employee'
        },
        {
            'id': 'TZ',
            'name': 'Teilzeit',
            'min_hours': 15,
            'max_hours': 34,
            'type': 'employee'
        },
        {
            'id': 'GFB',
            'name': 'Geringfügig Beschäftigt',
            'min_hours': 0,
            'max_hours': 14,
            'type': 'employee'
        },
        {
            'id': 'TL',
            'name': 'Teamleiter',
            'min_hours': 35,
            'max_hours': 40,
            'type': 'employee'
        }
    ]

def generate_absence_types():
    """Generate demo absence types"""
    return [
        {
            'id': 'URL',
            'name': 'Urlaub',
            'color': '#FF9800',
            'type': 'absence'
        },
        {
            'id': 'ABW',
            'name': 'Abwesend',
            'color': '#F44336',
            'type': 'absence'
        },
        {
            'id': 'SLG',
            'name': 'Schulung',
            'color': '#4CAF50',
            'type': 'absence'
        }
    ]

def generate_employee_data():
    """Generate demo employee data"""
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
        db.session.commit()
    
    # Clear all existing employees first
    Employee.query.delete()
    db.session.commit()
    
    employee_types = [
        {'id': 'VZ', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 40},
        {'id': 'TZ', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
        {'id': 'GFB', 'name': 'Geringfügig Beschäftigt', 'min_hours': 0, 'max_hours': 14},
        {'id': 'TL', 'name': 'Teamleiter', 'min_hours': 35, 'max_hours': 40}
    ]
    
    first_names = ['Anna', 'Max', 'Sophie', 'Liam', 'Emma', 'Noah', 'Mia', 'Lucas', 'Maike', 'Tim', 'Laura', 'Jan', 'Julia', 'David', 'Nina', 'Thomas', 'Laura', 'Jan', 'Lisa', 'Michael']
    last_names = ['Müller', 'Schmidt', 'Weber', 'Wagner', 'Fischer', 'Becker', 'Maier', 'Hoffmann', 'Schneider', 'Meyer', 'Lang', 'Klein', 'Schulz', 'Kowalski', 'Schmidt', 'Weber', 'Wagner', 'Fischer']
    
    employees = []
    for i in range(20):
        emp_type = random.choice(employee_types)
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        # Generate employee_id based on name (first letter of first name + first two letters of last name)
        base_id = f"{first_name[0]}{last_name[:2]}".upper()
        # Add a number if the ID already exists
        counter = 1
        employee_id = base_id
        while any(e.employee_id == employee_id for e in employees):
            employee_id = f"{base_id}{counter:02d}"
            counter += 1
            
        employee = Employee(
            employee_id=employee_id,
            first_name=first_name,
            last_name=last_name,
            employee_group=emp_type['id'],
            contracted_hours=random.randint(emp_type['min_hours'], emp_type['max_hours']),
            is_keyholder=i < 3,  # First 3 employees are keyholders
            is_active=True,
            email=f"employee{i+1}@example.com",
            phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}"
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
            employee_types=["VZ", "TZ"]
        ))
        # Afternoon slot
        coverage_slots.append(Coverage(
            day_index=day_index,
            start_time="14:00",
            end_time="20:00",
            min_employees=1,
            max_employees=2,
            employee_types=["VZ", "TZ", "GFB"]
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
        # First, ensure we have a settings record
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()
        
        # Update employee types and absence types
        if module in ['settings', 'all']:
            logging.info("Generating demo settings...")
            settings.employee_types = generate_employee_types()
            settings.absence_types = generate_absence_types()
            try:
                db.session.commit()
                logging.info("Successfully updated employee and absence types")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error updating settings: {str(e)}")
                raise

        if module in ['employees', 'all']:
            # Clear existing employees
            logging.info("Generating demo employees...")
            Employee.query.delete()
            employees = generate_employee_data()
            db.session.add_all(employees)
            try:
                db.session.commit()
                logging.info(f"Successfully created {len(employees)} employees")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error creating employees: {str(e)}")
                raise
            
            if module == 'all':
                # Generate availability for new employees
                availabilities = generate_availability_data(employees)
                db.session.add_all(availabilities)
                try:
                    db.session.commit()
                    logging.info(f"Successfully created {len(availabilities)} availabilities")
                except Exception as e:
                    db.session.rollback()
                    logging.error(f"Error creating availabilities: {str(e)}")
                    raise
        
        if module in ['shifts', 'all']:
            # Clear existing shifts
            logging.info("Generating demo shifts...")
            Shift.query.delete()
            shifts = generate_shift_data()
            db.session.add_all(shifts)
            try:
                db.session.commit()
                logging.info(f"Successfully created {len(shifts)} shifts")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error creating shifts: {str(e)}")
                raise
        
        if module in ['coverage', 'all']:
            # Clear existing coverage
            logging.info("Generating demo coverage...")
            Coverage.query.delete()
            coverage_slots = generate_coverage_data()
            db.session.add_all(coverage_slots)
            try:
                db.session.commit()
                logging.info(f"Successfully created {len(coverage_slots)} coverage slots")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error creating coverage: {str(e)}")
                raise
        
        if module in ['availability', 'all']:
            # Clear existing availability
            logging.info("Generating demo availability...")
            EmployeeAvailability.query.delete()
            if module != 'all':  # If 'all', availability was already generated with employees
                employees = Employee.query.all()
                availabilities = generate_availability_data(employees)
                db.session.add_all(availabilities)
                try:
                    db.session.commit()
                    logging.info(f"Successfully created {len(availabilities)} availabilities")
                except Exception as e:
                    db.session.rollback()
                    logging.error(f"Error creating availabilities: {str(e)}")
                    raise
        
        # Update settings to record the execution
        settings = Settings.query.first()
        if settings:
            settings.actions_demo_data = {
                'selected_module': module,
                'last_execution': datetime.utcnow().isoformat()
            }
            try:
                db.session.commit()
                logging.info("Successfully updated settings")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error updating settings: {str(e)}")
                raise
        
        return jsonify({
            'message': f'Successfully generated demo data for module: {module}',
            'timestamp': datetime.utcnow().isoformat()
        }), HTTPStatus.OK
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to generate demo data: {str(e)}")
        return jsonify({
            'error': 'Failed to generate demo data',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR 