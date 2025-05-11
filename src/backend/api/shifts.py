from flask import Blueprint, request, jsonify
from models import db, ShiftTemplate
from http import HTTPStatus
from models.fixed_shift import ShiftValidationError

bp = Blueprint("shifts", __name__, url_prefix="/api/shifts")


@bp.route("/", methods=["GET"])
def get_shifts():
    """Get all shifts"""
    shifts = ShiftTemplate.query.all()
    return jsonify([shift.to_dict() for shift in shifts]), HTTPStatus.OK


@bp.route("/<int:shift_id>", methods=["GET"])
def get_shift(shift_id):
    """Get shift by ID"""
    shift = ShiftTemplate.query.get_or_404(shift_id)
    return jsonify(shift.to_dict()), HTTPStatus.OK


@bp.route("/", methods=["POST"])
def create_shift():
    """Create new shift"""
    data = request.get_json()

    try:
        shift = ShiftTemplate(
            start_time=data["start_time"],
            end_time=data["end_time"],
            requires_break=bool(data.get("requires_break", True)),
            active_days=data.get(
                "active_days",
                {
                    "0": True,  # Monday
                    "1": True,  # Tuesday
                    "2": True,  # Wednesday
                    "3": True,  # Thursday
                    "4": True,  # Friday
                    "5": True,  # Saturday
                    "6": False, # Sunday
                },
            ),
        )

        # Validate before adding to session
        shift.validate()
        db.session.add(shift)
        db.session.commit()

        return jsonify(shift.to_dict()), HTTPStatus.CREATED

    except (KeyError, ValueError) as e:
        return jsonify(
            {"error": "Invalid data provided", "details": str(e)}
        ), HTTPStatus.BAD_REQUEST
    except ShiftValidationError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST


@bp.route("/<int:shift_id>", methods=["PUT"])
def update_shift(shift_id):
    """Update shift"""
    shift = ShiftTemplate.query.get_or_404(shift_id)
    data = request.get_json()

    try:
        if "start_time" in data:
            shift.start_time = data["start_time"]
        if "end_time" in data:
            shift.end_time = data["end_time"]
        if "requires_break" in data:
            shift.requires_break = bool(data["requires_break"])
        if "active_days" in data:
            shift.active_days = data["active_days"]

        # Validate before committing
        shift.validate()
        db.session.commit()

        return jsonify(shift.to_dict()), HTTPStatus.OK

    except (ValueError, KeyError) as e:
        return jsonify(
            {"error": "Invalid data provided", "details": str(e)}
        ), HTTPStatus.BAD_REQUEST
    except ShiftValidationError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST


@bp.route("/<int:shift_id>", methods=["DELETE"])
def delete_shift(shift_id):
    """Delete shift"""
    shift = ShiftTemplate.query.get_or_404(shift_id)

    try:
        db.session.delete(shift)
        db.session.commit()

        return jsonify({"message": "Shift deleted successfully"}), HTTPStatus.OK

    except Exception as e:
        return jsonify(
            {"error": "Failed to delete shift", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/defaults", methods=["POST"])
def create_default_shifts():
    """Create default shifts"""
    try:
        default_shifts = ShiftTemplate.create_default_shifts()
        for shift in default_shifts:
            db.session.add(shift)
        db.session.commit()

        return jsonify(
            {
                "message": "Default shifts created successfully",
                "count": len(default_shifts),
            }
        ), HTTPStatus.CREATED

    except Exception as e:
        db.session.rollback()
        return jsonify(
            {"error": "Could not create default shifts", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
