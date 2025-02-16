from flask import Blueprint, jsonify, request, current_app
from models import db, Employee, EmployeeGroup
from typing import Dict, Any
from sqlalchemy.exc import SQLAlchemyError
import traceback

bp = Blueprint('employees', __name__, url_prefix='/api/employees')

@bp.route('/', methods=['GET'])
def get_employees():
    """Get all employees"""
    try:
        current_app.logger.info("Fetching all employees")
        employees = Employee.query.all()
        current_app.logger.info(f"Found {len(employees)} employees")
        
        employee_list = []
        for employee in employees:
            try:
                employee_dict = employee.to_dict()
                employee_list.append(employee_dict)
            except Exception as e:
                current_app.logger.error(f"Error converting employee {employee.id} to dict: {str(e)}")
                current_app.logger.error(traceback.format_exc())
                continue
        
        current_app.logger.info("Successfully serialized all employees")
        return jsonify(employee_list)
        
    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error in get_employees: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': 'Database error occurred'}), 500
    except Exception as e:
        current_app.logger.error(f"Unexpected error in get_employees: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': 'An unexpected error occurred'}), 500

@bp.route('/<int:id>', methods=['GET'])
def get_employee(id: int):
    """Get a specific employee by ID"""
    try:
        current_app.logger.info(f"Fetching employee with ID {id}")
        employee = Employee.query.get_or_404(id)
        return jsonify(employee.to_dict())
    except Exception as e:
        current_app.logger.error(f"Error fetching employee {id}: {str(e)}")
        current_app.logger.error(traceback.format_exc())
        return jsonify({'error': f'Error fetching employee: {str(e)}'}), 500

@bp.route('/', methods=['POST'])
def create_employee():
    data = request.get_json()
    
    try:
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'employee_group', 'contracted_hours']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400

        employee = Employee(
            first_name=data['first_name'],
            last_name=data['last_name'],
            employee_group=EmployeeGroup(data['employee_group']),
            contracted_hours=float(data['contracted_hours']),
            is_keyholder=bool(data.get('is_keyholder', False))
        )
        
        db.session.add(employee)
        db.session.commit()
        
        return jsonify(employee.to_dict()), 201
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create employee: {str(e)}'}), 400

@bp.route('/<int:id>', methods=['PUT'])
def update_employee(id: int):
    employee = Employee.query.get_or_404(id)
    data = request.get_json()
    
    try:
        if 'first_name' in data:
            employee.first_name = data['first_name']
        if 'last_name' in data:
            employee.last_name = data['last_name']
        
        # If either name is updated, regenerate employee_id
        if 'first_name' in data or 'last_name' in data:
            employee.employee_id = employee._generate_employee_id(employee.first_name, employee.last_name)
            
        if 'employee_group' in data:
            employee.employee_group = EmployeeGroup(data['employee_group'])
        if 'contracted_hours' in data:
            employee.contracted_hours = float(data['contracted_hours'])
        if 'is_keyholder' in data:
            employee.is_keyholder = bool(data['is_keyholder'])
        
        db.session.commit()
        return jsonify(employee.to_dict())
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/<int:id>', methods=['DELETE'])
def delete_employee(id: int):
    employee = Employee.query.get_or_404(id)
    db.session.delete(employee)
    db.session.commit()
    return '', 204 