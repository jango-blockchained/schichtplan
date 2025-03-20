from flask import Blueprint, jsonify, request
from models import db, ShiftTemplate
from models.fixed_shift import ShiftValidationError, ShiftType
from services.event_service import emit_shift_template_updated
from datetime import datetime

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

        # Emit WebSocket event
        try:
            emit_shift_template_updated(
                {
                    "action": "create",
                    "shift_id": shift.id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting shift_template_updated event: {str(e)}")

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

        # Emit WebSocket event
        try:
            emit_shift_template_updated(
                {
                    "action": "update",
                    "shift_id": shift.id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting shift_template_updated event: {str(e)}")

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

        # Emit WebSocket event
        try:
            emit_shift_template_updated(
                {
                    "action": "delete",
                    "shift_id": shift_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting shift_template_updated event: {str(e)}")

        return "", 204

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@shifts.route("/shifts/fix-durations", methods=["POST"])
def fix_shift_durations():
    """Fix shift durations for all shifts"""
    try:
        shifts = ShiftTemplate.query.all()
        fixed_shifts = []

        for shift in shifts:
            if shift.duration_hours is None or shift.duration_hours <= 0:
                shift._calculate_duration()
                fixed_shifts.append(shift.id)

        db.session.commit()

        # Emit WebSocket event if shifts were fixed
        if fixed_shifts:
            try:
                emit_shift_template_updated(
                    {
                        "action": "batch_update",
                        "shift_ids": fixed_shifts,
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )
            except Exception as e:
                print(f"Error emitting shift_template_updated event: {str(e)}")

        return jsonify(
            {
                "message": f"Fixed durations for {len(fixed_shifts)} shifts",
                "fixed_shifts": fixed_shifts,
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
