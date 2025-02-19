from flask import Blueprint, jsonify, request
from models import db, Shift
from datetime import datetime

shifts = Blueprint('shifts', __name__)

@shifts.route('/api/shifts', methods=['GET'])
def get_shifts():
    """Get all shifts"""
    shifts = Shift.query.all()
    return jsonify([shift.to_dict() for shift in shifts])

@shifts.route('/api/shifts/<int:shift_id>', methods=['GET'])
def get_shift(shift_id):
    """Get a specific shift"""
    shift = Shift.query.get_or_404(shift_id)
    return jsonify(shift.to_dict())

@shifts.route('/api/shifts', methods=['POST'])
def create_shift():
    """Create a new shift"""
    data = request.get_json()
    
    try:
        shift = Shift(
            start_time=data['start_time'],
            end_time=data['end_time'],
            min_employees=data['min_employees'],
            max_employees=data['max_employees'],
            requires_break=data.get('requires_break', True)
        )
        
        db.session.add(shift)
        db.session.commit()
        
        return jsonify(shift.to_dict()), 201
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shifts.route('/api/shifts/<int:shift_id>', methods=['PUT'])
def update_shift(shift_id):
    """Update a shift"""
    shift = Shift.query.get_or_404(shift_id)
    data = request.get_json()
    
    try:
        shift.start_time = data.get('start_time', shift.start_time)
        shift.end_time = data.get('end_time', shift.end_time)
        shift.min_employees = data.get('min_employees', shift.min_employees)
        shift.max_employees = data.get('max_employees', shift.max_employees)
        shift.requires_break = data.get('requires_break', shift.requires_break)
        
        shift._calculate_duration()  # Recalculate duration after time changes
        db.session.commit()
        
        return jsonify(shift.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@shifts.route('/api/shifts/<int:shift_id>', methods=['DELETE'])
def delete_shift(shift_id):
    """Delete a shift"""
    shift = Shift.query.get_or_404(shift_id)
    
    try:
        db.session.delete(shift)
        db.session.commit()
        return '', 204
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500 