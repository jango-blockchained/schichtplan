from flask import Blueprint, jsonify, request
from models import db, Absence, Employee
from datetime import datetime
from http import HTTPStatus

bp = Blueprint("absences", __name__)


@bp.route("/absences", methods=["GET"])
def get_all_absences():
    absences = Absence.query.all()
    return jsonify([absence.to_dict() for absence in absences])


@bp.route("/employees/<int:employee_id>/absences", methods=["GET"])
def get_employee_absences(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    absences = Absence.query.filter_by(employee_id=employee_id).all()
    return jsonify([absence.to_dict() for absence in absences])


@bp.route("/employees/<int:employee_id>/absences", methods=["POST"])
def create_absence(employee_id):
    employee = Employee.query.get_or_404(employee_id)
    data = request.get_json()

    # Validate dates
    try:
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        if end_date < start_date:
            return jsonify({"error": "End date must be after start date"}), 400
    except (ValueError, KeyError):
        return jsonify({"error": "Invalid date format"}), 400

    # Create new absence
    absence = Absence.from_dict(data)
    db.session.add(absence)

    try:
        db.session.commit()
        return jsonify(absence.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route("/employees/<int:employee_id>/absences/<int:absence_id>", methods=["DELETE"])
def delete_absence(employee_id, absence_id):
    absence = Absence.query.filter_by(
        id=absence_id, employee_id=employee_id
    ).first_or_404()

    try:
        db.session.delete(absence)
        db.session.commit()
        return "", 204
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route("/employees/<int:employee_id>/absences/<int:absence_id>", methods=["PUT"])
def update_absence(employee_id, absence_id):
    absence = Absence.query.filter_by(
        id=absence_id, employee_id=employee_id
    ).first_or_404()
    data = request.get_json()

    # Validate dates
    try:
        if "start_date" in data and "end_date" in data:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
            if end_date < start_date:
                return jsonify({"error": "End date must be after start date"}), 400
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    # Update fields
    for key, value in data.items():
        if key in ["start_date", "end_date"]:
            setattr(absence, key, datetime.strptime(value, "%Y-%m-%d").date())
        elif key in ["absence_type_id", "note"]:
            setattr(absence, key, value)

    try:
        db.session.commit()
        return jsonify(absence.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@bp.route("/batch", methods=["POST"])
def manage_batch_absences():
    """Create, update, or delete multiple absences at once"""
    data = request.get_json()

    try:
        operations = data.get("operations", [])
        results = {"created": [], "updated": [], "deleted": [], "errors": []}

        for operation in operations:
            try:
                op_type = operation["type"]
                absence_data = operation["data"]

                if op_type == "create":
                    absence = Absence(
                        employee_id=absence_data["employee_id"],
                        date=datetime.strptime(absence_data["date"], "%Y-%m-%d").date(),
                        type=absence_data["type"],
                        start_time=absence_data.get("start_time"),
                        end_time=absence_data.get("end_time"),
                    )
                    db.session.add(absence)
                    results["created"].append(absence)

                elif op_type == "update":
                    absence = Absence.query.get(absence_data["id"])
                    if absence:
                        if "type" in absence_data:
                            absence.type = absence_data["type"]
                        if "start_time" in absence_data:
                            absence.start_time = absence_data["start_time"]
                        if "end_time" in absence_data:
                            absence.end_time = absence_data["end_time"]
                        results["updated"].append(absence)

                elif op_type == "delete":
                    absence = Absence.query.get(absence_data["id"])
                    if absence:
                        db.session.delete(absence)
                        results["deleted"].append(absence_data["id"])

            except Exception as op_error:
                results["errors"].append(
                    {"operation": operation, "error": str(op_error)}
                )

        if not results["errors"]:
            db.session.commit()
            return jsonify(
                {
                    "message": "Batch operations completed successfully",
                    "created": [absence.to_dict() for absence in results["created"]],
                    "updated": [absence.to_dict() for absence in results["updated"]],
                    "deleted": results["deleted"],
                }
            ), HTTPStatus.OK
        else:
            db.session.rollback()
            return jsonify(
                {"message": "Some operations failed", "errors": results["errors"]}
            ), HTTPStatus.BAD_REQUEST

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
