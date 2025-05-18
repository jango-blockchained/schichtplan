from flask import Blueprint, jsonify, request
from src.backend.models import db, Absence, Employee
from datetime import datetime
from pydantic import ValidationError
from src.backend.schemas.absences import AbsenceCreateRequest, AbsenceUpdateRequest

bp = Blueprint('absences', __name__)

@bp.route('/employees/<int:employee_id>/absences', methods=['GET'])
def get_employee_absences(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    absences = Absence.query.filter_by(employee_id=employee_id).all()
    return jsonify([absence.to_dict() for absence in absences])

@bp.route('/employees/<int:employee_id>/absences', methods=['POST'])
def create_absence(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    
    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = AbsenceCreateRequest(**data)

        # Keep check if end date is after start date (logical validation)
        if request_data.end_date < request_data.start_date:
            return jsonify({'error': 'End date must be after start date'}), 400

        # Create new absence using validated data
        absence = Absence.from_dict(request_data.dict())
        absence.employee_id = employee_id # Set employee_id from URL
        db.session.add(absence)
    
        db.session.commit()
        return jsonify(absence.to_dict()), 201
    
    except ValidationError as e: # Catch Pydantic validation errors
        return jsonify({"status": "error", "message": "Invalid input.", "details": e.errors()}), 400 # Return validation details
    except Exception as e: # Catch any other exceptions
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 400

@bp.route('/employees/<int:employee_id>/absences/<int:absence_id>', methods=['DELETE'])
def delete_absence(employee_id, absence_id):
    absence = Absence.query.filter_by(id=absence_id, employee_id=employee_id).first_or_404()
    
    try:
        db.session.delete(absence)
        db.session.commit()
        return '', 204
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@bp.route('/employees/<int:employee_id>/absences/<int:absence_id>', methods=['PUT'])
def update_absence(employee_id, absence_id):
    absence = Absence.query.filter_by(id=absence_id, employee_id=employee_id).first_or_404()
    
    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = AbsenceUpdateRequest(**data)

        # Validate dates (logical validation after Pydantic format check)
        if request_data.start_date and request_data.end_date and request_data.end_date < request_data.start_date:
             return jsonify({'error': 'End date must be after start date'}), 400

        # Update fields from validated data if provided
        if request_data.start_date is not None:
            absence.start_date = request_data.start_date
        if request_data.end_date is not None:
            absence.end_date = request_data.end_date
        if request_data.absence_type_id is not None:
            absence.absence_type_id = request_data.absence_type_id
        if request_data.note is not None:
            absence.note = request_data.note

        db.session.commit()
        return jsonify(absence.to_dict())

    except ValidationError as e: # Catch Pydantic validation errors
        return jsonify({"status": "error", "message": "Invalid input.", "details": e.errors()}), 400 # Return validation details
    except Exception as e: # Catch any other exceptions
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 400 