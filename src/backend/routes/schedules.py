from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, current_app, send_file
from models import db, Schedule, ShiftTemplate
from models.schedule import ScheduleStatus
from sqlalchemy import desc
from services.pdf_generator import PDFGenerator
from http import HTTPStatus
from utils.logger import logger
import uuid
from services.scheduler.generator import ScheduleGenerator, ScheduleGenerationError
from services.scheduler.resources import ScheduleResources, ScheduleResourceError
from services.scheduler.validator import ScheduleValidator, ScheduleConfig

# Define blueprint
schedules = Blueprint("schedules", __name__)


@schedules.route("/schedules", methods=["GET"])
@schedules.route("/schedules/", methods=["GET"])
def get_schedules():
    """Get all schedules within a date range"""
    try:
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        version = request.args.get("version", type=int)  # Optional version filter
        include_empty = (
            request.args.get("include_empty", "false").lower() == "true"
        )  # Default to false

        # Provide default date range (current week) if parameters are missing
        if not start_date or not end_date:
            today = date.today()
            # Start from Monday of the current week
            start_of_week = today - timedelta(days=today.weekday())
            # End on Sunday of the current week
            end_of_week = start_of_week + timedelta(days=6)

            start_date = start_of_week.strftime("%Y-%m-%d")
            end_date = end_of_week.strftime("%Y-%m-%d")

            logger.schedule_logger.info(
                f"Using default date range: {start_date} to {end_date}"
            )

        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Build query
        query = Schedule.query.filter(
            Schedule.date >= start_date, Schedule.date <= end_date
        )

        # Filter by version if specified
        if version is not None:
            query = query.filter(Schedule.version == version)

        # Fetch all schedules first
        all_schedules = query.all()

        # Get the placeholder shift (00:00 - 00:00)
        placeholder_shift = ShiftTemplate.query.filter_by(
            start_time="00:00", end_time="00:00"
        ).first()

        # Filter out empty schedules if requested
        if not include_empty and placeholder_shift:
            schedules = [s for s in all_schedules if s.shift_id != placeholder_shift.id]
        else:
            schedules = all_schedules

        # Get all versions for this date range
        versions = (
            db.session.query(Schedule.version)
            .filter(Schedule.date >= start_date, Schedule.date <= end_date)
            .distinct()
            .order_by(Schedule.version.desc())
            .all()
        )

        return jsonify(
            {
                "schedules": [schedule.to_dict() for schedule in schedules],
                "versions": [v[0] for v in versions],
                "total_schedules": len(all_schedules),
                "filtered_schedules": len(schedules),
            }
        )

    except ValueError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/generate", methods=["POST"])
@schedules.route("/schedules/generate/", methods=["POST"])
def generate_schedule():
    """Generate a schedule for a date range"""
    # Create a unique session ID for this generation request
    session_id = str(uuid.uuid4())

    # Create a session-specific logger with a memory handler to capture logs
    from logging import StreamHandler
    from io import StringIO

    log_stream = StringIO()
    memory_handler = StreamHandler(log_stream)
    session_logger = logger.create_session_logger(session_id)
    session_logger.addHandler(memory_handler)

    session_logger.info(
        "Schedule generation request received",
        extra={
            "action": "generation_request",
            "request_id": session_id,
        },
    )

    try:
        data = request.get_json()
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()

        # Get the create_empty_schedules parameter, default to True
        create_empty_schedules = data.get("create_empty_schedules", True)

        session_logger.info(
            f"Generating schedule for period: {start_date} to {end_date}",
            extra={
                "action": "generate_schedule",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "create_empty_schedules": create_empty_schedules,
            },
        )

        # Delete existing schedules for the period
        existing_schedules = Schedule.query.filter(
            Schedule.date >= start_date, Schedule.date <= end_date
        ).all()

        session_logger.info(
            f"Found {len(existing_schedules)} existing schedules for the period",
            extra={
                "action": "existing_schedules",
                "count": len(existing_schedules),
            },
        )

        # Get the current max version
        max_version = db.session.query(db.func.max(Schedule.version)).scalar() or 0
        new_version = max_version + 1

        session_logger.info(
            f"Creating new schedule version: {new_version}",
            extra={
                "action": "new_version",
                "version": new_version,
                "previous_version": max_version,
            },
        )

        # Generate new schedules
        generator = ScheduleGenerator()
        result = generator.generate_schedule(
            start_date, end_date, create_empty_schedules, session_id=session_id
        )

        # Check if there was an error
        if "error" in result:
            session_logger.error(
                f"Schedule generation failed: {result['error']}",
                extra={
                    "action": "generation_error",
                    "error": result["error"],
                    "session_id": session_id,
                },
            )
            # Get the logs before returning error
            memory_handler.flush()
            logs = log_stream.getvalue()
            return jsonify({"error": result["error"], "logs": logs.splitlines()}), 500

        # Get the schedules from the result
        schedules_list = result.get("schedule", [])
        errors = []  # No errors in new format, but keep variable for compatibility

        session_logger.info(
            f"Generated {len(schedules_list)} schedules with {len(errors)} errors",
            extra={
                "action": "generation_result",
                "schedule_count": len(schedules_list),
                "error_count": len(errors),
                "has_errors": len(errors) > 0,
            },
        )

        # Create Schedule objects from the dictionaries
        schedule_objects = []
        for schedule_dict in schedules_list:
            # Create a new Schedule object, including empty schedules
            schedule = Schedule(
                date=datetime.strptime(schedule_dict["date"], "%Y-%m-%d").date()
                if schedule_dict.get("date")
                else None,
                employee_id=schedule_dict["employee_id"],
                shift_id=schedule_dict["shift_id"],
                version=new_version,
            )
            schedule_objects.append(schedule)

        # Save to database
        if schedule_objects:
            db.session.add_all(schedule_objects)
            db.session.commit()

            session_logger.info(
                f"Saved {len(schedule_objects)} schedules to database with version {new_version}",
                extra={
                    "action": "save_schedules",
                    "count": len(schedule_objects),
                    "version": new_version,
                },
            )

        # Get the logs
        memory_handler.flush()
        logs = log_stream.getvalue()

        # Return the result with logs
        result = {
            "schedules": [schedule.to_dict() for schedule in schedule_objects],
            "errors": errors,
            "total": len(schedule_objects),
            "version": new_version,
            "logs": logs.splitlines(),
        }

        session_logger.info(
            "Schedule generation completed successfully",
            extra={
                "action": "generation_complete",
                "schedule_count": len(schedule_objects),
                "error_count": len(errors),
                "version": new_version,
            },
        )

        return jsonify(result)

    except ValueError as e:
        error_msg = f"Invalid date format: {str(e)}"
        session_logger.error(
            error_msg,
            extra={
                "action": "generation_error",
                "error_type": "value_error",
                "error": str(e),
            },
        )
        # Get the logs before returning error
        memory_handler.flush()
        logs = log_stream.getvalue()
        return jsonify(
            {"error": error_msg, "logs": logs.splitlines()}
        ), HTTPStatus.BAD_REQUEST

    except Exception as e:
        import traceback

        tb = traceback.format_exc()

        error_msg = f"Schedule generation failed: {str(e)}"
        session_logger.error(
            error_msg,
            extra={
                "action": "generation_error",
                "error_type": "exception",
                "error": str(e),
                "traceback": tb,
            },
        )
        # Get the logs before returning error
        memory_handler.flush()
        logs = log_stream.getvalue()
        return jsonify(
            {"error": error_msg, "logs": logs.splitlines()}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/pdf", methods=["GET"])
def get_schedule_pdf():
    """Get schedule as PDF"""
    try:
        start_date = datetime.strptime(request.args.get("start_date"), "%Y-%m-%d")
        end_date = datetime.strptime(request.args.get("end_date"), "%Y-%m-%d")

        # Get schedules for the date range
        schedules = Schedule.query.filter(
            Schedule.date >= start_date.date(), Schedule.date <= end_date.date()
        ).all()

        # Generate PDF
        generator = PDFGenerator()
        pdf_buffer = generator.generate_schedule_pdf(schedules, start_date, end_date)

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"schedule_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf",
        )

    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/<int:schedule_id>", methods=["GET"])
@schedules.route("/schedules/<int:schedule_id>/", methods=["GET"])
def get_schedule(schedule_id):
    """Get a specific schedule"""
    schedule = Schedule.query.get_or_404(schedule_id)
    return jsonify(schedule.to_dict())


@schedules.route("/schedules/<int:schedule_id>", methods=["PUT"])
@schedules.route("/schedules/<int:schedule_id>/", methods=["PUT"])
def update_schedule(schedule_id):
    """Update a schedule (for drag and drop functionality)"""
    try:
        data = request.get_json()

        # If schedule_id is 0, create a new schedule
        if schedule_id == 0:
            schedule = Schedule(
                employee_id=data["employee_id"],
                shift_id=data.get("shift_id"),  # Use get() to handle None/undefined
                date=datetime.strptime(data["date"], "%Y-%m-%d").date(),
                version=1,  # New schedules start at version 1
            )
            db.session.add(schedule)
        else:
            schedule = Schedule.query.get_or_404(schedule_id)
            # Update existing schedule
            if "employee_id" in data:
                schedule.employee_id = data["employee_id"]
            if "shift_id" in data:
                # Explicitly handle None/undefined case
                schedule.shift_id = (
                    data["shift_id"] if data["shift_id"] is not None else None
                )
            if "date" in data:
                schedule.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
            if "break_start" in data:
                schedule.break_start = data["break_start"]
            if "break_end" in data:
                schedule.break_end = data["break_end"]
            if "notes" in data:
                schedule.notes = data["notes"]

        db.session.commit()
        return jsonify(schedule.to_dict())

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error updating schedule: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/<int:schedule_id>", methods=["DELETE"])
@schedules.route("/schedules/<int:schedule_id>/", methods=["DELETE"])
def delete_schedule(schedule_id):
    """Delete a schedule"""
    schedule = Schedule.query.get_or_404(schedule_id)

    try:
        db.session.delete(schedule)
        db.session.commit()
        return "", HTTPStatus.NO_CONTENT

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/export", methods=["POST"])
@schedules.route("/schedules/export/", methods=["POST"])
def export_schedule():
    """Export schedule as PDF"""
    try:
        data = request.get_json()
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d")
        end_date = datetime.strptime(data["end_date"], "%Y-%m-%d")

        # Extract layout_config if provided
        layout_config = data.get("layout_config")

        # Get schedules for the date range
        schedules = Schedule.query.filter(
            Schedule.date >= start_date.date(), Schedule.date <= end_date.date()
        ).all()

        # Generate PDF
        generator = PDFGenerator()
        try:
            pdf_buffer = generator.generate_schedule_pdf(
                schedules, start_date, end_date, layout_config
            )

            return send_file(
                pdf_buffer,
                mimetype="application/pdf",
                as_attachment=True,
                download_name=f"schedule_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf",
            )
        except Exception as e:
            import traceback

            error_msg = f"PDF generation error: {str(e)}"
            logger.error_logger.error(
                error_msg,
                extra={
                    "action": "pdf_generation_error",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                },
            )
            return jsonify({"error": error_msg}), HTTPStatus.INTERNAL_SERVER_ERROR

    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        import traceback

        error_msg = f"Unexpected error: {str(e)}"
        logger.error_logger.error(
            error_msg,
            extra={
                "action": "export_schedule_error",
                "error": str(e),
                "traceback": traceback.format_exc(),
            },
        )
        return jsonify({"error": error_msg}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/<int:version>/publish", methods=["POST"])
def publish_schedule(version):
    try:
        schedules = Schedule.query.filter_by(version=version).all()
        if not schedules:
            return jsonify({"error": "Schedule version not found"}), 404

        for schedule in schedules:
            schedule.status = "published"

        db.session.commit()
        return jsonify({"message": "Schedule published successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@schedules.route("/schedules/<int:version>/archive", methods=["POST"])
def archive_schedule(version):
    try:
        schedules = Schedule.query.filter_by(version=version).all()
        if not schedules:
            return jsonify({"error": "Schedule version not found"}), 404

        for schedule in schedules:
            schedule.status = "archived"

        db.session.commit()
        return jsonify({"message": "Schedule archived successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@schedules.route("/schedules/generate", methods=["POST"])
def api_generate_schedule():
    """Generate a new schedule using the ScheduleGenerator class"""
    try:
        # Parse dates from request
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Get date range
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")
        session_id = data.get(
            "session_id", "web_" + datetime.now().strftime("%Y%m%d%H%M%S")
        )
        version = data.get("version", 1)

        if not start_date_str:
            # Default to next week
            today = date.today()
            next_monday = today + timedelta(days=(7 - today.weekday()))
            start_date = next_monday
        else:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()

        if not end_date_str:
            # Default to one week
            end_date = start_date + timedelta(days=6)
        else:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

        # Validate date range
        if start_date > end_date:
            return jsonify({"error": "Start date must be before end date"}), 400

        # Create generator
        generator = ScheduleGenerator()

        # Generate schedule
        result = generator.generate(start_date, end_date, version, session_id)

        # Return result
        if "error" in result:
            return jsonify({"error": result["error"]}), 500

        return jsonify(result), 200

    except ScheduleGenerationError as e:
        return jsonify({"error": f"Failed to generate schedule: {str(e)}"}), 500
    except ScheduleResourceError as e:
        return jsonify({"error": f"Resource error: {str(e)}"}), 400
    except Exception as e:
        current_app.logger.error(f"Error generating schedule: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@schedules.route("/schedules/validate", methods=["POST"])
def validate_schedule():
    """Validate an existing schedule"""
    try:
        # Parse data from request
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Get schedule IDs
        schedule_ids = data.get("schedule_ids", [])
        if not schedule_ids:
            return jsonify({"error": "No schedule IDs provided"}), 400

        # Get schedules from database
        schedules = Schedule.query.filter(Schedule.id.in_(schedule_ids)).all()
        if not schedules:
            return jsonify({"error": "No schedules found"}), 404

        # Create resources and validator
        resources = ScheduleResources()
        resources.load()
        validator = ScheduleValidator(resources)

        # Create config from request
        config = ScheduleConfig(
            enforce_min_coverage=data.get("enforce_min_coverage", True),
            enforce_contracted_hours=data.get("enforce_contracted_hours", True),
            enforce_keyholder=data.get("enforce_keyholder", True),
            enforce_rest_periods=data.get("enforce_rest_periods", True),
            enforce_max_shifts=data.get("enforce_max_shifts", True),
            enforce_max_hours=data.get("enforce_max_hours", True),
            min_rest_hours=data.get("min_rest_hours", 11),
        )

        # Validate schedule
        validation_errors = validator.validate(schedules, config)

        # Convert errors to JSON format
        errors = []
        for error in validation_errors:
            errors.append(
                {
                    "type": error.error_type,
                    "message": error.message,
                    "severity": error.severity,
                    "details": error.details or {},
                }
            )

        # Return validation report
        return jsonify(
            {
                "valid": len(errors) == 0,
                "errors": errors,
                "schedule_count": len(schedules),
                "validation_time": datetime.now().isoformat(),
            }
        ), 200

    except ScheduleResourceError as e:
        return jsonify({"error": f"Resource error: {str(e)}"}), 400
    except Exception as e:
        current_app.logger.error(f"Error validating schedule: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@schedules.route("/schedules/versions", methods=["GET"])
def get_schedule_versions():
    """Get all available schedule versions"""
    try:
        # Get unique versions
        versions = (
            db.session.query(
                Schedule.version,
                db.func.min(Schedule.date).label("start_date"),
                db.func.max(Schedule.date).label("end_date"),
                db.func.max(Schedule.updated_at).label("updated_at"),
                db.func.count(Schedule.id).label("entry_count"),
            )
            .group_by(Schedule.version)
            .order_by(desc(Schedule.version))
            .all()
        )

        # Format response
        result = []
        for version, start_date, end_date, updated_at, entry_count in versions:
            result.append(
                {
                    "version": version,
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None,
                    "entry_count": entry_count,
                    "updated_at": updated_at.isoformat() if updated_at else None,
                }
            )

        return jsonify(result), 200

    except Exception as e:
        current_app.logger.error(f"Error getting schedule versions: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@schedules.route("/schedules/status/<int:version>", methods=["PUT"])
def update_schedule_status(version):
    """Update the status of a schedule version"""
    try:
        # Parse data from request
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Get new status
        status_str = data.get("status")
        if not status_str:
            return jsonify({"error": "No status provided"}), 400

        # Validate status
        try:
            status = ScheduleStatus(status_str)
        except ValueError:
            return jsonify({"error": f"Invalid status: {status_str}"}), 400

        # Update schedules
        affected_rows = Schedule.query.filter_by(version=version).update(
            {"status": status}
        )

        if affected_rows == 0:
            return jsonify({"error": f"No schedules found with version {version}"}), 404

        # Commit changes
        db.session.commit()

        return jsonify(
            {
                "version": version,
                "status": status.value,
                "affected_rows": affected_rows,
                "updated_at": datetime.now().isoformat(),
            }
        ), 200

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating schedule status: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500
