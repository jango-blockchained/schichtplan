from flask import Blueprint, jsonify, request
from models import db, ShiftTemplate
from models.fixed_shift import ShiftValidationError

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
            # If either time is updated, validate both
            new_start = data.get("start_time", shift.start_time)
            new_end = data.get("end_time", shift.end_time)
            # Create a temporary shift to validate times
            temp_shift = ShiftTemplate(
                start_time=new_start,
                end_time=new_end,
            )
            # If validation passes, update the actual shift
            shift.start_time = new_start
            shift.end_time = new_end

        if "requires_break" in data:
            shift.requires_break = data["requires_break"]

        shift._calculate_duration()  # Recalculate duration after time changes
        db.session.commit()

        return jsonify(shift.to_dict())

    except ShiftValidationError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


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
