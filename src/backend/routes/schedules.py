from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, current_app, send_file
from models import db, Schedule, ShiftTemplate
from models.schedule import ScheduleStatus, ScheduleVersionMeta
from sqlalchemy import desc, and_
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

        # Check if version_meta table exists by running a test query
        use_version_meta = False
        try:
            test_query = db.session.execute(
                "SELECT 1 FROM schedule_version_meta LIMIT 1"
            )
            test_query.fetchall()
            use_version_meta = True
        except Exception as e:
            logger.error_logger.error(
                f"schedule_version_meta table doesn't exist: {str(e)}"
            )
            use_version_meta = False

        # Filter by version if specified
        if version is not None:
            query = query.filter(Schedule.version == version)
        else:
            # If no version specified, get the latest version for this date range
            if use_version_meta:
                try:
                    latest_version = (
                        ScheduleVersionMeta.query.filter(
                            and_(
                                ScheduleVersionMeta.date_range_start <= end_date,
                                ScheduleVersionMeta.date_range_end >= start_date,
                            )
                        )
                        .order_by(desc(ScheduleVersionMeta.version))
                        .first()
                    )

                    if latest_version:
                        version = latest_version.version
                        query = query.filter(Schedule.version == version)
                        logger.schedule_logger.info(
                            f"Using latest version from metadata: {version}"
                        )
                except Exception as e:
                    logger.error_logger.error(
                        f"Error getting version metadata: {str(e)}"
                    )
                    use_version_meta = False

            # Fallback to getting the latest version from schedules
            if not use_version_meta:
                latest_version_query = (
                    db.session.query(Schedule.version)
                    .filter(Schedule.date >= start_date, Schedule.date <= end_date)
                    .order_by(desc(Schedule.version))
                    .first()
                )

                if latest_version_query:
                    version = latest_version_query[0]
                    query = query.filter(Schedule.version == version)
                    logger.schedule_logger.info(
                        f"Using latest version from schedules: {version}"
                    )

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
        versions_query = (
            db.session.query(Schedule.version)
            .filter(Schedule.date >= start_date, Schedule.date <= end_date)
            .distinct()
            .order_by(Schedule.version.desc())
        )

        version_numbers = [v[0] for v in versions_query.all()]

        # Get status for each version
        version_statuses = {}
        for v in version_numbers:
            # Get the status of the first schedule in this version (they should all have the same status)
            status = Schedule.query.filter(Schedule.version == v).first()
            if status:
                version_statuses[v] = status.status.value

        # Get version metadata if available and if the table exists
        version_meta = None
        if version and use_version_meta:
            try:
                version_meta = ScheduleVersionMeta.query.get(version)
            except Exception as e:
                logger.error_logger.error(
                    f"Error getting version metadata for version {version}: {str(e)}"
                )
                version_meta = None

        return jsonify(
            {
                "schedules": [schedule.to_dict() for schedule in schedules],
                "versions": version_numbers,
                "version_statuses": version_statuses,
                "current_version": version,
                "version_meta": version_meta.to_dict() if version_meta else None,
                "total_schedules": len(all_schedules),
                "filtered_schedules": len(schedules),
            }
        )

    except ValueError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        logger.error_logger.error(f"Error in get_schedules: {str(e)}")
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

            # Create version metadata
            version_meta = ScheduleVersionMeta(
                version=new_version,
                created_at=datetime.utcnow(),
                status=ScheduleStatus.DRAFT,
                date_range_start=start_date,
                date_range_end=end_date,
                notes=f"Auto-generated schedule for {start_date.isoformat()} to {end_date.isoformat()}",
            )
            db.session.add(version_meta)

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
            "version_meta": version_meta.to_dict()
            if "version_meta" in locals()
            else None,
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

    except Exception as e:
        import traceback

        session_logger.error(
            f"Schedule generation failed: {str(e)}",
            extra={
                "action": "generation_error",
                "error": str(e),
                "traceback": traceback.format_exc(),
                "session_id": session_id,
            },
        )
        db.session.rollback()
        # Get the logs before returning error
        memory_handler.flush()
        logs = log_stream.getvalue()
        return jsonify({"error": str(e), "logs": logs.splitlines()}), 500


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
@schedules.route("/schedules/update/<int:schedule_id>", methods=["POST"])
def update_schedule(schedule_id):
    """Update a schedule (for drag and drop functionality)"""
    try:
        data = request.get_json()
        logger.schedule_logger.info(
            f"Update request for schedule_id={schedule_id}, data={data}"
        )

        # Handle date parsing - strip the T00:00:00 part if present
        if "date" in data and data["date"]:
            # If date contains T00:00:00, strip it to just get the date part
            if "T" in data["date"]:
                data["date"] = data["date"].split("T")[0]
            logger.schedule_logger.info(f"Parsed date: {data['date']}")

        # If schedule_id is 0, create a new schedule
        if schedule_id == 0:
            logger.schedule_logger.info(f"Creating new schedule: {data}")
            schedule = Schedule(
                employee_id=data["employee_id"],
                shift_id=data.get("shift_id"),  # Use get() to handle None/undefined
                date=datetime.strptime(data["date"], "%Y-%m-%d").date(),
                version=1,  # New schedules start at version 1
                notes=data.get("notes"),
            )

            # Handle break_duration by converting it to break_start and break_end
            if "break_duration" in data and data["break_duration"]:
                # If we have a shift, calculate break times based on shift times
                if schedule.shift_id:
                    shift = ShiftTemplate.query.get(schedule.shift_id)
                    if shift:
                        # Start break midway through the shift
                        shift_start = datetime.strptime(shift.start_time, "%H:%M")
                        shift_end = datetime.strptime(shift.end_time, "%H:%M")
                        shift_duration = (
                            shift_end - shift_start
                        ).total_seconds() / 60  # in minutes

                        # Calculate break start time (midway through the shift)
                        break_start_minutes = shift_duration / 2
                        break_start_time = shift_start + timedelta(
                            minutes=break_start_minutes
                        )

                        # Calculate break end time based on duration
                        break_end_time = break_start_time + timedelta(
                            minutes=data["break_duration"]
                        )

                        # Format times as strings
                        schedule.break_start = break_start_time.strftime("%H:%M")
                        schedule.break_end = break_end_time.strftime("%H:%M")

                        logger.schedule_logger.info(
                            f"Calculated break times: {schedule.break_start} to {schedule.break_end} from duration {data['break_duration']}"
                        )

            db.session.add(schedule)
        else:
            schedule = Schedule.query.get_or_404(schedule_id)
            logger.schedule_logger.info(f"Updating existing schedule: {schedule_id}")
            # Update existing schedule
            if "employee_id" in data:
                schedule.employee_id = data["employee_id"]
            if "shift_id" in data:
                # Explicitly handle None/undefined case
                logger.schedule_logger.info(
                    f"Updating shift_id: current={schedule.shift_id}, new={data['shift_id']}, type={type(data['shift_id'])}"
                )
                schedule.shift_id = (
                    data["shift_id"] if data["shift_id"] is not None else None
                )
                logger.schedule_logger.info(
                    f"After update, shift_id={schedule.shift_id}"
                )
            if "date" in data:
                schedule.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
            if "notes" in data:
                schedule.notes = data["notes"] if data["notes"] is not None else None

            # Handle break_duration by converting it to break_start and break_end
            if "break_duration" in data:
                if data["break_duration"]:
                    # If we have a shift, calculate break times based on shift times
                    if schedule.shift_id:
                        shift = ShiftTemplate.query.get(schedule.shift_id)
                        if shift:
                            # Start break midway through the shift
                            shift_start = datetime.strptime(shift.start_time, "%H:%M")
                            shift_end = datetime.strptime(shift.end_time, "%H:%M")
                            shift_duration = (
                                shift_end - shift_start
                            ).total_seconds() / 60  # in minutes

                            # Calculate break start time (midway through the shift)
                            break_start_minutes = shift_duration / 2
                            break_start_time = shift_start + timedelta(
                                minutes=break_start_minutes
                            )

                            # Calculate break end time based on duration
                            break_end_time = break_start_time + timedelta(
                                minutes=data["break_duration"]
                            )

                            # Format times as strings
                            schedule.break_start = break_start_time.strftime("%H:%M")
                            schedule.break_end = break_end_time.strftime("%H:%M")

                            logger.schedule_logger.info(
                                f"Calculated break times: {schedule.break_start} to {schedule.break_end} from duration {data['break_duration']}"
                            )
                else:
                    # If break_duration is null/0/false, clear break times
                    schedule.break_start = None
                    schedule.break_end = None

        db.session.commit()
        logger.schedule_logger.info(
            f"Database commit successful for schedule_id={schedule_id}"
        )

        # Add break_duration to the response
        response_data = schedule.to_dict()
        if schedule.break_start and schedule.break_end:
            try:
                break_start = datetime.strptime(schedule.break_start, "%H:%M")
                break_end = datetime.strptime(schedule.break_end, "%H:%M")
                # Calculate duration in minutes
                break_duration_minutes = int(
                    (break_end - break_start).total_seconds() / 60
                )
                response_data["break_duration"] = break_duration_minutes
            except Exception as e:
                logger.error_logger.error(f"Error calculating break duration: {str(e)}")
                response_data["break_duration"] = 0
        else:
            response_data["break_duration"] = 0

        logger.schedule_logger.info(f"Schedule updated successfully: {response_data}")
        return jsonify(response_data)

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
def get_all_versions():
    """Get all schedule versions with their metadata"""
    try:
        # Check if version_meta table exists
        has_version_meta = False
        try:
            test_query = db.session.execute(
                "SELECT 1 FROM schedule_version_meta LIMIT 1"
            )
            test_query.fetchall()
            has_version_meta = True
        except Exception as e:
            logger.error_logger.error(
                f"schedule_version_meta table doesn't exist: {str(e)}"
            )
            has_version_meta = False

        if has_version_meta:
            # Get metadata for all versions
            versions = ScheduleVersionMeta.query.order_by(
                ScheduleVersionMeta.version.desc()
            ).all()
            return jsonify({"versions": [v.to_dict() for v in versions]})
        else:
            # Fallback: Get basic version info from schedules
            versions_data = (
                db.session.query(
                    Schedule.version,
                    db.func.min(Schedule.date).label("start_date"),
                    db.func.max(Schedule.date).label("end_date"),
                    db.func.max(Schedule.status).label("status"),
                )
                .group_by(Schedule.version)
                .order_by(desc(Schedule.version))
                .all()
            )

            # Format results
            result = []
            for v in versions_data:
                version, start_date, end_date, status = v
                result.append(
                    {
                        "version": version,
                        "created_at": None,
                        "updated_at": None,
                        "status": status.value if status else "DRAFT",
                        "date_range": {
                            "start": start_date.strftime("%Y-%m-%d")
                            if start_date
                            else None,
                            "end": end_date.strftime("%Y-%m-%d") if end_date else None,
                        },
                        "notes": "Auto-generated metadata (no version_meta table)",
                    }
                )

            return jsonify({"versions": result})

    except Exception as e:
        logger.error_logger.error(f"Error fetching versions: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version", methods=["POST"])
def create_new_version():
    """Create a new schedule version, optionally based on an existing version."""
    try:
        data = request.get_json()
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        base_version = data.get("base_version")
        notes = data.get("notes", "")

        # Validate required parameters
        if not start_date or not end_date:
            return jsonify(
                {"error": "start_date and end_date are required"}
            ), HTTPStatus.BAD_REQUEST

        # Parse dates
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Get the current max version
        max_version = db.session.query(db.func.max(Schedule.version)).scalar() or 0
        new_version = max_version + 1

        logger.schedule_logger.info(
            f"Creating new schedule version {new_version}"
            + (f" based on version {base_version}" if base_version else "")
        )

        # Create a copy of the base version if provided
        if base_version is not None:
            # Copy schedules from base_version to new_version
            base_schedules = Schedule.query.filter(
                Schedule.version == base_version,
                Schedule.date >= start_date,
                Schedule.date <= end_date,
            ).all()

            new_schedules = []
            for schedule in base_schedules:
                new_schedule = Schedule(
                    employee_id=schedule.employee_id,
                    shift_id=schedule.shift_id,
                    date=schedule.date,
                    version=new_version,
                    break_start=schedule.break_start,
                    break_end=schedule.break_end,
                    notes=schedule.notes,
                )
                new_schedule.status = ScheduleStatus.DRAFT  # Always start as DRAFT
                new_schedules.append(new_schedule)

            if new_schedules:
                db.session.add_all(new_schedules)
                logger.schedule_logger.info(
                    f"Copied {len(new_schedules)} schedules from version {base_version}"
                )
            else:
                logger.schedule_logger.info(
                    f"No schedules found in version {base_version} for the given date range"
                )

        # Check if version_meta table exists by running a test query
        try:
            test_query = db.session.execute(
                "SELECT 1 FROM schedule_version_meta LIMIT 1"
            )
            test_query.fetchall()

            # Record version metadata
            version_meta = ScheduleVersionMeta(
                version=new_version,
                created_at=datetime.utcnow(),
                created_by=None,  # Could be set to user ID if authentication is implemented
                status=ScheduleStatus.DRAFT,
                date_range_start=start_date,
                date_range_end=end_date,
                base_version=base_version,
                notes=notes,
            )
            db.session.add(version_meta)
            logger.schedule_logger.info(
                f"Created version metadata for version {new_version}"
            )

            db.session.commit()

            return jsonify(
                {
                    "message": "New version created successfully",
                    "version": new_version,
                    "status": "DRAFT",
                    "version_meta": version_meta.to_dict(),
                }
            )
        except Exception as e:
            # If version_meta table doesn't exist, just commit the schedules
            logger.error_logger.error(f"Could not create version metadata: {str(e)}")
            db.session.commit()

            return jsonify(
                {
                    "message": "New version created successfully (without metadata)",
                    "version": new_version,
                    "status": "DRAFT",
                }
            )

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error creating new version: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version/<int:version>/status", methods=["PUT"])
def update_version_status(version):
    """Update a schedule's status (DRAFT, PUBLISHED, ARCHIVED)"""
    try:
        data = request.get_json()
        new_status_str = data.get("status")

        if not new_status_str:
            return jsonify({"error": "Status is required"}), HTTPStatus.BAD_REQUEST

        if new_status_str not in [s.value for s in ScheduleStatus]:
            return jsonify(
                {"error": f"Invalid status: {new_status_str}"}
            ), HTTPStatus.BAD_REQUEST

        # Get all schedules for this version
        schedules = Schedule.query.filter_by(version=version).all()

        if not schedules:
            return jsonify(
                {"error": "Schedule version not found"}
            ), HTTPStatus.NOT_FOUND

        # Check for valid state transitions
        current_status = schedules[0].status
        valid_transitions = {
            ScheduleStatus.DRAFT: [ScheduleStatus.PUBLISHED, ScheduleStatus.ARCHIVED],
            ScheduleStatus.PUBLISHED: [ScheduleStatus.ARCHIVED],
            ScheduleStatus.ARCHIVED: [],  # Cannot transition from archived
        }

        new_status = ScheduleStatus(new_status_str)
        if new_status not in valid_transitions[current_status]:
            return jsonify(
                {
                    "error": f"Invalid state transition from {current_status.value} to {new_status_str}"
                }
            ), HTTPStatus.BAD_REQUEST

        # Update status for all schedules in this version
        for schedule in schedules:
            schedule.status = new_status

        # Check if version_meta table exists
        has_version_meta = False
        try:
            test_query = db.session.execute(
                "SELECT 1 FROM schedule_version_meta LIMIT 1"
            )
            test_query.fetchall()
            has_version_meta = True
        except Exception as e:
            logger.error_logger.error(
                f"schedule_version_meta table doesn't exist: {str(e)}"
            )
            has_version_meta = False

        # Update version metadata if table exists
        if has_version_meta:
            try:
                version_meta = ScheduleVersionMeta.query.filter_by(
                    version=version
                ).first()
                if version_meta:
                    version_meta.status = new_status
                    version_meta.updated_at = datetime.utcnow()
                    version_meta.updated_by = (
                        None  # Could be set to user ID if authentication is implemented
                    )
                    logger.schedule_logger.info(
                        f"Updated version metadata for version {version}"
                    )
            except Exception as e:
                logger.error_logger.warning(
                    f"Could not update version metadata: {str(e)}"
                )
                # Continue anyway since we successfully updated the schedules

        db.session.commit()

        return jsonify(
            {
                "message": f"Schedule status updated to {new_status_str}",
                "version": version,
                "status": new_status_str,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error updating schedule status: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version/<int:version>/details", methods=["GET"])
def get_version_details(version):
    """Get detailed information about a specific schedule version."""
    try:
        # Check if version exists
        schedules = Schedule.query.filter_by(version=version).all()
        if not schedules:
            return jsonify(
                {"error": "Schedule version not found"}
            ), HTTPStatus.NOT_FOUND

        # Collect basic stats
        status = schedules[0].status.value
        dates = sorted(list(set(s.date for s in schedules)))
        employees = set(s.employee_id for s in schedules)

        # Try to get version metadata
        version_meta = None
        try:
            version_meta = ScheduleVersionMeta.query.filter_by(version=version).first()
        except Exception as e:
            logger.warning_logger.warning(f"Could not fetch version metadata: {str(e)}")

        # Build response
        response = {
            "version": version,
            "status": status,
            "schedule_count": len(schedules),
            "employees_count": len(employees),
            "days_count": len(dates),
        }

        # Add metadata if available
        if version_meta:
            response.update(
                {
                    "created_at": version_meta.created_at.isoformat()
                    if version_meta.created_at
                    else None,
                    "updated_at": version_meta.updated_at.isoformat()
                    if version_meta.updated_at
                    else None,
                    "date_range": {
                        "start": version_meta.date_range_start.isoformat()
                        if version_meta.date_range_start
                        else None,
                        "end": version_meta.date_range_end.isoformat()
                        if version_meta.date_range_end
                        else None,
                    },
                    "base_version": version_meta.base_version,
                    "notes": version_meta.notes,
                }
            )
        else:
            # Fallback if metadata is not available
            response.update(
                {
                    "date_range": {
                        "start": min(dates).isoformat() if dates else None,
                        "end": max(dates).isoformat() if dates else None,
                    }
                }
            )

        return jsonify(response)

    except Exception as e:
        logger.error_logger.error(f"Error getting version details: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version/duplicate", methods=["POST"])
def duplicate_version():
    """Create a duplicate of an existing schedule version with a new version number."""
    try:
        data = request.get_json()
        source_version = data.get("source_version")
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        notes = data.get("notes", f"Duplicated from version {source_version}")

        # Validate required parameters
        if not source_version:
            return jsonify(
                {"error": "source_version is required"}
            ), HTTPStatus.BAD_REQUEST

        if not start_date or not end_date:
            return jsonify(
                {"error": "start_date and end_date are required"}
            ), HTTPStatus.BAD_REQUEST

        # Parse dates
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Check if source version exists
        source_schedules = Schedule.query.filter_by(version=source_version).all()
        if not source_schedules:
            return jsonify(
                {"error": f"Source version {source_version} not found"}
            ), HTTPStatus.NOT_FOUND

        # Get the current max version
        max_version = db.session.query(db.func.max(Schedule.version)).scalar() or 0
        new_version = max_version + 1

        logger.schedule_logger.info(
            f"Duplicating schedule version {source_version} to new version {new_version}"
        )

        # Copy schedules from source version to new version, filtering by date range
        schedules_to_copy = Schedule.query.filter(
            Schedule.version == source_version,
            Schedule.date >= start_date,
            Schedule.date <= end_date,
        ).all()

        if not schedules_to_copy:
            return jsonify(
                {
                    "error": f"No schedules found in version {source_version} for the given date range"
                }
            ), HTTPStatus.BAD_REQUEST

        # Create duplicates with new version number
        new_schedules = []
        for schedule in schedules_to_copy:
            new_schedule = Schedule(
                employee_id=schedule.employee_id,
                shift_id=schedule.shift_id,
                date=schedule.date,
                version=new_version,
                break_start=schedule.break_start,
                break_end=schedule.break_end,
                notes=schedule.notes,
            )
            new_schedule.status = ScheduleStatus.DRAFT  # Always start as DRAFT
            new_schedules.append(new_schedule)

        db.session.add_all(new_schedules)

        # Create version metadata
        version_meta = None
        try:
            version_meta = ScheduleVersionMeta(
                version=new_version,
                created_at=datetime.utcnow(),
                status=ScheduleStatus.DRAFT,
                date_range_start=start_date,
                date_range_end=end_date,
                base_version=source_version,
                notes=notes,
            )
            db.session.add(version_meta)
        except Exception as e:
            logger.warning_logger.warning(
                f"Could not create version metadata: {str(e)}"
            )
            # Continue anyway, we'll create the version without metadata

        db.session.commit()

        response = {
            "message": f"Successfully duplicated version {source_version} to new version {new_version}",
            "version": new_version,
            "status": "DRAFT",
        }

        if version_meta:
            response["version_meta"] = version_meta.to_dict()

        return jsonify(response)

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error duplicating version: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/versions/compare", methods=["GET"])
def compare_versions():
    """Compare two schedule versions and identify differences."""
    try:
        base_version = request.args.get("base_version", type=int)
        compare_version = request.args.get("compare_version", type=int)

        if not base_version or not compare_version:
            return jsonify(
                {
                    "error": "base_version and compare_version are required query parameters"
                }
            ), HTTPStatus.BAD_REQUEST

        # Get schedules for both versions
        base_schedules = Schedule.query.filter_by(version=base_version).all()
        compare_schedules = Schedule.query.filter_by(version=compare_version).all()

        if not base_schedules:
            return jsonify(
                {"error": f"Base version {base_version} not found"}
            ), HTTPStatus.NOT_FOUND

        if not compare_schedules:
            return jsonify(
                {"error": f"Compare version {compare_version} not found"}
            ), HTTPStatus.NOT_FOUND

        # Create lookup dictionaries using employee_id and date as keys
        base_dict = {f"{s.employee_id}_{s.date.isoformat()}": s for s in base_schedules}
        compare_dict = {
            f"{s.employee_id}_{s.date.isoformat()}": s for s in compare_schedules
        }

        # Track differences
        added = []
        removed = []
        changed = []
        unchanged = []

        # Check schedules in base version
        for key, base_schedule in base_dict.items():
            if key in compare_dict:
                compare_schedule = compare_dict[key]
                if base_schedule.shift_id != compare_schedule.shift_id:
                    changed.append(
                        {
                            "employee_id": base_schedule.employee_id,
                            "date": base_schedule.date.isoformat(),
                            "base_shift_id": base_schedule.shift_id,
                            "compare_shift_id": compare_schedule.shift_id,
                            "type": "changed",
                        }
                    )
                else:
                    unchanged.append(
                        {
                            "employee_id": base_schedule.employee_id,
                            "date": base_schedule.date.isoformat(),
                            "base_shift_id": base_schedule.shift_id,
                            "compare_shift_id": compare_schedule.shift_id,
                            "type": "unchanged",
                        }
                    )
            else:
                removed.append(
                    {
                        "employee_id": base_schedule.employee_id,
                        "date": base_schedule.date.isoformat(),
                        "base_shift_id": base_schedule.shift_id,
                        "type": "removed",
                    }
                )

        # Check for schedules in compare version that aren't in base
        for key, compare_schedule in compare_dict.items():
            if key not in base_dict:
                added.append(
                    {
                        "employee_id": compare_schedule.employee_id,
                        "date": compare_schedule.date.isoformat(),
                        "compare_shift_id": compare_schedule.shift_id,
                        "type": "added",
                    }
                )

        # Combine all differences
        all_differences = added + removed + changed + unchanged

        return jsonify(
            {
                "base_version": base_version,
                "compare_version": compare_version,
                "differences": {
                    "added": len(added),
                    "removed": len(removed),
                    "changed": len(changed),
                    "unchanged": len(unchanged),
                    "details": all_differences,
                },
            }
        )

    except Exception as e:
        logger.error_logger.error(f"Error comparing versions: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version/<int:version>/notes", methods=["PUT"])
def update_version_notes(version):
    """Update the notes for a schedule version."""
    try:
        data = request.get_json()
        notes = data.get("notes")

        if notes is None:
            return jsonify({"error": "notes field is required"}), HTTPStatus.BAD_REQUEST

        # Check if version exists
        version_exists = Schedule.query.filter_by(version=version).first()
        if not version_exists:
            return jsonify(
                {"error": f"Version {version} not found"}
            ), HTTPStatus.NOT_FOUND

        # Try to update version metadata
        version_meta = None
        try:
            version_meta = ScheduleVersionMeta.query.filter_by(version=version).first()

            if not version_meta:
                # Create metadata if it doesn't exist
                schedules = Schedule.query.filter_by(version=version).all()
                if schedules:
                    dates = sorted(list(set(s.date for s in schedules)))
                    start_date = min(dates) if dates else None
                    end_date = max(dates) if dates else None
                    status = schedules[0].status

                    version_meta = ScheduleVersionMeta(
                        version=version,
                        created_at=datetime.utcnow(),
                        status=status,
                        date_range_start=start_date,
                        date_range_end=end_date,
                        notes=notes,
                    )
                    db.session.add(version_meta)
            else:
                # Update existing metadata
                version_meta.notes = notes
                version_meta.updated_at = datetime.utcnow()

            db.session.commit()

            return jsonify(
                {
                    "message": f"Notes updated for version {version}",
                    "version": version,
                    "notes": notes,
                }
            )

        except Exception as e:
            logger.error_logger.error(f"Error updating version notes: {str(e)}")
            return jsonify(
                {"error": f"Failed to update version notes: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error in update_version_notes: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR
