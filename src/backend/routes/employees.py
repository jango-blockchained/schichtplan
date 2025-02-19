from flask import Blueprint, jsonify, request
from models import db, Employee
from http import HTTPStatus

employees = Blueprint('employees', __name__)

@employees.route('/api/employees', methods=['GET'])
@employees.route('/api/employees/', methods=['GET'])
def get_employees():
    """Get all employees"""
    employees = Employee.query.all()
    return jsonify([employee.to_dict() for employee in employees])

@employees.route('/api/employees/<int:employee_id>', methods=['GET'])
@employees.route('/api/employees/<int:employee_id>/', methods=['GET'])
def get_employee(employee_id):
    """Get a specific employee"""
    employee = Employee.query.get_or_404(employee_id)
    return jsonify(employee.to_dict())

@employees.route('/api/employees', methods=['POST'])
@employees.route('/api/employees/', methods=['POST'])
def create_employee():
    """Create a new employee"""
    data = request.get_json()
    
    try:
        employee = Employee(
            employee_id=data['employee_id'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data.get('email'),
            phone=data.get('phone'),
            contracted_hours=data.get('contracted_hours', 0),
            is_active=data.get('is_active', True),
            is_keyholder=data.get('is_keyholder', False)
        )
        
        db.session.add(employee)
        db.session.commit()
        
        return jsonify(employee.to_dict()), HTTPStatus.CREATED
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@employees.route('/api/employees/<int:employee_id>', methods=['PUT'])
@employees.route('/api/employees/<int:employee_id>/', methods=['PUT'])
def update_employee(employee_id):
    """Update an employee"""
    employee = Employee.query.get_or_404(employee_id)
    data = request.get_json()
    
    try:
        if 'employee_id' in data:
            employee.employee_id = data['employee_id']
        if 'first_name' in data:
            employee.first_name = data['first_name']
        if 'last_name' in data:
            employee.last_name = data['last_name']
        if 'email' in data:
            employee.email = data['email']
        if 'phone' in data:
            employee.phone = data['phone']
        if 'contracted_hours' in data:
            employee.contracted_hours = data['contracted_hours']
        if 'is_active' in data:
            employee.is_active = data['is_active']
        if 'is_keyholder' in data:
            employee.is_keyholder = data['is_keyholder']
        
        db.session.commit()
        return jsonify(employee.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@employees.route('/api/employees/<int:employee_id>', methods=['DELETE'])
@employees.route('/api/employees/<int:employee_id>/', methods=['DELETE'])
def delete_employee(employee_id):
    """Delete an employee"""
    employee = Employee.query.get_or_404(employee_id)
    
    try:
        db.session.delete(employee)
        db.session.commit()
        return '', HTTPStatus.NO_CONTENT
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR 