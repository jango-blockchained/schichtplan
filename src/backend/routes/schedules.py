from flask import Blueprint, jsonify, request, send_file
from datetime import datetime
from models import db, Schedule, ShiftTemplate
from services.schedule_generator import ScheduleGenerator
from services.pdf_generator import PDFGenerator
from http import HTTPStatus
from utils.logger import logger
import uuid

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

        if not start_date or not end_date:
            return jsonify(
                {"error": "start_date and end_date are required"}
            ), HTTPStatus.BAD_REQUEST

        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

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

        # Get the create_empty_schedules parameter, default to False
        create_empty_schedules = data.get("create_empty_schedules", False)

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
            # Skip empty schedules
            if schedule_dict.get("is_empty", False):
                continue

            # Create a new Schedule object
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
        schedule = Schedule.query.get_or_404(schedule_id)
        data = request.get_json()

        if "employee_id" in data:
            schedule.employee_id = data["employee_id"]
        if "shift_id" in data:
            schedule.shift_id = data["shift_id"]
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
