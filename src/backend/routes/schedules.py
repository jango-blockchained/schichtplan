from flask import Blueprint, jsonify, request, send_file
from datetime import datetime
from models import db, Schedule, ShiftTemplate
from services.schedule_generator import ScheduleGenerator
from services.pdf_generator import PDFGenerator
from http import HTTPStatus
from utils.logger import logger

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
    logger.schedule_logger.debug("Schedule generation request received")
    try:
        data = request.get_json()
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()

        # Get the create_empty_schedules parameter, default to False
        create_empty_schedules = data.get("create_empty_schedules", False)

        logger.schedule_logger.debug(
            f"Generating schedule for period: {start_date} to {end_date}",
            extra={
                "action": "generate_schedule",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "create_empty_schedules": create_empty_schedules,
            },
        )

        # Get the latest version for this date range
        latest_version = Schedule.get_latest_version(start_date, end_date)
        next_version = latest_version + 1
        logger.schedule_logger.debug(
            f"Creating schedule version {next_version}", extra={"version": next_version}
        )

        generator = ScheduleGenerator()
        logger.schedule_logger.debug("Starting schedule generation")
        schedules, errors = generator.generate_schedule(
            start_date, end_date, create_empty_schedules=create_empty_schedules
        )

        # Set version for all new schedules
        logger.schedule_logger.debug(
            f"Setting version {next_version} for {len(schedules)} schedules",
            extra={"version": next_version, "schedule_count": len(schedules)},
        )
        for schedule in schedules:
            schedule.version = next_version
            db.session.add(schedule)

        db.session.commit()
        logger.schedule_logger.info(
            f"Schedule generation completed successfully. Created {len(schedules)} schedules",
            extra={
                "action": "generation_complete",
                "schedule_count": len(schedules),
                "version": next_version,
            },
        )

        if errors:
            logger.schedule_logger.warning(
                f"Schedule generated with {len(errors)} warnings/errors",
                extra={"action": "generation_warnings", "error_count": len(errors)},
            )
            for error in errors:
                if error["type"] == "critical":
                    logger.error_logger.error(
                        f"Critical error: {error['message']}",
                        extra={"action": "critical_error", "error": error},
                    )
                elif error["type"] == "warning":
                    logger.schedule_logger.warning(
                        f"Warning for {error.get('date', 'unknown date')}: {error['message']}",
                        extra={"action": "warning", "error": error},
                    )
                else:
                    logger.schedule_logger.info(
                        f"Note for {error.get('date', 'unknown date')}: {error['message']}",
                        extra={"action": "note", "error": error},
                    )

        # Get the placeholder shift used for empty schedules
        placeholder_shift = ShiftTemplate.query.filter_by(
            start_time="00:00", end_time="00:00"
        ).first()

        # Count only schedules with actual shifts (not placeholder)
        filled_shifts = (
            [s for s in schedules if s.shift_id != placeholder_shift.id]
            if placeholder_shift
            else []
        )

        return jsonify(
            {
                "schedules": [schedule.to_dict() for schedule in schedules],
                "errors": errors,
                "version": next_version,
                "total_shifts": len(filled_shifts),
                "total_schedules": len(schedules),  # Total including empty schedules
                "filled_shifts_count": len(filled_shifts),  # For clarity
            }
        ), HTTPStatus.CREATED

    except KeyError as e:
        error_msg = f"Missing required field: {str(e)}"
        logger.error_logger.error(
            error_msg, extra={"action": "validation_error", "error": str(e)}
        )
        return jsonify({"error": error_msg}), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        error_msg = str(e)
        logger.error_logger.error(
            f"Value error during schedule generation: {error_msg}",
            extra={"action": "value_error", "error": str(e)},
        )
        return jsonify({"error": error_msg}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        error_msg = str(e)
        logger.error_logger.error(
            f"Unexpected error during schedule generation: {error_msg}",
            extra={"action": "unexpected_error", "error": str(e)},
        )
        return jsonify({"error": error_msg}), HTTPStatus.INTERNAL_SERVER_ERROR


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
