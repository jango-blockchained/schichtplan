from flask import Blueprint, request, jsonify
from models import db, EmployeeAvailability, Employee
from models.availability import AvailabilityType
from datetime import datetime, time
from http import HTTPStatus

bp = Blueprint('availability', __name__, url_prefix='/api/availability')

@bp.route('/', methods=['GET'])
def get_availabilities():
    """Get all availabilities, optionally filtered by employee and date range"""
    employee_id = request.args.get('employee_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = EmployeeAvailability.query
    
    if employee_id:
        query = query.filter_by(employee_id=employee_id)
    if start_date:
        query = query.filter(EmployeeAvailability.end_date >= datetime.strptime(start_date, '%Y-%m-%d').date())
    if end_date:
        query = query.filter(EmployeeAvailability.start_date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
    availabilities = query.all()
    return jsonify([availability.to_dict() for availability in availabilities])

@bp.route('/', methods=['POST'])
def create_availability():
    """Create a new availability record"""
    data = request.get_json()
    
    try:
        # Parse times if provided
        start_time = None
        end_time = None
        if data.get('start_time'):
            start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        if data.get('end_time'):
            end_time = datetime.strptime(data['end_time'], '%H:%M').time()
            
        # Create availability record
        availability = EmployeeAvailability(
            employee_id=data['employee_id'],
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date(),
            availability_type=AvailabilityType(data.get('availability_type', 'unavailable')),
            start_time=start_time,
            end_time=end_time,
            reason=data.get('reason'),
            is_recurring=data.get('is_recurring', False),
            recurrence_day=data.get('recurrence_day')
        )
        
        # Check for overlapping availabilities
        overlapping = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == availability.employee_id,
            EmployeeAvailability.end_date >= availability.start_date,
            EmployeeAvailability.start_date <= availability.end_date
        ).all()
        
        for existing in overlapping:
            if existing.overlaps(availability):
                return jsonify({
                    'error': 'Overlapping availability period exists',
                    'conflicting_period': existing.to_dict()
                }), HTTPStatus.CONFLICT
                
        db.session.add(availability)
        db.session.commit()
        
        return jsonify(availability.to_dict()), HTTPStatus.CREATED
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@bp.route('/<int:id>', methods=['GET'])
def get_availability(id):
    """Get a specific availability record"""
    availability = EmployeeAvailability.query.get_or_404(id)
    return jsonify(availability.to_dict())

@bp.route('/<int:id>', methods=['PUT'])
def update_availability(id):
    """Update an availability record"""
    availability = EmployeeAvailability.query.get_or_404(id)
    data = request.get_json()
    
    try:
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
            
        # Check for overlapping availabilities
        overlapping = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == availability.employee_id,
            EmployeeAvailability.end_date >= availability.start_date,
            EmployeeAvailability.start_date <= availability.end_date,
            EmployeeAvailability.id != id
        ).all()
        
        for existing in overlapping:
            if existing.overlaps(availability):
                return jsonify({
                    'error': 'Overlapping availability period exists',
                    'conflicting_period': existing.to_dict()
                }), HTTPStatus.CONFLICT
                
        db.session.commit()
        return jsonify(availability.to_dict())
        
    except (ValueError, KeyError) as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@bp.route('/<int:id>', methods=['DELETE'])
def delete_availability(id):
    """Delete an availability record"""
    availability = EmployeeAvailability.query.get_or_404(id)
    db.session.delete(availability)
    db.session.commit()
    return '', HTTPStatus.NO_CONTENT

@bp.route('/check', methods=['POST'])
def check_availability():
    """Check if an employee is available for a given date and time range"""
    data = request.get_json()
    
    try:
        employee_id = data['employee_id']
        check_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        start_time = datetime.strptime(data['start_time'], '%H:%M').time() if 'start_time' in data else None
        end_time = datetime.strptime(data['end_time'], '%H:%M').time() if 'end_time' in data else None
        
        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee_id,
            (
                (EmployeeAvailability.start_date <= check_date) &
                (EmployeeAvailability.end_date >= check_date)
            ) |
            EmployeeAvailability.is_recurring == True
        ).all()
        
        # Check each availability record
        for availability in availabilities:
            if not availability.is_available_for_date(check_date, start_time, end_time):
                return jsonify({
                    'is_available': False,
                    'conflicting_availability': availability.to_dict()
                })
                
        return jsonify({'is_available': True})
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST 