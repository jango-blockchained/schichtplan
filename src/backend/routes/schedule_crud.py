from flask import Blueprint, request, jsonify
from http import HTTPStatus
from datetime import datetime

# Relative imports
from ..models import db, Schedule
from ..utils.logger import logger

crud_bp = Blueprint("schedule_crud", __name__, url_prefix="/api/schedules")

# GET all schedules (simplified from original complex version)
@crud_bp.route("/", methods=["GET"])
def get_schedules_crud():
    """Get schedules, optionally filtered by date and version."""
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    version = request.args.get("version", type=int)

    query = Schedule.query

    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            query = query.filter(Schedule.date >= start_date)
        if end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            query = query.filter(Schedule.date <= end_date)
        if version is not None:
            query = query.filter(Schedule.version == version)
            
        schedules = query.order_by(Schedule.date, Schedule.employee_id).all()
        return jsonify([s.to_dict() for s in schedules])
    
    except ValueError:
        return (
            jsonify({"error": "Invalid date format (YYYY-MM-DD)"}), 
            HTTPStatus.BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error fetching schedules: {e}")
        return (
            jsonify({"error": "Failed to fetch schedules"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )

# GET a specific schedule entry
@crud_bp.route("/<int:schedule_id>", methods=["GET"])
def get_schedule_crud(schedule_id):
    """Get a specific schedule entry by ID."""
    try:
        schedule = Schedule.query.get_or_404(schedule_id)
        return jsonify(schedule.to_dict())
    except Exception as e:
        logger.error(f"Error fetching schedule {schedule_id}: {e}")
        return (
            jsonify({"error": "Failed to fetch schedule"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )

# PUT (Update) a specific schedule entry (e.g., for drag & drop)
@crud_bp.route("/<int:schedule_id>", methods=["PUT"])
def update_schedule_crud(schedule_id):
    """Update a schedule entry (for drag and drop functionality)."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

        schedule = Schedule.query.get_or_404(schedule_id)
        logger.info(f"Updating schedule {schedule_id}")

        # Update fields provided in the request
        if "employee_id" in data:
            schedule.employee_id = data["employee_id"]
        if "shift_id" in data:
            schedule.shift_id = data["shift_id"]
        if "date" in data:
            try:
                date_str = data["date"].split("T")[0]
                schedule.date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "Invalid date format"}), HTTPStatus.BAD_REQUEST
        if "notes" in data:
            schedule.notes = data.get("notes")
        if "version" in data:
            schedule.version = data["version"]
        if "shift_type" in data:
            schedule.shift_type = data.get("shift_type")
        if "break_start" in data:
            schedule.break_start = data.get("break_start")
        if "break_end" in data:
            schedule.break_end = data.get("break_end")
        
        db.session.commit()
        logger.info(f"Schedule {schedule_id} updated.")
        return jsonify(schedule.to_dict())

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating schedule {schedule_id}: {e}")
        return (
            jsonify({"error": "Failed to update schedule"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )

# DELETE a specific schedule entry
@crud_bp.route("/<int:schedule_id>", methods=["DELETE"])
def delete_schedule_crud(schedule_id):
    """Delete a schedule entry."""
    try:
        schedule = Schedule.query.get_or_404(schedule_id)
        db.session.delete(schedule)
        db.session.commit()
        logger.info(f"Schedule {schedule_id} deleted successfully.")
        # Return NO_CONTENT status for successful deletion
        return "", HTTPStatus.NO_CONTENT
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting schedule {schedule_id}: {e}")
        return (
            jsonify({"error": "Failed to delete schedule"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        ) 