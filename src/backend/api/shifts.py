from flask import Blueprint, request, jsonify
from models import db, Shift
from sqlalchemy.exc import IntegrityError
from http import HTTPStatus
from datetime import datetime

bp = Blueprint('shifts', __name__, url_prefix='/api/shifts')

@bp.route('/', methods=['GET'])
def get_shifts():
    """Get all shifts"""
    shifts = Shift.query.all()
    return jsonify([{
        'id': shift.id,
        'start_time': shift.start_time,
        'end_time': shift.end_time,
        'min_employees': shift.min_employees,
        'max_employees': shift.max_employees,
        'duration_hours': shift.duration_hours,
        'requires_break': shift.requires_break
    } for shift in shifts]), HTTPStatus.OK

@bp.route('/<int:shift_id>', methods=['GET'])
def get_shift(shift_id):
    """Get shift by ID"""
    shift = Shift.query.get_or_404(shift_id)
    return jsonify({
        'id': shift.id,
        'start_time': shift.start_time,
        'end_time': shift.end_time,
        'min_employees': shift.min_employees,
        'max_employees': shift.max_employees,
        'duration_hours': shift.duration_hours,
        'requires_break': shift.requires_break
    }), HTTPStatus.OK

@bp.route('/', methods=['POST'])
def create_shift():
    """Create new shift"""
    data = request.get_json()
    
    try:
        # Parse time strings to time objects
        start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        
        shift = Shift(
            start_time=start_time,
            end_time=end_time,
            min_employees=int(data.get('min_employees', 1)),
            max_employees=int(data.get('max_employees', 5))
        )
        
        db.session.add(shift)
        db.session.commit()
        
        return jsonify({
            'id': shift.id,
            'message': 'Shift created successfully'
        }), HTTPStatus.CREATED
        
    except (KeyError, ValueError) as e:
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            'error': 'Shift already exists'
        }), HTTPStatus.CONFLICT

@bp.route('/<int:shift_id>', methods=['PUT'])
def update_shift(shift_id):
    """Update shift"""
    shift = Shift.query.get_or_404(shift_id)
    data = request.get_json()
    
    try:
        if 'start_time' in data:
            shift.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
        if 'end_time' in data:
            shift.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
        if 'min_employees' in data:
            shift.min_employees = int(data['min_employees'])
        if 'max_employees' in data:
            shift.max_employees = int(data['max_employees'])
            
        db.session.commit()
        
        return jsonify({
            'message': 'Shift updated successfully'
        }), HTTPStatus.OK
        
    except (ValueError, KeyError) as e:
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST

@bp.route('/<int:shift_id>', methods=['DELETE'])
def delete_shift(shift_id):
    """Delete shift"""
    shift = Shift.query.get_or_404(shift_id)
    
    try:
        db.session.delete(shift)
        db.session.commit()
        return jsonify({
            'message': 'Shift deleted successfully'
        }), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Could not delete shift',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/defaults', methods=['POST'])
def create_default_shifts():
    """Create default shifts"""
    try:
        default_shifts = Shift.create_default_shifts()
        for shift in default_shifts:
            db.session.add(shift)
        db.session.commit()
        
        return jsonify({
            'message': 'Default shifts created successfully',
            'count': len(default_shifts)
        }), HTTPStatus.CREATED
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Could not create default shifts',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR 