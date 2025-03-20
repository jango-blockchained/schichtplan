from flask import Blueprint, jsonify, request
from models import db, Absence, Employee
from datetime import datetime
from services.event_service import emit_absence_updated

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

        # Emit WebSocket event
        try:
            emit_absence_updated(
                {
                    "action": "create",
                    "absence_id": absence.id,
                    "employee_id": employee_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting absence_updated event: {str(e)}")

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

        # Emit WebSocket event
        try:
            emit_absence_updated(
                {
                    "action": "delete",
                    "absence_id": absence_id,
                    "employee_id": employee_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting absence_updated event: {str(e)}")

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

        # Emit WebSocket event
        try:
            emit_absence_updated(
                {
                    "action": "update",
                    "absence_id": absence_id,
                    "employee_id": employee_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting absence_updated event: {str(e)}")

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
        affected_employees = set()

        for op in operations:
            operation_type = op.get("operation")
            absence_data = op.get("data", {})

            try:
                if operation_type == "create":
                    absence = Absence.from_dict(absence_data)
                    db.session.add(absence)
                    results["created"].append(absence.id)
                    affected_employees.add(absence.employee_id)

                elif operation_type == "update":
                    absence_id = absence_data.get("id")
                    if not absence_id:
                        results["errors"].append(
                            {"error": "Missing absence ID for update"}
                        )
                        continue

                    absence = Absence.query.get(absence_id)
                    if not absence:
                        results["errors"].append(
                            {"error": f"Absence {absence_id} not found"}
                        )
                        continue

                    # Update fields
                    for key, value in absence_data.items():
                        if key in ["start_date", "end_date"]:
                            setattr(
                                absence,
                                key,
                                datetime.strptime(value, "%Y-%m-%d").date(),
                            )
                        elif key in ["absence_type_id", "note", "employee_id"]:
                            setattr(absence, key, value)

                    results["updated"].append(absence_id)
                    affected_employees.add(absence.employee_id)

                elif operation_type == "delete":
                    absence_id = absence_data.get("id")
                    if not absence_id:
                        results["errors"].append(
                            {"error": "Missing absence ID for delete"}
                        )
                        continue

                    absence = Absence.query.get(absence_id)
                    if not absence:
                        results["errors"].append(
                            {"error": f"Absence {absence_id} not found"}
                        )
                        continue

                    affected_employees.add(absence.employee_id)
                    db.session.delete(absence)
                    results["deleted"].append(absence_id)

                else:
                    results["errors"].append(
                        {"error": f"Unknown operation type: {operation_type}"}
                    )

            except Exception as e:
                results["errors"].append({"error": str(e), "data": absence_data})

        db.session.commit()

        # Emit WebSocket events for each affected employee
        try:
            for employee_id in affected_employees:
                emit_absence_updated(
                    {
                        "action": "batch_update",
                        "employee_id": employee_id,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
        except Exception as e:
            print(f"Error emitting absence_updated event: {str(e)}")

        return jsonify(results), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
