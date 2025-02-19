from flask import Blueprint, request, jsonify
from models import db, Availability, Employee
from models.availability import AvailabilityType
from datetime import datetime, time
from http import HTTPStatus

availability = Blueprint('availability', __name__)

@availability.route('/api/availability', methods=['GET'])
def get_availabilities():
    """Get all availabilities"""
    availabilities = Availability.query.all()
    return jsonify([availability.to_dict() for availability in availabilities])

@availability.route('/api/availability', methods=['POST'])
def create_availability():
    """Create a new availability"""
    data = request.get_json()
    
    try:
        availability = Availability(
            employee_id=data['employee_id'],
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date(),
            availability_type=AvailabilityType(data.get('availability_type', 'unavailable')),
            reason=data.get('reason'),
            is_recurring=data.get('is_recurring', False),
            recurrence_day=data.get('recurrence_day')
        )
        
        if 'start_time' in data:
            availability.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        if 'end_time' in data:
            availability.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        
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
    availability = Availability.query.get_or_404(availability_id)
    return jsonify(availability.to_dict())

@availability.route('/api/availability/<int:availability_id>', methods=['PUT'])
def update_availability(availability_id):
    """Update an availability"""
    availability = Availability.query.get_or_404(availability_id)
    data = request.get_json()
    
    try:
        if 'employee_id' in data:
            availability.employee_id = data['employee_id']
        if 'start_date' in data:
            availability.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        if 'end_date' in data:
            availability.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if 'start_time' in data:
            availability.start_time = datetime.strptime(data['start_time'], '%H:%M').time() if data['start_time'] else None
        if 'end_time' in data:
            availability.end_time = datetime.strptime(data['end_time'], '%H:%M').time() if data['end_time'] else None
        if 'availability_type' in data:
            availability.availability_type = AvailabilityType(data['availability_type'])
        if 'reason' in data:
            availability.reason = data['reason']
        if 'is_recurring' in data:
            availability.is_recurring = data['is_recurring']
        if 'recurrence_day' in data:
            availability.recurrence_day = data['recurrence_day']
        
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
    availability = Availability.query.get_or_404(availability_id)
    
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
        availabilities = Availability.query.filter(
            Availability.employee_id == employee_id,
            (
                (Availability.start_date <= check_date) &
                (Availability.end_date >= check_date)
            ) |
            Availability.is_recurring == True
        ).all()
        
        # Check time range if provided
        start_time = None
        end_time = None
        if 'start_time' in data:
            start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        if 'end_time' in data:
            end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        
        # Check each availability record
        for availability in availabilities:
            if not availability.is_available_for_date(check_date, start_time, end_time):
                return jsonify({
                    'is_available': False,
                    'reason': availability.reason or 'Unavailable during this period'
                })
        
        return jsonify({'is_available': True})
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR 