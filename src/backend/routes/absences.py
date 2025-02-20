from flask import Blueprint, jsonify, request
from models import db, Absence, Employee
from datetime import datetime

bp = Blueprint('absences', __name__)

@bp.route('/api/employees/<int:employee_id>/absences', methods=['GET'])
def get_employee_absences(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    absences = Absence.query.filter_by(employee_id=employee_id).all()
    return jsonify([absence.to_dict() for absence in absences])

@bp.route('/api/employees/<int:employee_id>/absences', methods=['POST'])
def create_absence(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    data = request.get_json()
    
    # Validate dates
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        if end_date < start_date:
            return jsonify({'error': 'End date must be after start date'}), 400
    except (ValueError, KeyError):
        return jsonify({'error': 'Invalid date format'}), 400

    # Create new absence
    absence = Absence.from_dict(data)
    db.session.add(absence)
    
    try:
        db.session.commit()
        return jsonify(absence.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@bp.route('/api/employees/<int:employee_id>/absences/<int:absence_id>', methods=['DELETE'])
def delete_absence(employee_id, absence_id):
    absence = Absence.query.filter_by(id=absence_id, employee_id=employee_id).first_or_404()
    
    try:
        db.session.delete(absence)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@bp.route('/api/employees/<int:employee_id>/absences/<int:absence_id>', methods=['PUT'])
def update_absence(employee_id, absence_id):
    absence = Absence.query.filter_by(id=absence_id, employee_id=employee_id).first_or_404()
    data = request.get_json()
    
    # Validate dates
    try:
        if 'start_date' in data and 'end_date' in data:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
            if end_date < start_date:
                return jsonify({'error': 'End date must be after start date'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    # Update fields
    for key, value in data.items():
        if key in ['start_date', 'end_date']:
            setattr(absence, key, datetime.strptime(value, '%Y-%m-%d').date())
        elif key in ['absence_type_id', 'note']:
            setattr(absence, key, value)
    
    try:
        db.session.commit()
        return jsonify(absence.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400 