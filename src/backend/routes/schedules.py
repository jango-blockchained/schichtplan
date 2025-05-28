from flask import Blueprint, request, jsonify, current_app, send_file
from http import HTTPStatus
from datetime import datetime, date, timedelta
from sqlalchemy import desc, text, select
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError
# Import the standard logging library
import logging
from src.backend.models import db
from src.backend.models.schedule import Schedule, ScheduleStatus, ScheduleVersionMeta
from src.backend.models.employee import Employee, EmployeeAvailability, AvailabilityType
from src.backend.models.fixed_shift import ShiftTemplate, ShiftType
from src.backend.models.absence import Absence
from src.backend.models.coverage import Coverage
from src.backend.models.settings import Settings
from src.backend.services.pdf_generator import PDFGenerator
from src.backend.services.scheduler.resources import ScheduleResources, ScheduleResourceError
from src.backend.services.scheduler.generator import ScheduleGenerator
from src.backend.services.scheduler.config import SchedulerConfig
from src.backend.services.scheduler.validator import ScheduleValidator, ScheduleConfig
from src.backend.schemas.schedules import ScheduleUpdateRequest, ScheduleGenerateRequest
from src.backend.utils.logger import logger

# Define blueprint
schedules = Blueprint("schedules", __name__)

# Remove error_logger and schedule_logger variables since we're using logger directly

def get_or_create_initial_version(start_date, end_date):
    """Helper function to get or create the initial version metadata"""
    try:
        # Check if any version exists first
        existing_version = db.session.query(ScheduleVersionMeta).first()
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
        logger.error(f"Error in get_or_create_initial_version: {str(e)}", exc_info=True)
        return None


def get_versions_for_date_range(start_date, end_date):
    """Helper function to get all versions available for a specific date range"""
    try:
        logger.debug(
            f"Getting versions for date range: {start_date} to {end_date}"
        )

        # Try to get versions from version_meta first using the query pattern
        versions = (
            ScheduleVersionMeta.query.filter(
                ScheduleVersionMeta.date_range_start <= end_date,
                ScheduleVersionMeta.date_range_end >= start_date
            )
            .order_by(desc(ScheduleVersionMeta.version))
            .all()
        )

        if versions:
            logger.debug(
                f"Found {len(versions)} versions in version_meta"
            )
            return versions

        # Fallback: Get versions from schedules
        logger.debug(
            "No versions found in version_meta, falling back to schedules table"
        )
        
        # Use query.filter() and import desc() for sorting
        version_numbers = (
            db.session.query(Schedule.version)
            .filter(
                Schedule.date >= start_date,
                Schedule.date <= end_date
            )
            .distinct()
            .order_by(desc(Schedule.version))
            .all()
        )

        if not version_numbers:
            logger.debug("No versions found in schedules table")
            return []

        logger.debug(
            f"Found {len(version_numbers)} versions in schedules table"
        )

        # Create metadata entries for these versions if they don't exist
        result = []
        for (version,) in version_numbers:
            try:
                # Check if metadata exists
                meta = db.session.query(ScheduleVersionMeta).get(version)
                if not meta:
                    logger.debug(
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
                            logger.debug(
                                f"Created metadata for version {version}"
                            )
                        except Exception as e:
                            db.session.rollback()
                            logger.error(
                                f"Failed to create metadata for version {version}: {str(e)}"
                            )
                if meta:
                    result.append(meta)
            except Exception as e:
                logger.error(
                    f"Error processing version {version}: {str(e)}"
                )
                continue

        if not result:
            logger.warning("No version metadata could be created")
        else:
            logger.debug(
                f"Successfully processed {len(result)} versions"
            )

        return result

    except Exception as e:
        logger.error(f"Error in get_versions_for_date_range: {str(e)}", exc_info=True)
        return None  # Return None instead of re-raising to prevent cascading errors


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

            logger.info(
                f"Using default date range: {start_date} to {end_date}"
            )

        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"status": "error", "message": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Get all versions for this date range
        available_versions = get_versions_for_date_range(start_date, end_date)

        # If no version specified, use the latest available version
        if version is None:
            version = available_versions[0].version if available_versions else 1
            logger.info(
                f"Using latest version for date range: {version}"
            )

        # Build query for schedules with eager loading of shift relationships
        query = db.session.query(Schedule).options(
            db.joinedload(Schedule.shift)  # Ensure shift relationship is loaded
        )

        # Apply date filters
        query = query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date,
        )

        # Apply version filter if specified
        if version is not None:
            query = query.filter(Schedule.version == version)

        # Get all schedules
        all_schedules = query.all()

        # Get the placeholder shift (00:00 - 00:00)
        placeholder_shift = db.session.query(ShiftTemplate).filter_by(
            start_time="00:00", end_time="00:00"
        ).first()

        # Filter out empty schedules if requested
        if not include_empty and placeholder_shift:
            schedules = [s for s in all_schedules if s.shift_id != placeholder_shift.id]
        else:
            schedules = all_schedules

        # Create a lookup of all shifts for data enrichment
        all_shifts = db.session.query(ShiftTemplate).all()
        shift_lookup = {shift.id: shift for shift in all_shifts}
        
        # Enrich schedule data
        enriched_schedules = []
        for schedule in schedules:
            schedule_dict = schedule.to_dict()
            
            # If the schedule has a shift_id but missing relationship data, fix it
            if schedule.shift_id is not None and (not hasattr(schedule, 'shift') or schedule.shift is None):
                # Try to get the shift from our lookup
                if schedule.shift_id in shift_lookup:
                    shift = shift_lookup[schedule.shift_id]
                    
                    # Add shift details to the schedule dict
                    schedule_dict['shift_start'] = shift.start_time
                    schedule_dict['shift_end'] = shift.end_time 
                    schedule_dict['shift_type_id'] = shift.shift_type_id
                    schedule_dict['shift_type_name'] = shift.shift_type.value if shift.shift_type else None
                    
                    # Log the enrichment
                    logger.info(
                        f"Enriched schedule {schedule.id} with missing shift data from shift {shift.id}"
                    )
            
            enriched_schedules.append(schedule_dict)
        
        # Convert versions to a more suitable format for JSON (e.g., list of dicts)
        versions_list = [
            {
                "version": v.version,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "status": v.status.value if v.status else None,
                "date_range_start": v.date_range_start.isoformat() if v.date_range_start else None,
                "date_range_end": v.date_range_end.isoformat() if v.date_range_end else None,
                "notes": v.notes,
            }
            for v in available_versions
        ]

        return jsonify(
            {
                "status": "success",
                "schedules": enriched_schedules,
                "versions": versions_list,
                "current_version": version,
            }
        ), HTTPStatus.OK

    except Exception as e:
        logger.error(f"Error in get_schedules: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": "An unexpected error occurred"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules", methods=["POST"])
def create_schedule_entry():
    """Create a new individual schedule entry"""
    logger.info("Received request to create schedule entry")
    try:
        data = request.get_json()
        # Use the update schema for validation as it contains the necessary fields
        # This assumes the schema is compatible with creation data
        request_data = ScheduleUpdateRequest(**data)

        # Ensure required fields for creation are present
        if request_data.employee_id is None or request_data.date is None or request_data.version is None:
             return jsonify({"status": "error", "message": "Missing required fields for creating a new schedule: employee_id, date, and version"}), HTTPStatus.BAD_REQUEST

        logger.info(
            f"Creating new schedule entry with data: employee_id={request_data.employee_id}, date={request_data.date}, shift_id={request_data.shift_id}, version={request_data.version}"
        )

        schedule = Schedule(
            employee_id=request_data.employee_id,
            date=request_data.date, # Pydantic should handle date parsing
            shift_id=request_data.shift_id,  # Can be None
            version=request_data.version,
            notes=request_data.notes,
            # Handle availability_type conversion correctly
            availability_type=AvailabilityType(request_data.availability_type) if request_data.availability_type is not None else None
        )

        # Handle break_duration if provided and convert to break_start/break_end
        if request_data.break_duration is not None and request_data.break_duration > 0:
             # For manual creation, we might not have shift times readily available
             # Setting break_start/end might require shift_id lookup or might be set manually
             # For now, only calculate if shift_id is present, otherwise clear
            if schedule.shift_id is not None:
                shift = ShiftTemplate.query.get(schedule.shift_id)
                if shift is not None:
                    # Simplified break calculation: assume break starts after 1 hour of shift
                    shift_start = datetime.strptime(shift.start_time, "%H:%M")
                    break_start_time = shift_start + timedelta(hours=1) # Start break 1 hour into shift

                    # Calculate break end time based on duration
                    break_end_time = break_start_time + timedelta(minutes=request_data.break_duration)

                    # Format times as strings
                    schedule.break_start = break_start_time.strftime("%H:%M")
                    schedule.break_end = break_end_time.strftime("%H:%M")
                    logger.info(
                        f"Calculated break times: {schedule.break_start} to {schedule.break_end} from duration {request_data.break_duration}"
                    )
                else:
                    schedule.break_start = None
                    schedule.break_end = None
            else:
                schedule.break_start = None
                schedule.break_end = None

        # Default status for new entries
        schedule.status = ScheduleStatus.DRAFT

        db.session.add(schedule)
        db.session.commit()

        logger.info(f"Schedule entry created successfully with ID: {schedule.id}")

        # Add break_duration to the response before jsonify
        response_data = schedule.to_dict()
        # Check if break_start and break_end are not None and are strings before parsing
        if schedule.break_start is not None and isinstance(schedule.break_start, str) and \
           schedule.break_end is not None and isinstance(schedule.break_end, str):
            try:
                break_start = datetime.strptime(schedule.break_start, "%H:%M")
                break_end = datetime.strptime(schedule.break_end, "%H:%M")
                # Calculate duration in minutes
                break_duration_minutes = int(
                    (break_end - break_start).total_seconds() / 60
                )
                response_data["break_duration"] = break_duration_minutes
            except Exception as e:
                logger.error(f"Error calculating break duration for new schedule {schedule.id}: {str(e)}")
                response_data["break_duration"] = 0
        else:
            response_data["break_duration"] = 0


        return jsonify(response_data), HTTPStatus.CREATED

    except ValidationError as e:
        logger.error(f"Validation error creating schedule entry: {e.errors()}")
        return jsonify({"status": "error", "message": "Invalid input for creating schedule entry.", "details": e.errors()}), HTTPStatus.BAD_REQUEST
    except IntegrityError as e:
        db.session.rollback()
        logger.error(f"Database integrity error creating schedule entry: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Database error creating schedule entry.", "details": "A schedule entry for this employee, date, and version might already exist."}), HTTPStatus.CONFLICT # Use 409 for conflict
    except Exception as e:
        db.session.rollback()
        logger.error(f"An unexpected error occurred creating schedule entry: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred while creating schedule entry.", "details": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/generate", methods=["POST"])
@schedules.route("/schedules/generate/", methods=["POST"])
def generate_schedule():
    """Generate a schedule"""
    logger.info("Received request to generate schedule")

    try:
        # Use Pydantic for request validation
        request_data = request.get_json()
        schedule_request = ScheduleGenerateRequest(**request_data)
        
        # The request might include other config like version, create_empty_schedules etc.
        external_config_dict = schedule_request.dict(exclude_unset=True) # Get all passed params as dict
        
        logger.info(f"Generating schedule for date range: {schedule_request.start_date} to {schedule_request.end_date}")

        # --- FIX: Use dates directly from Pydantic validation ---
        start_date = schedule_request.start_date
        end_date = schedule_request.end_date

        # Initialize the ScheduleGenerator
        # Pass the app context to the generator if necessary, or ensure it's used within a context
        generator = ScheduleGenerator() # Assuming the generator is designed to work within a Flask app context
        
        # The generator internally handles app context now, no need to wrap it here
        result = generator.generate_schedule(
            start_date=start_date,
            end_date=end_date,
            external_config_dict=external_config_dict, # Pass the full config
            # version=schedule_request.version, # Version and create_empty_schedules should be handled by generator via config
            # create_empty_schedules=schedule_request.create_empty_schedules,
        )

        # Check the status from the result returned by the generator
        if result and result.get('status') == 'failed':
             # Log the failure reason which should be included in the result
             failure_reason = result.get('reason', 'Unknown scheduling error')
             logger.error(f"Schedule generation failed: {failure_reason}")
             # Return a 500 Internal Server Error with the failure reason
             return jsonify({
                 "status": "error",
                 "message": f"Schedule generation failed: {failure_reason}"
             }), HTTPStatus.INTERNAL_SERVER_ERROR


        logger.info("Schedule generation successful")
        # Assuming generate_schedule returns a dict suitable for jsonify
        return jsonify(result), HTTPStatus.OK

    except ValidationError as e:
        logger.error(f"Validation error in schedule generation request: {e.errors()}")
        return jsonify({"status": "error", "message": "Validation failed", "errors": e.errors()}), HTTPStatus.BAD_REQUEST
    except ScheduleResourceError as e:
        logger.error(f"Schedule resource error during generation: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": f"Failed during resource loading: {str(e)}"}), HTTPStatus.INTERNAL_SERVER_ERROR
    except Exception as e:
        logger.error(f"An unexpected error occurred during schedule generation: {str(e)}", exc_info=True)
        # More specific error handling based on the type of exception might be needed
        db.session.rollback() # Rollback session on error
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/pdf", methods=["GET"])
def get_schedule_pdf():
    """Get schedule as PDF"""
    try:
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")

        if not start_date_str or not end_date_str:
             return jsonify(
                {"status": "error", "message": "start_date and end_date are required"}
            ), HTTPStatus.BAD_REQUEST

        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d")

        # Get schedules for the date range
        schedules = db.session.query(Schedule).filter(
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
        return jsonify({"status": "error", "message": f"Invalid input: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        logger.error(f"Error in get_schedule_pdf: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/<int:schedule_id>", methods=["GET"])
@schedules.route("/schedules/<int:schedule_id>/", methods=["GET"])
def get_schedule(schedule_id):
    """Get a specific schedule"""
    schedule = db.session.get(Schedule, schedule_id)
    if not schedule:
        return jsonify({"status": "error", "message": "Schedule not found"}), HTTPStatus.NOT_FOUND
    return jsonify(schedule.to_dict())


@schedules.route("/schedules/<int:schedule_id>", methods=["PUT"])
@schedules.route("/schedules/<int:schedule_id>/", methods=["PUT"])
@schedules.route("/schedules/update/<int:schedule_id>", methods=["POST"])
def update_schedule(schedule_id):
    """Update a schedule (for drag and drop functionality)"""
    logger.info(
        f"Update request for schedule_id={schedule_id}"
    )

    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = ScheduleUpdateRequest(**data)
        
        # Enhanced logging for shift deletion operations
        if request_data.shift_id is None:
            logger.warning(
                f"DELETION OPERATION - Request to set shift_id=None for schedule_id={schedule_id}, version={request_data.version}"
            )
        else:
            logger.info(
                f"Validated update request data for schedule_id={schedule_id}: {request_data.dict()}"
            )

        # If schedule_id is 0, create a new schedule
        if schedule_id == 0:
            # Ensure required fields for creation are present
            if request_data.employee_id is None or request_data.date is None:
                 return jsonify({"status": "error", "message": "Missing required fields for creating a new schedule: employee_id and date"}), HTTPStatus.BAD_REQUEST

            # Get the version from the validated data or default to 1
            version = request_data.version if request_data.version is not None else 1
            logger.info(
                f"Creating new schedule with data: {request_data.dict()} and version {version}"
            )

            schedule = Schedule(
                employee_id=request_data.employee_id,
                shift_id=request_data.shift_id,  # Can be None
                date=request_data.date, # Pydantic returns date object
                version=version,  # Use the provided version or default to 1
                notes=request_data.notes,
                # Handle availability_type conversion correctly
                availability_type=AvailabilityType(request_data.availability_type) if request_data.availability_type is not None else None
            )

            # Handle break_duration by converting it to break_start and break_end
            if request_data.break_duration is not None and request_data.break_duration > 0:
                # If we have a shift, calculate break times based on shift times
                if schedule.shift_id is not None:
                    shift = ShiftTemplate.query.get(schedule.shift_id)
                    if shift is not None:
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
                            minutes=request_data.break_duration
                        )

                        # Format times as strings
                        schedule.break_start = break_start_time.strftime("%H:%M")
                        schedule.break_end = break_end_time.strftime("%H:%M")

                        logger.info(
                            f"Calculated break times: {schedule.break_start} to {schedule.break_end} from duration {request_data.break_duration}"
                        )
                elif request_data.break_duration > 0: # If no shift but break duration is provided, clear break times
                     schedule.break_start = None
                     schedule.break_end = None


            db.session.add(schedule)
        else:
            # Update existing schedule
            schedule = Schedule.query.get_or_404(schedule_id)
            
            # Enhanced logging for shift deletion operations
            if request_data.shift_id is None:
                logger.warning(
                    f"DELETION OPERATION - Found existing schedule {schedule_id} with current shift_id={schedule.shift_id}, version={schedule.version}"
                )
            else:
                logger.info(
                    f"Updating existing schedule: {schedule_id}, current version: {schedule.version}"
                )
            
            # Update fields from validated data if provided
            if request_data.employee_id is not None:
                schedule.employee_id = request_data.employee_id
                
            # Handle shift_id specifically for deletion operations (setting to None)
            if request_data.shift_id is not None or hasattr(request_data, 'shift_id'):
                # Explicitly check if shift_id is None to detect deletion operations
                if request_data.shift_id is None:
                    # This is a deletion operation
                    logger.warning(
                        f"DELETION OPERATION - Setting shift_id=None for schedule_id={schedule_id}"
                    )
                    schedule.shift_id = None
                    
                    # Also clear related shift data
                    schedule.shift_start = None
                    schedule.shift_end = None
                    schedule.break_start = None
                    schedule.break_end = None
                else:
                    # This is a regular update with a new shift_id
                    schedule.shift_id = request_data.shift_id
                    logger.info(
                        f"After update, shift_id={schedule.shift_id}"
                    )
                    
                    # If we're setting a shift_id, also update shift times from the template
                    if schedule.shift_id is not None:
                        shift_template = ShiftTemplate.query.get(schedule.shift_id)
                        if shift_template:
                            schedule.shift_start = shift_template.start_time
                            schedule.shift_end = shift_template.end_time
                            logger.info(
                                f"Updated shift times from template: {schedule.shift_start} to {schedule.shift_end}"
                            )
                
            if request_data.date is not None:
                schedule.date = request_data.date # Pydantic returns date object
                
            if request_data.notes is not None:
                schedule.notes = request_data.notes
                
            if request_data.version is not None:
                schedule.version = request_data.version
                logger.info(
                    f"Updated schedule version to {schedule.version}"
                )
                
            if request_data.availability_type is not None: # Check if explicitly provided
                # Handle availability_type conversion correctly
                schedule.availability_type = AvailabilityType(request_data.availability_type)
            elif hasattr(schedule, 'availability_type'): # If not provided, ensure it has a default or remains None if allowed by model
                 schedule.availability_type = None # Assuming None is allowed if not provided in update
                 logger.info(
                     f"Cleared schedule availability_type for schedule {schedule_id}"
                 )

            # Handle break_duration updates
            if request_data.break_duration is not None:
                if request_data.break_duration > 0:
                    # If we have a shift, calculate break times based on shift times
                    if schedule.shift_id is not None:
                        shift = ShiftTemplate.query.get(schedule.shift_id)
                        if shift is not None:
                            # Start break midway through the shift
                            shift_start = datetime.strptime(shift.start_time, "%H:%M")
                            shift_end = datetime.strptime(shift.end_time, "%H:%M")
                            shift_duration = (
                                shift_end - shift_start
                            ).total_seconds() / 60  # in minutes

                            # Calculate break start time (midway through the shift)
                            break_start_minutes = shift_duration / 2
                            break_start_time = shift_start + timedelta(
                                minutes=request_data.break_duration
                            )

                            # Calculate break end time based on duration
                            break_end_time = break_start_time + timedelta(
                                minutes=request_data.break_duration
                            )

                            # Format times as strings
                            schedule.break_start = break_start_time.strftime("%H:%M")
                            schedule.break_end = break_end_time.strftime("%H:%M")

                            logger.info(
                                f"Calculated break times: {schedule.break_start} to {schedule.break_end} from duration {request_data.break_duration}"
                            )
                    elif request_data.break_duration > 0: # If no shift but break duration is provided, clear break times
                        schedule.break_start = None
                        schedule.break_end = None
                else:
                    # If break_duration is 0 or negative, clear break times
                    schedule.break_start = None
                    schedule.break_end = None

        db.session.commit()
        
        # Log operation outcome
        if schedule_id > 0 and (request_data.shift_id is None and hasattr(request_data, 'shift_id')):
            logger.warning(
                f"DELETION OPERATION COMPLETED - Schedule {schedule_id} now has shift_id={schedule.shift_id}"
            )
        else:
            logger.info(
                f"Database commit successful for schedule_id={schedule_id}"
            )

        # Add break_duration to the response
        response_data = schedule.to_dict()
        # Check if break_start and break_end are not None and are strings before parsing
        if schedule.break_start is not None and isinstance(schedule.break_start, str) and \
           schedule.break_end is not None and isinstance(schedule.break_end, str):
            try:
                break_start = datetime.strptime(schedule.break_start, "%H:%M")
                break_end = datetime.strptime(schedule.break_end, "%H:%M")
                # Calculate duration in minutes
                break_duration_minutes = int(
                    (break_end - break_start).total_seconds() / 60
                )
                response_data["break_duration"] = break_duration_minutes
            except Exception as e:
                logger.error(f"Error calculating break duration: {str(e)}")
                response_data["break_duration"] = 0
        else:
            response_data["break_duration"] = 0

        logger.info(f"Schedule updated successfully: {response_data}")
        return jsonify(response_data)

    except ValidationError as e: # Catch Pydantic validation errors
        logger.error(f"Validation error updating schedule {schedule_id}: {e.errors()}")
        return jsonify({"status": "error", "message": "Invalid input.", "details": e.errors()}), HTTPStatus.BAD_REQUEST # Return validation details

    except Exception as e: # Catch any other exceptions
        db.session.rollback()
        logger.error(f"Error updating schedule {schedule_id}: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred.", "details": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


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
        logger.error(f"Error deleting schedule: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


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
            logger.error(
                error_msg,
                extra={
                    "action": "pdf_generation_error",
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                },
                exc_info=True
            )
            return jsonify({"status": "error", "message": error_msg}), HTTPStatus.INTERNAL_SERVER_ERROR

    except (KeyError, ValueError) as e:
        return jsonify({"status": "error", "message": f"Invalid input: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        import traceback

        error_msg = f"Unexpected error: {str(e)}"
        logger.error(
            error_msg,
            extra={
                "action": "export_schedule_error",
                "error": str(e),
                "traceback": traceback.format_exc(),
            },
            exc_info=True
        )
        return jsonify({"status": "error", "message": error_msg}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/<int:version>/publish", methods=["POST"])
def publish_schedule(version):
    try:
        schedules = Schedule.query.filter_by(version=version).all()
        if not schedules:
            return jsonify({"status": "error", "message": "Schedule version not found"}), HTTPStatus.NOT_FOUND

        for schedule in schedules:
            schedule.status = "published"

        db.session.commit()
        return jsonify({"status": "success", "message": "Schedule published successfully"})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error publishing schedule: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/<int:version>/archive", methods=["POST"])
def archive_schedule(version):
    try:
        schedules = Schedule.query.filter_by(version=version).all()
        if not schedules:
            return jsonify({"status": "error", "message": "Schedule version not found"}), HTTPStatus.NOT_FOUND

        for schedule in schedules:
            schedule.status = "archived"

        db.session.commit()
        return jsonify({"status": "success", "message": "Schedule archived successfully"})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error archiving schedule: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/validate", methods=["POST"])
def validate_schedule():
    """Validate an existing schedule"""
    try:
        # Parse data from request
        data = request.json
        if not data:
            return jsonify({"status": "error", "message": "No data provided"}), HTTPStatus.BAD_REQUEST

        # Get schedule IDs
        schedule_ids = data.get("schedule_ids", [])
        if not schedule_ids:
            return jsonify({"status": "error", "message": "No schedule IDs provided"}), HTTPStatus.BAD_REQUEST

        # Get schedules from database
        schedules = Schedule.query.filter(Schedule.id.in_(schedule_ids)).all()
        if not schedules:
            return jsonify({"status": "error", "message": "No schedules found"}), HTTPStatus.NOT_FOUND

        # Create resources and validator
        resources = ScheduleResources()
        resources.load()
        validator = ScheduleValidator(resources)

        # Create validator
        validator = ScheduleValidator()

        # Create config for validation
        # Updated to use the new from_scheduler_config method
        config = SchedulerConfig({
            "enforce_rest_periods": data.get("enforce_rest_periods", True),
            "min_rest_hours": data.get("min_rest_hours", 11),
        })

        # Convert SchedulerConfig to ScheduleConfig
        schedule_config = ScheduleConfig.from_scheduler_config(config)

        # Validate schedule
        validation_errors = validator.validate(schedules, schedule_config)

        if validation_errors:
            # Format and categorize validation errors for frontend display
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

            return jsonify(
                {
                    "status": "error",
                    "valid": False,
                    "errors": errors,
                    "schedule_count": len(schedules),
                    "validation_time": datetime.now().isoformat(),
                }
            ), 200

        return jsonify(
            {
                "status": "success",
                "valid": True,
                "schedule_count": len(schedules),
                "validation_time": datetime.now().isoformat(),
            }
        ), 200

    except ScheduleResourceError as e:
        return jsonify({"status": "error", "message": f"Resource error: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        current_app.logger.error(f"Error validating schedule: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": f"An unexpected error occurred: {str(e)}"}), HTTPStatus.INTERNAL_SERVER_ERROR


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
                    {"status": "error", "message": "Invalid date format, expected YYYY-MM-DD"}
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
                "status": "success",
                "versions": [v.to_dict() for v in available_versions],
                "date_range": {
                    "start": start_of_week.isoformat(),
                    "end": end_of_week.isoformat(),
                    "week": start_of_week.isocalendar()[1],
                },
            }
        )

    except Exception as e:
        logger.error(f"Error fetching versions: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


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
                {"status": "error", "message": "start_date and end_date are required"}
            ), HTTPStatus.BAD_REQUEST

        # Parse dates
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"status": "error", "message": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Get the current max version from both tables
        max_schedule_version = (
            db.session.query(db.func.max(Schedule.version)).scalar() or 0
        )
        max_meta_version = (
            db.session.query(db.func.max(ScheduleVersionMeta.version)).scalar() or 0
        )
        new_version = max(max_schedule_version, max_meta_version) + 1

        logger.info(
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
                logger.info(
                    f"Copied {len(new_schedules)} schedules from version {base_version}"
                )
            else:
                logger.info(
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

            logger.info(
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
            logger.info(
                f"Created version metadata for version {new_version}"
            )

            db.session.commit()

            return jsonify(
                {
                    "status": "success",
                    "message": "New version created successfully",
                    "version": new_version,
                    "status_code": "DRAFT",
                    "version_meta": version_meta.to_dict(),
                }
            )
        except Exception as e:
            # If version_meta table doesn't exist, just commit the schedules
            logger.error(f"Could not create version metadata: {str(e)}", exc_info=True)
            db.session.commit()

            return jsonify(
                {
                    "status": "error",
                    "message": "New version created successfully (without metadata)",
                    "version": new_version,
                    "status_code": "DRAFT",
                }
            )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating new version: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version/<int:version>/status", methods=["PUT"])
def update_version_status(version):
    """Update a schedule's status (DRAFT, PUBLISHED, ARCHIVED)"""
    try:
        data = request.get_json()
        new_status_str = data.get("status")

        if not new_status_str:
            return jsonify({"status": "error", "message": "Status is required"}), HTTPStatus.BAD_REQUEST

        if new_status_str not in [s.value for s in ScheduleStatus]:
            return jsonify(
                {"status": "error", "message": f"Invalid status: {new_status_str}"}
            ), HTTPStatus.BAD_REQUEST

        # Get all schedules for this version
        schedules = Schedule.query.filter_by(version=version).all()

        if not schedules:
            return jsonify(
                {"status": "error", "message": "Schedule version not found"}
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
                    "status": "error",
                    "message": f"Invalid state transition from {current_status.value} to {new_status_str}"
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
                    "status": "success",
                    "message": f"Version {version} status updated to {new_status.value}",
                    "version": version,
                    "status_code": new_status.value,
                }
            )

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating version status: {str(e)}", exc_info=True)
            return jsonify(
                {"status": "error", "message": f"Database error: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        logger.error(f"Error in update_version_status: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version/<int:version>/details", methods=["GET"])
def get_version_details(version):
    """Get detailed information about a specific schedule version."""
    try:
        # Check if version exists
        schedules = Schedule.query.filter_by(version=version).all()
        if not schedules:
            return jsonify(
                {"status": "error", "message": "Schedule version not found"}
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
            logger.warning(f"Could not fetch version metadata: {str(e)}")

        # Build response
        response = {
            "status": "success",
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
        logger.error(f"Error getting version details: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


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
                {"status": "error", "message": "source_version is required"}
            ), HTTPStatus.BAD_REQUEST

        if not start_date or not end_date:
            return jsonify(
                {"status": "error", "message": "start_date and end_date are required"}
            ), HTTPStatus.BAD_REQUEST

        # Parse dates
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"status": "error", "message": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Check if source version exists
        source_schedules = Schedule.query.filter_by(version=source_version).all()
        if not source_schedules:
            return jsonify(
                {"status": "error", "message": f"Source version {source_version} not found"}
            ), HTTPStatus.NOT_FOUND

        # Get the current max version
        max_version = db.session.query(db.func.max(Schedule.version)).scalar() or 0
        new_version = max_version + 1

        logger.info(
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
                    "status": "error",
                    "message": f"No schedules found in version {source_version} for the given date range"
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
            logger.warning(
                f"Could not create version metadata: {str(e)}"
            )
            # Continue anyway, we'll create the version without metadata

        db.session.commit()

        response = {
            "status": "success",
            "message": f"Successfully duplicated version {source_version} to new version {new_version}",
            "version": new_version,
            "status_code": "DRAFT",
        }

        if version_meta:
            response["version_meta"] = version_meta.to_dict()

        return jsonify(response)

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error duplicating version: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/versions/compare", methods=["GET"])
def compare_versions():
    """Compare two schedule versions and identify differences."""
    try:
        base_version = request.args.get("base_version", type=int)
        compare_version = request.args.get("compare_version", type=int)

        if not base_version or not compare_version:
            return jsonify(
                {
                    "status": "error",
                    "message": "base_version and compare_version are required query parameters"
                }
            ), HTTPStatus.BAD_REQUEST

        # Get schedules for both versions
        base_schedules = Schedule.query.filter_by(version=base_version).all()
        compare_schedules = Schedule.query.filter_by(version=compare_version).all()

        if not base_schedules:
            return jsonify(
                {"status": "error", "message": f"Base version {base_version} not found"}
            ), HTTPStatus.NOT_FOUND

        if not compare_schedules:
            return jsonify(
                {"status": "error", "message": f"Compare version {compare_version} not found"}
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
                "status": "success",
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
        logger.error(f"Error comparing versions: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/version/<int:version>/notes", methods=["PUT"])
def update_version_notes(version):
    """Update the notes for a schedule version."""
    try:
        data = request.get_json()
        notes = data.get("notes")

        if notes is None:
            return jsonify({"status": "error", "message": "notes field is required"}), HTTPStatus.BAD_REQUEST

        # Check if version exists
        version_exists = Schedule.query.filter_by(version=version).first()
        if not version_exists:
            return jsonify(
                {"status": "error", "message": f"Version {version} not found"}
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
                    "status": "success",
                    "message": f"Notes updated for version {version}",
                    "version": version,
                    "notes": notes,
                }
            )

        except Exception as e:
            logger.error(f"Error updating version notes: {str(e)}", exc_info=True)
            return jsonify(
                {"status": "error", "message": f"Failed to update version notes: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in update_version_notes: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal server error occurred."}), HTTPStatus.INTERNAL_SERVER_ERROR


@schedules.route("/schedules/fix-display", methods=["POST"])
def fix_schedule_display():
    """Fix any issues with schedule display, particularly fixing shift_id fields"""
    try:
        data = request.get_json()
        # Fix the dict.get with type=int issue by doing manual conversion
        version = data.get("version")
        if version is not None:
            version = int(version)
        start_date = data.get("start_date")
        end_date = data.get("end_date")

        if not version or not start_date or not end_date:
            return jsonify({
                "status": "error",
                "message": "Missing required parameters: version, start_date, end_date"
            }), HTTPStatus.BAD_REQUEST

        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({
                "status": "error",
                "message": "Invalid date format, expected YYYY-MM-DD"
            }), HTTPStatus.BAD_REQUEST

        # Find schedules for this version and date range with proper relationship loading
        schedules = Schedule.query.options(
            db.joinedload(Schedule.shift)  # Ensure shift relationship is loaded
        ).filter(
            Schedule.version == version,
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).all()

        logger.info(f"Found {len(schedules)} schedules to check for version {version}")

        # Count how many have no shift_id
        empty_schedules = [s for s in schedules if s.shift_id is None]
        logger.info(f"{len(empty_schedules)} schedules have no shift_id")

        # Count schedules that have shift_id but missing relationship data
        incomplete_schedules = [s for s in schedules if s.shift_id is not None and (not hasattr(s, 'shift') or s.shift is None)]
        logger.info(f"{len(incomplete_schedules)} schedules have shift_id but missing relationship data")

        # Get all shift templates to ensure we have complete shift info
        all_shifts = ShiftTemplate.query.all()
        shift_lookup = {shift.id: shift for shift in all_shifts}
        
        # Get default shift (early shift)
        default_shift = ShiftTemplate.query.filter_by(shift_type_id="EARLY").first()
        if not default_shift:
            default_shift = ShiftTemplate.query.first()
        
        if not default_shift:
            return jsonify({
                "status": "error",
                "message": "No default shift found to assign"
            }), HTTPStatus.BAD_REQUEST

        # Assign default shift to first employee for each day that has no shifts assigned
        assigned_count = 0
        days_fixed = set()

        for date_obj in [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]:
            # Check if any schedules for this date have shifts assigned
            date_schedules = [s for s in schedules if s.date.date() == date_obj]
            
            if not date_schedules:
                continue
                
            date_with_shifts = any(s.shift_id is not None for s in date_schedules)
            
            if not date_with_shifts:
                # Assign a shift to the first employee for this date
                first_schedule = next((s for s in date_schedules), None)
                if first_schedule:
                    # Update shift_id only
                    first_schedule.shift_id = default_shift.id
                    
                    # Explicitly set the shift relationship
                    first_schedule.shift = default_shift
                    
                    # Set availability type if the model has this field
                    if hasattr(first_schedule, 'availability_type'):
                        first_schedule.availability_type = 'FIXED'
                    
                    # Set shift_type_id if both objects have it
                    if hasattr(default_shift, 'shift_type_id') and hasattr(first_schedule, 'shift_type_id'):
                        first_schedule.shift_type_id = default_shift.shift_type_id
                    
                    # Make sure we're keeping the existing status or defaulting to DRAFT
                    if not first_schedule.status or first_schedule.status not in [ScheduleStatus.DRAFT, ScheduleStatus.PUBLISHED, ScheduleStatus.ARCHIVED]:
                        first_schedule.status = ScheduleStatus.DRAFT
                    
                    # Mark as not empty if the model has this field
                    if hasattr(first_schedule, 'is_empty'):
                        first_schedule.is_empty = False
                    
                    assigned_count += 1
                    days_fixed.add(date_obj.isoformat())
                    logger.info(f"Assigned shift {default_shift.id} to employee {first_schedule.employee_id} on {date_obj}")
                    
                    # Also check other schedules on this day that might need shift_id update
                    for other_schedule in date_schedules:
                        if other_schedule.shift_id is None and other_schedule != first_schedule:
                            # Maybe assign shifts to a few more employees on this day
                            if len(days_fixed) < 3 and assigned_count < 10:  # Limit how many we fix
                                other_schedule.shift_id = default_shift.id
                                other_schedule.shift = default_shift  # Set relationship explicitly
                                if hasattr(other_schedule, 'availability_type'):
                                    other_schedule.availability_type = 'FIXED'
                                if hasattr(other_schedule, 'is_empty'):
                                    other_schedule.is_empty = False
                                assigned_count += 1
        
        # Fix schedules with shift_id but missing relationship data
        if incomplete_schedules:
            for schedule in incomplete_schedules:
                # Get the shift from our lookup
                if schedule.shift_id in shift_lookup:
                    # Set the relationship explicitly
                    schedule.shift = shift_lookup[schedule.shift_id]
                    logger.info(f"Fixed relationship for schedule {schedule.id} with shift {schedule.shift_id}")
                    assigned_count += 1
                    
                    # Set shift_type_id if available
                    if hasattr(shift_lookup[schedule.shift_id], 'shift_type_id') and hasattr(schedule, 'shift_type_id'):
                        schedule.shift_type_id = shift_lookup[schedule.shift_id].shift_type_id
                
        # Commit changes
        db.session.commit()
        
        # Important: Refresh session to load relationships
        for schedule in schedules:
            if schedule.shift_id is not None:
                # Refresh each schedule that has a shift_id to load the relationship
                db.session.refresh(schedule)
        
        # Force refresh schedules after commit to get full data
        updated_schedules = Schedule.query.options(
            db.joinedload(Schedule.shift)  # Ensure shift relationship is loaded
        ).filter(
            Schedule.version == version,
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).all()
        
        # Now count schedules with shift_id
        schedules_with_shifts = [s for s in updated_schedules if s.shift_id is not None]
        schedules_with_relationship = [s for s in updated_schedules if s.shift_id is not None and hasattr(s, 'shift') and s.shift is not None]
        
        # For debugging, see if shift data is properly loaded
        sample_schedule = None
        if schedules_with_shifts:
            sample_schedule = schedules_with_shifts[0]
            has_shift_data = hasattr(sample_schedule, 'shift') and sample_schedule.shift is not None
            logger.info(f"Sample schedule (ID={sample_schedule.id}) has shift data: {has_shift_data}")
            if has_shift_data:
                logger.info(f"Shift details: start={sample_schedule.shift.start_time}, end={sample_schedule.shift.end_time}")
        
        # Convert schedules to dictionaries with complete information for the frontend
        enriched_schedules = []
        for schedule in updated_schedules:
            schedule_dict = schedule.to_dict()
            
            # Double-check if shift data is missing from to_dict() and add it explicitly
            if schedule.shift_id is not None and ('shift_start' not in schedule_dict or 'shift_end' not in schedule_dict):
                # Try to get the shift from our lookup
                if schedule.shift_id in shift_lookup:
                    shift = shift_lookup[schedule.shift_id]
                    
                    # Add shift details to the schedule dict
                    schedule_dict['shift_start'] = shift.start_time
                    schedule_dict['shift_end'] = shift.end_time
                    schedule_dict['shift_type_id'] = shift.shift_type_id
                    schedule_dict['shift_type_name'] = shift.shift_type.value if shift.shift_type else None
                    
                    # Log that we had to manually add missing shift data
                    logger.warning(
                        f"Manually added shift data for schedule {schedule.id} - to_dict() didn't include it"
                    )
            
            enriched_schedules.append(schedule_dict)
        
        return jsonify({
            "status": "success",
            "message": f"Fixed {assigned_count} schedules",
            "days_fixed": list(days_fixed),
            "empty_schedules_count": len(empty_schedules),
            "total_schedules": len(schedules),
            "schedules_with_shifts": len(schedules_with_shifts),
            "schedules_with_relationship": len(schedules_with_relationship),
            "sample_schedule": sample_schedule.to_dict() if sample_schedule else None,
            "fixed_schedules": enriched_schedules  # Return the enriched schedules for immediate use
        })

    except Exception as e:
        logger.error(f"Error in fix_schedule_display: {str(e)}", exc_info=True)


@schedules.route("/schedules/ai-generate", methods=["POST"])
def generate_ai_schedule():
    """Generate a schedule using AI"""
    try:
        logger.info("Received request to generate AI schedule")
        
        # Process request
        data = request.get_json()
        
        try:
            start_date = datetime.strptime(data.get("start_date"), "%Y-%m-%d").date()
            end_date = datetime.strptime(data.get("end_date"), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Invalid or missing date format, expected YYYY-MM-DD"}), HTTPStatus.BAD_REQUEST
        
        logger.info(f"Generating AI schedule for date range: {start_date} to {end_date}")

        # --- Data Collection ---
        logger.info("Collecting data for AI schedule generation...")

        with current_app.app_context():
            # Fetch employees
            employees = Employee.query.filter_by(is_active=True).all()
            logger.info(f"Fetched {len(employees)} active employees.")

            # Fetch shifts (ShiftTemplates)
            shifts = ShiftTemplate.query.all()
            logger.info(f"Fetched {len(shifts)} shift templates.")

            # Fetch coverage
            coverage = Coverage.query.all()
            logger.info(f"Fetched {len(coverage)} coverage entries.")

            # Fetch employee availability for the date range
            availabilities = EmployeeAvailability.query.filter(
                EmployeeAvailability.start_date <= end_date,
                EmployeeAvailability.end_date >= start_date
            ).all()
            # Also fetch recurring availabilities (where start_date is null or is_recurring is true)
            recurring_availabilities = EmployeeAvailability.query.filter(
                (EmployeeAvailability.start_date == None) | (EmployeeAvailability.is_recurring == True)
            ).all()
            # Combine and deduplicate if necessary (basic combining here, more complex logic might be needed later)
            all_availabilities = {}
            for av in availabilities + recurring_availabilities:
                 # Simple key based on employee_id, day_of_week, hour - might need refinement
                 key = f"{av.employee_id}_{av.day_of_week}_{av.hour}"
                 # Prioritize non-recurring/date-specific availability if overlaps
                 if key not in all_availabilities or (av.start_date is not None and all_availabilities[key].start_date is None):
                      all_availabilities[key] = av

            logger.info(f"Fetched {len(all_availabilities)} employee availability entries (including recurring).")

            # Fetch absences for the date range
            absences = Absence.query.filter(
                Absence.start_date <= end_date,
                Absence.end_date >= start_date
            ).all()
            logger.info(f"Fetched {len(absences)} absence entries.")

            # Fetch settings
            settings = Settings.query.first()
            if not settings:
                 # Log a warning or error if settings are not found, use default or raise error
                 logger.warning("Settings not found in DB, using default.")
                 settings = Settings.get_default_settings()
            logger.info("Fetched application settings.")
        # --- End Data Collection ---

        # --- Data Structuring ---
        logger.info("Structuring collected data...")

        # Convert fetched objects to dictionaries for JSON serialization
        structured_data = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "version": data.get("version"),
            "employees": [emp.to_dict() for emp in employees] if employees else [],
            "shifts": [shift.to_dict() for shift in shifts] if shifts else [],
            "coverage": [cov.to_dict() for cov in coverage] if coverage else [],
            "availabilities": [av.to_dict() for av in all_availabilities.values()] if all_availabilities else [], # Use .values() for the combined dict
            "absences": [abs.to_dict() for abs in absences] if absences else [],
            "settings": settings.to_dict() if settings else {}, # Convert settings to dict
        }

        logger.info("Data structuring complete.")
        # --- End Data Structuring ---

        # --- AI Model Interaction ---
        logger.info("Sending data to AI model for generation...")

        # TODO: Implement the actual API call to the external AI model (e.g., Gemini)
        # This section needs to contain the code to send the 'structured_data' to the AI model.

        # Example (Conceptual) API Call Structure:
        # try:
        #     ai_api_url = "YOUR_AI_MODEL_API_ENDPOINT"
        #     api_key = "YOUR_API_KEY" # Load securely, e.g., from environment variables
        #     headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
        #     ai_response = requests.post(ai_api_url, json=structured_data, headers=headers, timeout=60) # Example with requests library
        #     ai_response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)
        #     ai_response_data = ai_response.json()
        # except requests.exceptions.RequestException as e:
        #     logger.error(f"AI API call failed: {str(e)}", exc_info=True)
        #     return jsonify({"status": "error", "message": f"Failed to get response from AI model: {str(e)}"}), HTTPStatus.INTERNAL_SERVER_ERROR

        # Placeholder for AI model response (replace with actual API call result)
        # The structure of ai_response_data will depend entirely on the AI model's API.
        # Assume for now it returns a list of schedule assignments.
        ai_response_data = { "generated_assignments": [] } # Example structure: list of dicts like {"employee_id": ..., "date": "YYYY-MM-DD", "shift_id": ...}

        logger.info("Received response from AI model (placeholder).")
        # --- End AI Model Interaction ---

        # --- Process AI Model Response and Update Database ---
        logger.info("Processing AI model response and updating database...")

        # TODO: Implement logic to process the ai_response_data received from the AI model.
        # This section needs to parse the AI's output and apply it to the database.
        # Key considerations:
        # 1. Parse the `ai_response_data` based on the expected format from the AI model.
        #    For the example `ai_response_data` structure above, you would access `ai_response_data["generated_assignments"]`.
        # 2. Validate the received data. Check if the employee_ids, shift_ids, and dates are valid and exist in your database.
        #    You might need to fetch employees and shifts again or use the data collected earlier.
        # 3. Implement the logic to create *new* Schedule entries for the specified version and date range based on the AI's assignments.
        #    Alternatively, if you want to *update* an existing version, you might need to delete existing schedules for that version/date range first or carefully update them.
        #    Creating a new version is generally safer for AI-generated schedules to avoid unintended modifications.
        # 4. Use database transactions (`db.session.add_all()`, `db.session.commit()`, `db.session.rollback()`) to ensure data integrity.
        #    If any part of the update fails, the entire operation should be rolled back.
        # 5. You might want to clear existing schedules for the target version and date range *before* adding the new AI-generated schedules.
        #    Example:
        #    existing_schedules = Schedule.query.filter(
        #        Schedule.version == version,
        #        Schedule.date >= start_date,
        #        Schedule.date <= end_date
        #    ).all()
        #    for s in existing_schedules:
        #        db.session.delete(s)
        #    db.session.commit() # Commit deletions before adding new ones or do within the same transaction carefully.
        # 6. Create new Schedule objects from the AI's output and add them to the session.
        #    Example (assuming ai_response_data["generated_assignments"] is a list of assignment dicts):
        #    new_schedules_to_add = []
        #    for assignment in ai_response_data.get("generated_assignments", []):
        #        try:
        #            # Basic validation
        #            employee_id = assignment.get("employee_id")
        #            date_str = assignment.get("date")
        #            shift_id = assignment.get("shift_id") # Can be None
        #            if not employee_id or not date_str:
        #                 logger.error(f"Skipping invalid assignment from AI: {assignment}")
        #                 continue
        #            assignment_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        #
        #            new_schedule = Schedule(
        #                employee_id=employee_id,
        #                date=assignment_date,
        #                shift_id=shift_id,
        #                version=version, # Use the target version for the AI-generated schedule
        #                status=ScheduleStatus.DRAFT # Or another appropriate initial status
        #                # Map other fields if provided by the AI (e.g., break times, notes)
        #            )
        #            new_schedules_to_add.append(new_schedule)
        #        except Exception as e:
        #             logger.error(f"Error processing AI assignment {assignment}: {str(e)}", exc_info=True)
        #             continue
        #
        #    if new_schedules_to_add:
        #        db.session.add_all(new_schedules_to_add)
        #        db.session.commit()
        #        logger.info(f"Successfully added {len(new_schedules_to_add)} AI-generated schedules.")
        #    else:
        #        logger.warning("No valid AI-generated schedules to add.")

        logger.info("Database update complete.")
        # --- End Process AI Model Response and Update Database ---

        # Return a success message and potentially the generated schedules or a summary
        # The actual return value might need to be the full ScheduleResponse structure
        # as expected by the frontend's generateAiSchedule API call.
        # You would need to fetch the newly created/updated schedules and format them.
        return jsonify({"status": "success", "message": "AI schedule generation process outlined. Manual implementation required for AI interaction and database update.", "details": "TODO sections added."}), HTTPStatus.OK

    except ValueError:
        logger.error("Invalid date format received for AI schedule generation", exc_info=True)
        return jsonify({"status": "error", "message": "Invalid date format, expected YYYY-MM-DD"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        logger.error(f"An error occurred during AI schedule generation: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "An internal error occurred"}), HTTPStatus.INTERNAL_SERVER_ERROR
