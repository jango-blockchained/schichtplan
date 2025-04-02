from flask import Blueprint, jsonify, request
from http import HTTPStatus
from ..models import db, ShiftTemplate
from ..models.fixed_shift import ShiftValidationError, ShiftType

shifts = Blueprint("shifts", __name__)


@shifts.route("/shifts", methods=["GET"])
@shifts.route("/shifts/", methods=["GET"])
def get_shifts():
    """Get all shifts"""
    shifts = ShiftTemplate.query.all()
    return jsonify([shift.to_dict() for shift in shifts])


@shifts.route("/shifts/<int:shift_id>", methods=["GET"])
@shifts.route("/shifts/<int:shift_id>/", methods=["GET"])
def get_shift(shift_id):
    """Get a specific shift"""
    shift = ShiftTemplate.query.get_or_404(shift_id)
    return jsonify(shift.to_dict())


@shifts.route("/shifts", methods=["POST"])
@shifts.route("/shifts/", methods=["POST"])
def create_shift():
    """Create a new shift"""
    data = request.get_json()

    try:
        shift = ShiftTemplate(
            start_time=data["start_time"],
            end_time=data["end_time"],
            requires_break=data.get("requires_break", True),
            active_days=data.get("active_days"),
            shift_type_id=data.get("shift_type_id"),
        )

        db.session.add(shift)
        db.session.commit()

        return jsonify(shift.to_dict()), 201

    except KeyError as e:
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except ShiftValidationError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@shifts.route("/shifts/<int:shift_id>", methods=["PUT"])
@shifts.route("/shifts/<int:shift_id>/", methods=["PUT"])
def update_shift(shift_id):
    """Update a shift"""
    shift = ShiftTemplate.query.get_or_404(shift_id)
    data = request.get_json()

    try:
        if "start_time" in data or "end_time" in data:
            start_time = data.get("start_time", shift.start_time)
            end_time = data.get("end_time", shift.end_time)
            shift.start_time = start_time
            shift.end_time = end_time
            # Recalculate duration when times change
            shift._calculate_duration()

        if "requires_break" in data:
            shift.requires_break = data["requires_break"]

        if "active_days" in data:
            shift.active_days = data["active_days"]

        if "duration_hours" in data:
            shift.duration_hours = data["duration_hours"]

        if "shift_type_id" in data:
            shift.shift_type_id = data["shift_type_id"]
            # Update shift_type based on shift_type_id
            if data["shift_type_id"] == "EARLY":
                shift.shift_type = ShiftType.EARLY
            elif data["shift_type_id"] == "MIDDLE":
                shift.shift_type = ShiftType.MIDDLE
            elif data["shift_type_id"] == "LATE":
                shift.shift_type = ShiftType.LATE

        # Duration needs to be calculated or must be valid
        if shift.duration_hours is None or shift.duration_hours <= 0:
            shift._calculate_duration()

        # Validate the updated shift
        shift.validate()

        db.session.commit()
        return jsonify(shift.to_dict())

    except ShiftValidationError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An unexpected error occurred"}), 500


@shifts.route("/shifts/<int:shift_id>", methods=["DELETE"])
@shifts.route("/shifts/<int:shift_id>/", methods=["DELETE"])
def delete_shift(shift_id):
    """Delete a shift"""
    shift = ShiftTemplate.query.get_or_404(shift_id)

    try:
        db.session.delete(shift)
        db.session.commit()
        return "", 204

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@shifts.route("/shifts/fix-durations", methods=["POST"])
def fix_shift_durations():
    """Fix all shifts with missing duration_hours"""
    try:
        # Get all shifts
        shifts = ShiftTemplate.query.all()

        # Count of fixed shifts
        fixed_count = 0

        # Check each shift
        for shift in shifts:
            if shift.duration_hours is None or shift.duration_hours <= 0:
                # Calculate duration
                shift._calculate_duration()
                fixed_count += 1

        # Commit changes
        db.session.commit()

        return jsonify(
            {
                "message": f"Fixed {fixed_count} shifts with missing duration_hours",
                "fixed_count": fixed_count,
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@shifts.route("/shift-templates/<int:template_id>", methods=["DELETE"])
def delete_shift_template(template_id):
    template = ShiftTemplate.query.get_or_404(template_id)
    try:
        db.session.delete(template)
        db.session.commit()
        return jsonify({"message": "Shift template deleted"}), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@shifts.route("/shift-templates/<int:template_id>", methods=["PUT"])
def update_shift_template(template_id):
    data = request.get_json()
    template = ShiftTemplate.query.get_or_404(template_id)

    # Basic validation
    if not data:
        return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

    try:
        template.update_from_dict(data)
        db.session.commit()
        return jsonify(template.to_dict()), HTTPStatus.OK
    except ShiftValidationError as e:
        db.session.rollback()
        # Ensure details are included if present
        error_payload = {"error": str(e)}
        if hasattr(e, 'errors') and e.errors:
             error_payload["details"] = e.errors
        return jsonify(error_payload), HTTPStatus.BAD_REQUEST
    except Exception as e: # Keep original exception handling
        db.session.rollback()
        # Log the full error for debugging
        # logger.error(f"Error updating shift template {template_id}: {str(e)}")
        return jsonify({"error": "An unexpected error occurred"}), \
               HTTPStatus.INTERNAL_SERVER_ERROR
