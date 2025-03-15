from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, current_app, send_file
from models import db, Schedule, ShiftTemplate, Employee
from models.schedule import ScheduleStatus, ScheduleVersionMeta
from sqlalchemy import desc, text
from services.pdf_generator import PDFGenerator
from http import HTTPStatus
from utils.logger import logger
from services.scheduler.generator import ScheduleGenerator, ScheduleGenerationError
from services.scheduler.resources import ScheduleResources, ScheduleResourceError
from services.scheduler.validator import ScheduleValidator, ScheduleConfig
from models.fixed_shift import ShiftTemplate

# Define blueprint
schedules = Blueprint("schedules", __name__)


def get_or_create_initial_version(start_date, end_date):
    """Helper function to get or create the initial version metadata"""
    try:
        # Check if any version exists first
        existing_version = ScheduleVersionMeta.query.first()
        if existing_version:
            return existing_version

        # Create initial version metadata within a transaction
        version_meta = ScheduleVersionMeta(
            version=1,
            created_at=datetime.utcnow(),
            status=ScheduleStatus.DRAFT,
            date_range_start=start_date,
            date_range_end=end_date,
            notes="Initial version",
        )
        db.session.add(version_meta)
        db.session.commit()
        return version_meta
    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error in get_or_create_initial_version: {str(e)}")
        return None


def get_versions_for_date_range(start_date, end_date):
    """Helper function to get all versions available for a specific date range"""
    try:
        logger.schedule_logger.info(
            f"Getting versions for date range: {start_date} to {end_date}"
        )

        # Try to get versions from version_meta first
        versions = (
            ScheduleVersionMeta.query.filter(
                ScheduleVersionMeta.date_range_start <= end_date,
                ScheduleVersionMeta.date_range_end >= start_date,
            )
            .order_by(ScheduleVersionMeta.version.desc())
            .all()
        )

        if versions:
            logger.schedule_logger.info(
                f"Found {len(versions)} versions in version_meta"
            )
            return versions

        # Fallback: Get versions from schedules
        logger.schedule_logger.info(
            "No versions found in version_meta, falling back to schedules table"
        )
        version_numbers = (
            db.session.query(Schedule.version)
            .filter(Schedule.date >= start_date, Schedule.date <= end_date)
            .distinct()
            .order_by(desc(Schedule.version))
            .all()
        )

        if not version_numbers:
            logger.schedule_logger.info("No versions found in schedules table")
            return []

        logger.schedule_logger.info(
            f"Found {len(version_numbers)} versions in schedules table"
        )

        # Create metadata entries for these versions if they don't exist
        result = []
        for (version,) in version_numbers:
            try:
                # Check if metadata exists
                meta = ScheduleVersionMeta.query.get(version)
                if not meta:
                    logger.schedule_logger.info(
                        f"Creating metadata for version {version}"
                    )
                    # Get date range for this version
                    dates = (
                        db.session.query(
                            db.func.min(Schedule.date), db.func.max(Schedule.date)
                        )
                        .filter(Schedule.version == version)
                        .first()
                    )
                    if dates:
                        meta = ScheduleVersionMeta(
                            version=version,
                            created_at=datetime.utcnow(),
                            status=ScheduleStatus.DRAFT,
                            date_range_start=dates[0],
                            date_range_end=dates[1],
                            notes=f"Auto-generated metadata for version {version}",
                        )
                        db.session.add(meta)
                        try:
                            db.session.commit()
                            logger.schedule_logger.info(
                                f"Created metadata for version {version}"
                            )
                        except Exception as e:
                            db.session.rollback()
                            logger.error_logger.error(
                                f"Failed to create metadata for version {version}: {str(e)}"
                            )
                if meta:
                    result.append(meta)
            except Exception as e:
                logger.error_logger.error(
                    f"Error processing version {version}: {str(e)}"
                )
                continue

        if not result:
            logger.schedule_logger.warning("No version metadata could be created")
        else:
            logger.schedule_logger.info(
                f"Successfully processed {len(result)} versions"
            )

        return result

    except Exception as e:
        logger.error_logger.error(f"Error in get_versions_for_date_range: {str(e)}")
        raise  # Re-raise the exception to be handled by the route handler


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

        # Get all versions for this date range
        available_versions = get_versions_for_date_range(start_date, end_date)

        # If no version specified, use the latest available version
        if version is None:
            version = available_versions[0].version if available_versions else 1
            logger.schedule_logger.info(
                f"Using latest version for date range: {version}"
            )

        # Build query for schedules
        query = Schedule.query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date,
            Schedule.version == version,
        )

        # Get all schedules
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

        # Get version metadata for the current version
        version_meta = next(
            (v for v in available_versions if v.version == version), None
        )

        # If this is a new week with no versions, create initial version
        if not available_versions:
            version = 1
            version_meta = get_or_create_initial_version(start_date, end_date)

        # Prepare version information
        version_numbers = [v.version for v in available_versions] or [1]
        version_statuses = {v.version: v.status.value for v in available_versions} or {
            1: "DRAFT"
        }

        return jsonify(
            {
                "schedules": [schedule.to_dict() for schedule in schedules],
                "versions": version_numbers,
                "version_statuses": version_statuses,
                "current_version": version,
                "version_meta": version_meta.to_dict() if version_meta else None,
                "total_schedules": len(all_schedules),
                "filtered_schedules": len(schedules),
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "week": start_date.isocalendar()[1],  # Add week number
                },
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
    """Generate a new schedule for the given date range"""
    try:
        data = request.get_json()
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        create_empty_schedules = data.get("create_empty_schedules", True)

        # Initialize logs list
        logs = []

        # Validate input dates
        if not start_date or not end_date:
            error_msg = "Missing required parameters: start_date and end_date"
            logger.error_logger.error(error_msg)
            return jsonify({"error": error_msg}), 400

        # Convert string dates to date objects
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError as e:
            error_msg = f"Invalid date format: {str(e)}"
            logger.error_logger.error(error_msg)
            return jsonify({"error": error_msg}), 400

        # Check if end date is after start date
        if end_date < start_date:
            error_msg = "End date must be after start date"
            logger.error_logger.error(error_msg)
            return jsonify({"error": error_msg}), 400

        # Get all shifts and validate their durations
        shifts = ShiftTemplate.query.all()
        invalid_shifts = []

        # First pass: Check all shifts for invalid durations
        for shift in shifts:
            try:
                # Always recalculate duration to ensure it's up to date
                shift._calculate_duration()
                if shift.duration_hours is None or shift.duration_hours <= 0:
                    logger.error_logger.error(
                        f"Invalid duration for shift {shift.id}: {shift.duration_hours}h"
                    )
                    invalid_shifts.append(shift)
                else:
                    logger.schedule_logger.debug(
                        f"Validated shift {shift.id}: {shift.duration_hours}h ({shift.start_time}-{shift.end_time})"
                    )
            except Exception as e:
                logger.error_logger.error(
                    f"Error validating shift {shift.id}: {str(e)}"
                )
                invalid_shifts.append(shift)

        # If we found invalid shifts, try to fix them
        if invalid_shifts:
            logger.schedule_logger.warning(
                f"Found {len(invalid_shifts)} shifts with invalid duration_hours, fixing them"
            )
            logs.append(
                f"Found {len(invalid_shifts)} shifts with invalid duration_hours, fixing them"
            )

            # Fix each invalid shift
            fixed_shifts = []
            for shift in invalid_shifts:
                try:
                    shift._calculate_duration()
                    shift.validate()
                    fixed_shifts.append(shift)
                    logger.schedule_logger.info(
                        f"Fixed shift {shift.id}: {shift.start_time}-{shift.end_time}, duration: {shift.duration_hours}h"
                    )
                    logs.append(
                        f"Fixed shift {shift.id}: {shift.start_time}-{shift.end_time}, duration: {shift.duration_hours}h"
                    )
                except Exception as e:
                    logger.error_logger.error(
                        f"Could not fix shift {shift.id}: {str(e)}"
                    )
                    logs.append(f"Could not fix shift {shift.id}: {str(e)}")

            # Commit the changes for fixed shifts
            if fixed_shifts:
                try:
                    db.session.commit()
                    logger.schedule_logger.info(
                        f"Fixed {len(fixed_shifts)} shifts with invalid duration_hours"
                    )
                    logs.append(
                        f"Fixed {len(fixed_shifts)} shifts with invalid duration_hours"
                    )
                except Exception as e:
                    db.session.rollback()
                    error_msg = f"Error saving fixed shifts: {str(e)}"
                    logger.error_logger.error(error_msg)
                    logs.append(error_msg)
                    return jsonify({"error": error_msg, "logs": logs}), 500

            # Check if we still have any invalid shifts
            remaining_invalid = [
                s for s in shifts if s.duration_hours is None or s.duration_hours <= 0
            ]
            if remaining_invalid:
                error_msg = f"Still have {len(remaining_invalid)} shifts with invalid durations after fixing attempt"
                logger.error_logger.error(error_msg)
                logs.append(error_msg)
                return jsonify({"error": error_msg, "logs": logs}), 500

        # Create a new schedule version
        logger.schedule_logger.info("Creating new schedule version 1")
        logs.append("Creating new schedule version 1")

        # Initialize the schedule generator
        generator = ScheduleGenerator()

        # Generate the schedule
        result = generator.generate_schedule(
            start_date=start_date,
            end_date=end_date,
            create_empty_schedules=create_empty_schedules,
        )

        # Add logs to the result
        if "logs" not in result:
            result["logs"] = []
        result["logs"].extend(logs)

        return jsonify(result), 200

    except Exception as e:
        error_msg = f"Failed to generate schedule: {str(e)}"
        logger.error_logger.error(error_msg)
        logs.append("Schedule generation failed: " + error_msg)
        return jsonify({"error": error_msg, "logs": logs}), 500


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
            # Get the version from the data or default to 1
            version = data.get("version", 1)
            logger.schedule_logger.info(
                f"Creating new schedule: {data} with version {version}"
            )

            schedule = Schedule(
                employee_id=data["employee_id"],
                shift_id=data.get("shift_id"),  # Use get() to handle None/undefined
                date=datetime.strptime(data["date"], "%Y-%m-%d").date(),
                version=version,  # Use the provided version or default to 1
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
            logger.schedule_logger.info(
                f"Updating existing schedule: {schedule_id}, current version: {schedule.version}"
            )
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
            if "version" in data:
                schedule.version = data["version"]
                logger.schedule_logger.info(
                    f"Updated schedule version to {schedule.version}"
                )
            if "shift_type" in data:
                schedule.shift_type = (
                    data["shift_type"] if data["shift_type"] is not None else None
                )
                logger.schedule_logger.info(
                    f"Updated schedule shift_type to {schedule.shift_type}"
                )

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

        logger.schedule_logger.info(f"Generating schedule for version {version}")

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

        # Set create_empty_schedules flag
        create_empty_schedules = data.get("create_empty_schedules", True)
        generator.create_empty_schedules = create_empty_schedules

        logger.schedule_logger.info(
            f"Generating schedule for date range {start_date} to {end_date}, version {version}, create_empty_schedules={create_empty_schedules}"
        )

        # Generate schedule
        result = generator.generate(start_date, end_date, version, session_id)

        logger.schedule_logger.info(
            f"Schedule generation completed for version {version}, entries: {len(result.get('schedules', []))}"
        )

        # Return result
        if "error" in result:
            logger.error_logger.error(f"Error generating schedule: {result['error']}")
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
        # Get date range from query parameters
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        # If no date range provided, use current week
        if not start_date or not end_date:
            today = date.today()
            start_of_week = today - timedelta(days=today.weekday())
            end_of_week = start_of_week + timedelta(days=6)
        else:
            try:
                start_of_week = datetime.strptime(start_date, "%Y-%m-%d").date()
                end_of_week = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                return jsonify(
                    {"error": "Invalid date format, expected YYYY-MM-DD"}
                ), HTTPStatus.BAD_REQUEST

        # Get versions for the specified date range
        available_versions = get_versions_for_date_range(start_of_week, end_of_week)

        # If no versions exist for this week, create initial version
        if not available_versions:
            version_meta = get_or_create_initial_version(start_of_week, end_of_week)
            if version_meta:
                available_versions = [version_meta]

        # Return version information
        return jsonify(
            {
                "versions": [v.to_dict() for v in available_versions],
                "date_range": {
                    "start": start_of_week.isoformat(),
                    "end": end_of_week.isoformat(),
                    "week": start_of_week.isocalendar()[1],
                },
            }
        )

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
        create_empty = data.get("create_empty_schedules", True)  # Default to True

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

        # Get the current max version from both tables
        max_schedule_version = (
            db.session.query(db.func.max(Schedule.version)).scalar() or 0
        )
        max_meta_version = (
            db.session.query(db.func.max(ScheduleVersionMeta.version)).scalar() or 0
        )
        new_version = max(max_schedule_version, max_meta_version) + 1

        logger.schedule_logger.info(
            f"Creating new schedule version {new_version} (max schedule version: {max_schedule_version}, max meta version: {max_meta_version})"
            + (f" based on version {base_version}" if base_version else "")
        )

        new_schedules = []

        # Create a copy of the base version if provided
        if base_version is not None:
            # Copy schedules from base_version to new_version
            base_schedules = Schedule.query.filter(
                Schedule.version == base_version,
                Schedule.date >= start_date,
                Schedule.date <= end_date,
            ).all()

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
                logger.schedule_logger.info(
                    f"Copied {len(new_schedules)} schedules from version {base_version}"
                )
            else:
                logger.schedule_logger.info(
                    f"No schedules found in version {base_version} for the given date range"
                )

        # Always create empty schedules for each employee if we have none from copying
        # or if explicitly requested
        if not new_schedules or create_empty:
            # Get all active employees
            employees = Employee.query.filter_by(is_active=True).all()

            # Create date range
            date_range = []
            current_date = start_date
            while current_date <= end_date:
                date_range.append(current_date)
                current_date += timedelta(days=1)

            # Create empty schedules for each employee for each day
            for employee in employees:
                for day in date_range:
                    # Skip if we already have a schedule for this employee on this day
                    if any(
                        s.employee_id == employee.id and s.date == day
                        for s in new_schedules
                    ):
                        continue

                    new_schedule = Schedule(
                        employee_id=employee.id,
                        shift_id=None,  # Empty shift
                        date=day,
                        version=new_version,
                        status=ScheduleStatus.DRAFT,
                    )
                    new_schedules.append(new_schedule)

            logger.schedule_logger.info(
                f"Created {len(new_schedules)} empty schedules for version {new_version}"
            )

        # Add all schedules to the session
        if new_schedules:
            db.session.add_all(new_schedules)

        # Check if version_meta table exists by running a test query
        try:
            test_query = db.session.execute(
                text("SELECT 1 FROM schedule_version_meta LIMIT 1")
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
                notes=notes
                or (
                    f"Created from version {base_version}"
                    if base_version
                    else "New version"
                ),
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

        try:
            # Start a transaction
            db.session.begin_nested()

            # Update status for all schedules in this version
            for schedule in schedules:
                schedule.status = new_status

            # Update or create version metadata
            version_meta = ScheduleVersionMeta.query.filter_by(version=version).first()
            if version_meta:
                version_meta.status = new_status
                version_meta.updated_at = datetime.utcnow()
            else:
                # Create new version metadata if it doesn't exist
                dates = sorted(list(set(s.date for s in schedules)))
                start_date = min(dates) if dates else None
                end_date = max(dates) if dates else None

                version_meta = ScheduleVersionMeta(
                    version=version,
                    created_at=datetime.utcnow(),
                    status=new_status,
                    date_range_start=start_date,
                    date_range_end=end_date,
                    notes=f"Version {version} - {new_status.value}",
                )
                db.session.add(version_meta)

            # Commit the transaction
            db.session.commit()

            return jsonify(
                {
                    "message": f"Version {version} status updated to {new_status.value}",
                    "version": version,
                    "status": new_status.value,
                }
            )

        except Exception as e:
            db.session.rollback()
            logger.error_logger.error(f"Error updating version status: {str(e)}")
            return jsonify(
                {"error": f"Database error: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        logger.error_logger.error(f"Error in update_version_status: {str(e)}")
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
