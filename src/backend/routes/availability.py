from flask import Blueprint, request, jsonify
from models import db, EmployeeAvailability, Employee
from models.employee import AvailabilityType
from datetime import datetime, time
from http import HTTPStatus

availability = Blueprint('availability', __name__)

@availability.route('/api/availability', methods=['GET'])
def get_availabilities():
    """Get all availabilities"""
    availabilities = EmployeeAvailability.query.all()
    return jsonify([availability.to_dict() for availability in availabilities])

@availability.route('/api/availability', methods=['POST'])
def create_availability():
    """Create a new availability"""
    data = request.get_json()
    
    try:
        availability = EmployeeAvailability(
            employee_id=data['employee_id'],
            day_of_week=data['day_of_week'],
            hour=data['hour'],
            is_available=data.get('is_available', True)
        )
        
        db.session.add(availability)
        db.session.commit()
        
        return jsonify(availability.to_dict()), HTTPStatus.CREATED
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/api/availability/<int:availability_id>', methods=['GET'])
def get_availability(availability_id):
    """Get a specific availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    return jsonify(availability.to_dict())

@availability.route('/api/availability/<int:availability_id>', methods=['PUT'])
def update_availability(availability_id):
    """Update an availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    data = request.get_json()
    
    try:
        if 'employee_id' in data:
            availability.employee_id = data['employee_id']
        if 'day_of_week' in data:
            availability.day_of_week = data['day_of_week']
        if 'hour' in data:
            availability.hour = data['hour']
        if 'is_available' in data:
            availability.is_available = data['is_available']
        
        db.session.commit()
        return jsonify(availability.to_dict())
        
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/api/availability/<int:availability_id>', methods=['DELETE'])
def delete_availability(availability_id):
    """Delete an availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    
    try:
        db.session.delete(availability)
        db.session.commit()
        return '', HTTPStatus.NO_CONTENT
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/api/availability/check', methods=['POST'])
def check_availability():
    """Check employee availability for a specific date and time range"""
    data = request.get_json()
    
    try:
        employee_id = data['employee_id']
        check_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        # Get employee
        employee = Employee.query.get_or_404(employee_id)
        
        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee_id,
            EmployeeAvailability.day_of_week == check_date.weekday()
        ).all()
        
        # Check time range if provided
        hour = None
        if 'hour' in data:
            hour = data['hour']
            availabilities = [a for a in availabilities if a.hour == hour]
        
        # If no availability records exist for this time, employee is considered available
        if not availabilities:
            return jsonify({'is_available': True})
            
        # Check if any availability record indicates the employee is available
        is_available = any(a.is_available for a in availabilities)
        
        return jsonify({
            'is_available': is_available,
            'reason': None if is_available else 'Marked as unavailable for this time'
        })
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR 