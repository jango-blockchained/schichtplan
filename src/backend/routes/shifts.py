from flask import Blueprint, jsonify, request
from models import db, Shift, ShiftType
from typing import Dict, Any

bp = Blueprint('shifts', __name__, url_prefix='/api/shifts')

@bp.route('/', methods=['GET'])
def get_shifts():
    shifts = Shift.query.all()
    return jsonify([shift.to_dict() for shift in shifts])

@bp.route('/<int:id>', methods=['GET'])
def get_shift(id: int):
    shift = Shift.query.get_or_404(id)
    return jsonify(shift.to_dict())

@bp.route('/', methods=['POST'])
def create_shift():
    data = request.get_json()
    
    try:
        shift = Shift(
            shift_type=ShiftType(data['shift_type']),
            start_time=data['start_time'],
            end_time=data['end_time'],
            min_employees=int(data['min_employees']),
            max_employees=int(data['max_employees']),
            duration_hours=float(data['duration_hours']),
            requires_break=bool(data.get('requires_break', True))
        )
        
        db.session.add(shift)
        db.session.commit()
        
        return jsonify(shift.to_dict()), 201
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/<int:id>', methods=['PUT'])
def update_shift(id: int):
    shift = Shift.query.get_or_404(id)
    data = request.get_json()
    
    try:
        shift.shift_type = ShiftType(data['shift_type'])
        shift.start_time = data['start_time']
        shift.end_time = data['end_time']
        shift.min_employees = int(data['min_employees'])
        shift.max_employees = int(data['max_employees'])
        shift.duration_hours = float(data['duration_hours'])
        shift.requires_break = bool(data.get('requires_break', True))
        
        db.session.commit()
        
        return jsonify(shift.to_dict())
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/<int:id>', methods=['DELETE'])
def delete_shift(id: int):
    shift = Shift.query.get_or_404(id)
    db.session.delete(shift)
    db.session.commit()
    return '', 204 