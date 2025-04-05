from flask import Blueprint, request, jsonify
from ..models import Absence, Employee
from datetime import datetime

bp = Blueprint("absences", __name__, url_prefix="/api/absences")


@bp.route("/", methods=["GET"])
def get_absences():
    employee_id = request.args.get("employee_id", type=int)
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    query = Absence.query
    if employee_id:
        Employee.query.get_or_404(employee_id)
        query = query.filter_by(employee_id=employee_id)
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            query = query.filter(Absence.end_date >= start_date)
        if end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            query = query.filter(Absence.start_date <= end_date)
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    absences = query.all()
    return jsonify([absence.to_dict() for absence in absences])


@bp.route("/", methods=["POST"])
def add_absence():
    from ..models import db
    data = request.get_json()
    required_fields = ["employee_id", "start_date", "end_date", "reason"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        if end_date < start_date:
            return jsonify({"error": "End date cannot be before start date"}), 400
        
        Employee.query.get_or_404(data["employee_id"])
        
        absence = Absence(
            employee_id=data["employee_id"],
            start_date=start_date,
            end_date=end_date,
            reason=data["reason"],
            notes=data.get("notes")
        )
        db.session.add(absence)
        db.session.commit()
        return jsonify(absence.to_dict()), 201
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Could not add absence: {e}"}), 500


@bp.route("/<int:absence_id>", methods=["PUT"])
def update_absence(absence_id):
    from ..models import db
    data = request.get_json()
    absence = Absence.query.get_or_404(absence_id)

    try:
        if "start_date" in data:
            absence.start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        if "end_date" in data:
            absence.end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        if "reason" in data:
            absence.reason = data["reason"]
        if "notes" in data:
            absence.notes = data.get("notes")
            
        if absence.end_date < absence.start_date:
            return jsonify({"error": "End date cannot be before start date"}), 400

        db.session.commit()
        return jsonify(absence.to_dict())
    except ValueError:
        db.session.rollback()
        return jsonify({"error": "Invalid date format"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Could not update absence: {e}"}), 500


@bp.route("/<int:absence_id>", methods=["DELETE"])
def delete_absence(absence_id):
    from ..models import db
    absence = Absence.query.get_or_404(absence_id)
    try:
        db.session.delete(absence)
        db.session.commit()
        return "", 204
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Could not delete absence: {e}"}), 500 