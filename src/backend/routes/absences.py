from datetime import datetime

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from src.backend.models import Absence, Employee, db
from src.backend.schemas.absences import (
    AbsenceCreateRequest,
    AbsenceUpdateRequest,
)

bp = Blueprint("absences", __name__)


# Direct route to the absences endpoint for POST requests
@bp.route("/", methods=["POST"])
@bp.route("/absences/", methods=["POST"])
def create_absence_direct():
    """Create a new absence directly from the /absences/ endpoint.
    This route expects employee_id in the request body."""
    try:
        data = request.get_json()
        # Make sure employee_id is provided in the request
        if "employee_id" not in data:
            return jsonify({"error": "employee_id is required"}), 400

        employee_id = data["employee_id"]
        # Check if employee exists
        Employee.query.get_or_404(employee_id)

        # Validate data using Pydantic schema
        request_data = AbsenceCreateRequest(**data)

        # Keep check if end date is after start date (logical validation)
        if request_data.end_date < request_data.start_date:
            return jsonify({"error": "End date must be after start date"}), 400

        # Create new absence using validated data
        absence = Absence.from_dict(request_data.dict())
        absence.employee_id = employee_id  # Set employee_id from request
        db.session.add(absence)

        db.session.commit()
        return jsonify(absence.to_dict()), 201

    except ValidationError as e:  # Catch Pydantic validation errors
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Invalid input.",
                    "details": e.errors(),
                }
            ),
            400,
        )  # Return validation details
    except Exception as e:  # Catch any other exceptions
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 400


@bp.route("/", methods=["GET"])
@bp.route("/absences/", methods=["GET"])
def list_absences():
    """List absences filtered by optional date range and employee.

    Query params:
      - start_date: YYYY-MM-DD (optional)
      - end_date: YYYY-MM-DD (optional)
      - employee_id: int (optional)

    If no dates are provided, returns all absences (use cautiously).
    If only one of start_date/end_date is provided,
    the other will default to the same value.
    """
    try:
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        employee_id = request.args.get("employee_id", type=int)

        query = Absence.query

        # Date parsing and overlap filtering
        if start_date_str or end_date_str:
            if not end_date_str:
                end_date_str = start_date_str
            if not start_date_str:
                start_date_str = end_date_str

            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except ValueError:
                return (
                    jsonify(
                        {
                            "error": "Invalid date format. Use YYYY-MM-DD.",
                        }
                    ),
                    400,
                )

            # Overlap condition ensures absences intersect requested window
            query = query.filter(
                Absence.start_date <= end_date, Absence.end_date >= start_date
            )

        if employee_id is not None:
            query = query.filter_by(employee_id=employee_id)

        absences = query.all()
        return jsonify([a.to_dict() for a in absences]), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400


@bp.route("/employees/<int:employee_id>/absences", methods=["GET"])
@bp.route(
    "employees/<int:employee_id>/absences", methods=["GET"]
)  # Without leading slash for different URL patterns
@bp.route("/absences/employees/<int:employee_id>/absences", methods=["GET"])
def get_employee_absences(employee_id):
    Employee.query.get_or_404(employee_id)
    absences = Absence.query.filter_by(employee_id=employee_id).all()
    return jsonify([absence.to_dict() for absence in absences])


@bp.route("/employees/<int:employee_id>/absences", methods=["POST"])
@bp.route(
    "employees/<int:employee_id>/absences", methods=["POST"]
)  # Without leading slash
@bp.route("/absences/employees/<int:employee_id>/absences", methods=["POST"])
def create_absence(employee_id):
    Employee.query.get_or_404(employee_id)

    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = AbsenceCreateRequest(**data)

        # Keep check if end date is after start date (logical validation)
        if request_data.end_date < request_data.start_date:
            return jsonify({"error": "End date must be after start date"}), 400

        # Create new absence using validated data
        absence = Absence.from_dict(request_data.dict())
        absence.employee_id = employee_id  # Set employee_id from URL
        db.session.add(absence)

        db.session.commit()
        return jsonify(absence.to_dict()), 201

    except ValidationError as e:  # Catch Pydantic validation errors
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Invalid input.",
                    "details": e.errors(),
                }
            ),
            400,
        )  # Return validation details
    except Exception as e:  # Catch any other exceptions
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 400


@bp.route(
    "/employees/<int:employee_id>/absences/<int:absence_id>",
    methods=["DELETE"],
)
@bp.route(
    "employees/<int:employee_id>/absences/<int:absence_id>", methods=["DELETE"]
)  # Without leading slash
@bp.route(
    "/absences/employees/<int:employee_id>/absences/<int:absence_id>",
    methods=["DELETE"],
)
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


@bp.route(
    "/employees/<int:employee_id>/absences/<int:absence_id>",
    methods=["PUT"],
)
@bp.route(
    "employees/<int:employee_id>/absences/<int:absence_id>", methods=["PUT"]
)  # Without leading slash
@bp.route(
    "/absences/employees/<int:employee_id>/absences/<int:absence_id>",
    methods=["PUT"],
)
def update_absence(employee_id, absence_id):
    absence = Absence.query.filter_by(
        id=absence_id, employee_id=employee_id
    ).first_or_404()

    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = AbsenceUpdateRequest(**data)

        # Validate dates (logical validation after Pydantic format check)
        if (
            request_data.start_date
            and request_data.end_date
            and request_data.end_date < request_data.start_date
        ):
            return jsonify({"error": "End date must be after start date"}), 400

        # Update fields from validated data if provided
        if request_data.start_date is not None:
            absence.start_date = request_data.start_date
        if request_data.end_date is not None:
            absence.end_date = request_data.end_date
        if request_data.absence_type_id is not None:
            absence.absence_type_id = request_data.absence_type_id
        if request_data.note is not None:
            absence.note = request_data.note
        if request_data.status is not None:
            absence.status = request_data.status

        db.session.commit()
        return jsonify(absence.to_dict())

    except ValidationError as e:  # Catch Pydantic validation errors
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Invalid input.",
                    "details": e.errors(),
                }
            ),
            400,
        )  # Return validation details
    except Exception as e:  # Catch any other exceptions
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 400
