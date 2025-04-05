from flask import Blueprint, request, jsonify
from http import HTTPStatus
from ..models import db, Employee, Absence
from datetime import datetime

bp = Blueprint("employee_absences", __name__, url_prefix="/api/employees")


@bp.route("/<int:employee_id>/absences", methods=["GET"])
def get_employee_absences(employee_id):
    """Get all absences for a specific employee"""
    try:
        # Check if employee exists
        employee = Employee.query.get_or_404(employee_id)
        
        # Get absences for the employee
        absences = Absence.query.filter_by(employee_id=employee_id).all()
        
        return jsonify([absence.to_dict() for absence in absences]), HTTPStatus.OK
    except Exception as e:
        return jsonify({
            "error": "Error retrieving employee absences",
            "details": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/<int:employee_id>/absences", methods=["POST"])
def create_employee_absence(employee_id):
    """Create a new absence for an employee"""
    try:
        # Check if employee exists
        employee = Employee.query.get_or_404(employee_id)
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ["absence_type_id", "start_date", "end_date"]
        if not all(field in data for field in required_fields):
            return jsonify({
                "error": "Missing required fields",
                "required": required_fields
            }), HTTPStatus.BAD_REQUEST
        
        # Parse dates
        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
            
            # Validate dates
            if end_date < start_date:
                return jsonify({
                    "error": "End date cannot be before start date"
                }), HTTPStatus.BAD_REQUEST
                
        except ValueError:
            return jsonify({
                "error": "Invalid date format. Use YYYY-MM-DD"
            }), HTTPStatus.BAD_REQUEST
        
        # Create new absence
        absence = Absence(
            employee_id=employee_id,
            absence_type_id=data["absence_type_id"],
            start_date=start_date,
            end_date=end_date,
            note=data.get("note", "")
        )
        
        db.session.add(absence)
        db.session.commit()
        
        return jsonify(absence.to_dict()), HTTPStatus.CREATED
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Error creating employee absence",
            "details": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/<int:employee_id>/absences/<int:absence_id>", methods=["PUT"])
def update_employee_absence(employee_id, absence_id):
    """Update an existing absence for an employee"""
    try:
        # Check if employee exists
        employee = Employee.query.get_or_404(employee_id)
        
        # Check if absence exists and belongs to employee
        absence = Absence.query.get_or_404(absence_id)
        if absence.employee_id != employee_id:
            return jsonify({
                "error": "Absence does not belong to the specified employee"
            }), HTTPStatus.FORBIDDEN
        
        data = request.get_json()
        
        # Update absence fields
        if "absence_type_id" in data:
            absence.absence_type_id = data["absence_type_id"]
            
        if "start_date" in data:
            try:
                absence.start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            except ValueError:
                return jsonify({
                    "error": "Invalid start date format. Use YYYY-MM-DD"
                }), HTTPStatus.BAD_REQUEST
                
        if "end_date" in data:
            try:
                absence.end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
            except ValueError:
                return jsonify({
                    "error": "Invalid end date format. Use YYYY-MM-DD"
                }), HTTPStatus.BAD_REQUEST
                
        if "note" in data:
            absence.note = data["note"]
            
        # Validate dates
        if absence.end_date < absence.start_date:
            return jsonify({
                "error": "End date cannot be before start date"
            }), HTTPStatus.BAD_REQUEST
            
        db.session.commit()
        
        return jsonify(absence.to_dict()), HTTPStatus.OK
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Error updating employee absence",
            "details": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/<int:employee_id>/absences/<int:absence_id>", methods=["DELETE"])
def delete_employee_absence(employee_id, absence_id):
    """Delete an absence for an employee"""
    try:
        # Check if employee exists
        employee = Employee.query.get_or_404(employee_id)
        
        # Check if absence exists and belongs to employee
        absence = Absence.query.get_or_404(absence_id)
        if absence.employee_id != employee_id:
            return jsonify({
                "error": "Absence does not belong to the specified employee"
            }), HTTPStatus.FORBIDDEN
            
        db.session.delete(absence)
        db.session.commit()
        
        return jsonify({
            "message": "Absence deleted successfully"
        }), HTTPStatus.OK
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Error deleting employee absence",
            "details": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR 