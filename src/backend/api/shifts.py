from flask import Blueprint, request, jsonify
from models import db, Shift
from sqlalchemy.exc import IntegrityError
from http import HTTPStatus
from datetime import datetime
from models.shift import ShiftValidationError

bp = Blueprint('shifts', __name__, url_prefix='/api/shifts')

@bp.route('/', methods=['GET'])
def get_shifts():
    """Get all shifts"""
    shifts = Shift.query.all()
    return jsonify([shift.to_dict() for shift in shifts]), HTTPStatus.OK

@bp.route('/<int:shift_id>', methods=['GET'])
def get_shift(shift_id):
    """Get shift by ID"""
    shift = Shift.query.get_or_404(shift_id)
    return jsonify(shift.to_dict()), HTTPStatus.OK

@bp.route('/', methods=['POST'])
def create_shift():
    """Create new shift"""
    data = request.get_json()
    
    try:
        shift = Shift(
            start_time=data['start_time'],
            end_time=data['end_time'],
            min_employees=int(data['min_employees']),
            max_employees=int(data['max_employees']),
            requires_break=bool(data.get('requires_break', True)),
            active_days=data.get('active_days', {
                "0": False,  # Sunday
                "1": True,   # Monday
                "2": True,   # Tuesday
                "3": True,   # Wednesday
                "4": True,   # Thursday
                "5": True,   # Friday
                "6": True    # Saturday
            })
        )
        
        db.session.add(shift)
        db.session.commit()
        
        return jsonify(shift.to_dict()), HTTPStatus.CREATED
        
    except (KeyError, ValueError) as e:
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST
    except ShiftValidationError as e:
        return jsonify({
            'error': str(e)
        }), HTTPStatus.BAD_REQUEST

@bp.route('/<int:shift_id>', methods=['PUT'])
def update_shift(shift_id):
    """Update shift"""
    shift = Shift.query.get_or_404(shift_id)
    data = request.get_json()
    
    try:
        if 'start_time' in data:
            shift.start_time = data['start_time']
        if 'end_time' in data:
            shift.end_time = data['end_time']
        if 'min_employees' in data:
            shift.min_employees = int(data['min_employees'])
        if 'max_employees' in data:
            shift.max_employees = int(data['max_employees'])
        if 'requires_break' in data:
            shift.requires_break = bool(data['requires_break'])
        if 'active_days' in data:
            shift.active_days = data['active_days']
            
        shift._calculate_duration()
        shift._validate_store_hours()
        db.session.commit()
        
        return jsonify(shift.to_dict()), HTTPStatus.OK
        
    except (ValueError, KeyError) as e:
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST
    except ShiftValidationError as e:
        return jsonify({
            'error': str(e)
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
        return jsonify({
            'error': 'Failed to delete shift',
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