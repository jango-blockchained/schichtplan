from flask import Blueprint, request, jsonify
from src.backend.models import (
    db,
    EmployeeAvailability,
    Employee,
    Absence,
    Schedule,
    ShiftTemplate,
    Settings,
)
from src.backend.models.employee import AvailabilityType
from src.backend.models.schedule import ScheduleStatus, ScheduleVersionMeta
from datetime import datetime
from http import HTTPStatus
from sqlalchemy import desc
from flask import current_app
from pydantic import ValidationError
from src.backend.schemas.availability import (
    AvailabilityCreateRequest,
    AvailabilityUpdateRequest,
    AvailabilityCheckRequest,
    EmployeeAvailabilitiesUpdateRequest,
    EmployeeStatusByDateRequest,
    EmployeeShiftsForEmployeeRequest,
)
import traceback
from sqlalchemy.exc import IntegrityError, DataError

availability = Blueprint("availability", __name__, url_prefix="/api/v2/availability")


@availability.route("/", methods=["GET"])
def get_availabilities():
    """Get all availabilities"""
    availabilities = EmployeeAvailability.query.all()
    return jsonify([availability.to_dict() for availability in availabilities])


@availability.route("/", methods=["POST"])
def create_availability():
    """Create a new availability"""
    print("[DEBUG] Entered create_availability")
    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = AvailabilityCreateRequest(**data)

        # Create availability using validated data
        availability_type = request_data.availability_type
        if isinstance(availability_type, str):
            try:
                availability_type = AvailabilityType(availability_type)
            except (ValueError, TypeError) as e:
                return jsonify(
                    {
                        "status": "error",
                        "message": f"Invalid availability_type: {availability_type}",
                        "details": str(e),
                    }
                ), HTTPStatus.BAD_REQUEST
        availability = EmployeeAvailability(
            employee_id=request_data.employee_id,
            day_of_week=request_data.day_of_week,
            hour=request_data.hour,
            is_available=bool(request_data.is_available),
            availability_type=availability_type,
        )
        db.session.add(availability)
        db.session.commit()
        return jsonify(availability.to_dict()), HTTPStatus.CREATED
    except ValidationError as e:  # Catch Pydantic validation errors
        return jsonify(
            {"status": "error", "message": "Invalid input.", "details": e.errors()}
        ), HTTPStatus.BAD_REQUEST  # Return validation details
    except (IntegrityError, DataError) as e:
        db.session.rollback()
        print(f"[ERROR][create_availability][Integrity/Data] {e}")
        return jsonify(
            {
                "status": "error",
                "message": "Database integrity or type error.",
                "details": str(e),
            }
        ), HTTPStatus.BAD_REQUEST
    except Exception as e:  # Catch any other exceptions
        db.session.rollback()
        print(f"[ERROR][create_availability] {e}")
        traceback.print_exc()
        return jsonify(
            {"status": "error", "message": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/<int:availability_id>", methods=["GET"])
def get_availability(availability_id):
    """Get a specific availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    return jsonify(availability.to_dict())


@availability.route("/<int:availability_id>", methods=["PUT"])
def update_availability(availability_id):
    """Update an availability"""
    print("[DEBUG] Entered update_availability")
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = AvailabilityUpdateRequest(**data)
        # Update availability attributes from validated data if provided
        if request_data.employee_id is not None:
            availability.employee_id = request_data.employee_id
        if request_data.day_of_week is not None:
            availability.day_of_week = request_data.day_of_week
        if request_data.hour is not None:
            availability.hour = request_data.hour
        if request_data.is_available is not None:
            availability.is_available = bool(request_data.is_available)
        if request_data.availability_type is not None:
            availability_type = request_data.availability_type
            if isinstance(availability_type, str):
                try:
                    availability_type = AvailabilityType(availability_type)
                except (ValueError, TypeError) as e:
                    return jsonify(
                        {
                            "status": "error",
                            "message": f"Invalid availability_type: {availability_type}",
                            "details": str(e),
                        }
                    ), HTTPStatus.BAD_REQUEST
            availability.availability_type = availability_type
        db.session.commit()
        return jsonify(availability.to_dict())
    except ValidationError as e:  # Catch Pydantic validation errors
        return jsonify(
            {"status": "error", "message": "Invalid input.", "details": e.errors()}
        ), HTTPStatus.BAD_REQUEST  # Return validation details
    except (IntegrityError, DataError) as e:
        db.session.rollback()
        print(f"[ERROR][update_availability][Integrity/Data] {e}")
        return jsonify(
            {
                "status": "error",
                "message": "Database integrity or type error.",
                "details": str(e),
            }
        ), HTTPStatus.BAD_REQUEST
    except Exception as e:  # Catch any other exceptions
        db.session.rollback()
        print(f"[ERROR][update_availability] {e}")
        traceback.print_exc()
        return jsonify(
            {"status": "error", "message": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/<int:availability_id>", methods=["DELETE"])
def delete_availability(availability_id):
    """Delete an availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)

    try:
        db.session.delete(availability)
        db.session.commit()
        return "", HTTPStatus.NO_CONTENT

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/check", methods=["POST"])
def check_availability():
    """Check employee availability for a specific date and time range"""

    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = AvailabilityCheckRequest(**data)

        # Access validated data from the model
        employee_id = request_data.employee_id
        check_date = request_data.date  # Pydantic returns date object
        hour = request_data.hour

        # Get employee
        employee = Employee.query.get_or_404(employee_id)

        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee_id,
            EmployeeAvailability.day_of_week == check_date.weekday(),
        ).all()

        # Check time range if provided
        if hour is not None:
            availabilities = [a for a in availabilities if a.hour == hour]

        # If no availability records exist for this time, employee is considered available
        if not availabilities:
            return jsonify({"is_available": True})

        # Check if any availability record indicates the employee is available
        is_available = any(a.is_available for a in availabilities)

        return jsonify(
            {
                "is_available": is_available,
                "reason": None
                if is_available
                else "Marked as unavailable for this time",
            }
        )

    except ValidationError as e:
        return jsonify(
            {"status": "error", "message": "Invalid input.", "details": e.errors()}
        ), HTTPStatus.BAD_REQUEST  # Return validation details
    except KeyError as e:
        return jsonify(
            {"error": f"Missing required field: {str(e)}"}
        ), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        print(f"[ERROR][check_availability] {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/employees/<int:employee_id>/availabilities", methods=["PUT"])
def update_employee_availabilities(employee_id):
    """Update employee availabilities"""
    try:
        # Check if employee exists first
        employee = Employee.query.get_or_404(employee_id)
        data = request.get_json()
        current_app.logger.debug(
            f"Received availability data for employee {employee_id}: {data}"
        )
        # Validate data using Pydantic schema
        request_data = EmployeeAvailabilitiesUpdateRequest(
            availabilities=data["availabilities"]
        )
        # Begin transaction
        try:
            # Delete existing availabilities
            deleted_count = EmployeeAvailability.query.filter_by(
                employee_id=employee_id
            ).delete()
            current_app.logger.debug(
                f"Deleted {deleted_count} existing availabilities for employee {employee_id}"
            )
            # Create new availabilities from validated data
            for availability_data in request_data.availabilities:
                availability_type = availability_data.availability_type
                if isinstance(availability_type, str):
                    try:
                        availability_type = AvailabilityType(availability_type)
                    except (ValueError, TypeError) as e:
                        db.session.rollback()
                        return jsonify(
                            {
                                "status": "error",
                                "message": f"Invalid availability_type: {availability_type}",
                                "details": str(e),
                            }
                        ), HTTPStatus.BAD_REQUEST
                availability = EmployeeAvailability(
                    employee_id=employee_id,
                    day_of_week=availability_data.day_of_week,
                    hour=availability_data.hour,
                    is_available=availability_data.is_available,
                    availability_type=availability_type,
                )
                db.session.add(availability)
            db.session.commit()
            return jsonify(
                {
                    "message": "Availabilities updated successfully",
                    "count": len(request_data.availabilities),
                }
            ), HTTPStatus.OK
        except Exception as transaction_error:
            db.session.rollback()
            current_app.logger.error(
                f"Transaction error when updating availabilities: {str(transaction_error)}"
            )
            return jsonify(
                {"error": f"Transaction error: {str(transaction_error)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR
    except ValidationError as e:
        current_app.logger.error(
            f"Validation error when updating availabilities: {e.errors()}"
        )
        return jsonify(
            {"status": "error", "message": "Invalid input.", "details": e.errors()}
        ), HTTPStatus.BAD_REQUEST
    except Exception as e:
        current_app.logger.error(f"Error updating availabilities: {str(e)}")
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/employees/<int:employee_id>/availabilities", methods=["GET"])
def get_employee_availabilities(employee_id):
    """Get employee availabilities"""
    availabilities = EmployeeAvailability.query.filter_by(employee_id=employee_id).all()
    return jsonify(
        [
            {
                "id": a.id,
                "employee_id": a.employee_id,
                "day_of_week": a.day_of_week,
                "hour": a.hour,
                "is_available": a.is_available,
                "availability_type": a.availability_type.value
                if a.availability_type
                else "AVAILABLE",
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in availabilities
        ]
    ), HTTPStatus.OK


@availability.route("/by_date", methods=["GET"])
def get_employee_status_by_date():
    """Get availability status for all active employees for a given date."""

    # Wrap the core logic in an application context
    with current_app.app_context():
        try:
            # Validate query parameters using Pydantic schema
            request_data = EmployeeStatusByDateRequest(**request.args)
            target_date = request_data.date

        except ValidationError as e:
            return jsonify(
                {"status": "error", "message": "Invalid input.", "details": e.errors()}
            ), HTTPStatus.BAD_REQUEST  # Return validation details
        except Exception as e:
            # Log the exception e
            current_app.logger.error(
                f"Error parsing date in /api/availability/by_date: {str(e)}"
            )
            return jsonify(
                {"error": f"An unexpected error occurred during date parsing: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

        results = []

        try:
            # Determine the version_id to check against for schedules
            # Prioritize Published, then latest Draft, then latest overall.
            version_to_check = (
                ScheduleVersionMeta.query.filter(
                    ScheduleVersionMeta.date_range_start.isnot(None),
                    ScheduleVersionMeta.date_range_end.isnot(None),
                    ScheduleVersionMeta.date_range_start <= target_date,
                    ScheduleVersionMeta.date_range_end >= target_date,
                    ScheduleVersionMeta.status == ScheduleStatus.PUBLISHED,
                )
                .order_by(desc(ScheduleVersionMeta.version))
                .first()
            )

            if not version_to_check:
                version_to_check = (
                    ScheduleVersionMeta.query.filter(
                        ScheduleVersionMeta.date_range_start.isnot(None),
                        ScheduleVersionMeta.date_range_end.isnot(None),
                        ScheduleVersionMeta.date_range_start <= target_date,
                        ScheduleVersionMeta.date_range_end >= target_date,
                        ScheduleVersionMeta.status == ScheduleStatus.DRAFT,
                    )
                    .order_by(desc(ScheduleVersionMeta.version))
                    .first()
                )

            if not version_to_check:
                # Fallback to the absolute latest version if no specific one covers the date well
                # This fallback doesn't need date range checks as it's the *latest* regardless of range
                version_to_check = ScheduleVersionMeta.query.order_by(
                    desc(ScheduleVersionMeta.version)
                ).first()

            version_id_to_check = version_to_check.version if version_to_check else None

            active_employees = Employee.query.filter_by(is_active=True).all()

            # Fetch all relevant absences and schedules in bulk to avoid N+1 queries
            absences_on_date = {}
            if active_employees:
                employee_ids = [emp.id for emp in active_employees]
                abs_records = Absence.query.filter(
                    Absence.employee_id.in_(employee_ids),
                    Absence.start_date <= target_date,
                    Absence.end_date >= target_date,
                ).all()
                for ab_rec in abs_records:
                    absences_on_date[ab_rec.employee_id] = ab_rec

            schedules_on_date = {}
            if active_employees and version_id_to_check is not None:
                sched_records = (
                    db.session.query(Schedule, ShiftTemplate)
                    .join(ShiftTemplate, Schedule.shift_id == ShiftTemplate.id)
                    .filter(
                        Schedule.employee_id.in_(employee_ids),
                        Schedule.date == target_date,
                        Schedule.version == version_id_to_check,
                    )
                    .all()
                )
                for sched_rec, shift_tpl in sched_records:
                    schedules_on_date[sched_rec.employee_id] = (sched_rec, shift_tpl)

            for emp in active_employees:
                status = "Available"
                details = None

                if emp.id in absences_on_date:
                    absence = absences_on_date[emp.id]

                    # Get settings for absence type lookup
                    settings = Settings.query.first()
                    absence_type_name = (
                        absence.absence_type_id
                    )  # Default fallback to the ID

                    # Try to find the human-readable name from settings.absence_types
                    if settings and settings.absence_types:
                        for absence_type in settings.absence_types:
                            if absence_type.get("id") == absence.absence_type_id:
                                absence_type_name = absence_type.get(
                                    "name", absence.absence_type_id
                                )
                                break

                    status = f"Absence: {absence_type_name}"
                    details = (
                        absence.to_dict()
                        if hasattr(absence, "to_dict")
                        else {"reason": absence.note or status}
                    )
                elif emp.id in schedules_on_date:
                    schedule, shift_template = schedules_on_date[emp.id]
                    status = f"Shift: {shift_template.name if hasattr(shift_template, 'name') else shift_template.shift_type_id} ({shift_template.start_time.strftime('%H:%M')} - {shift_template.end_time.strftime('%H:%M')})"
                    details = (
                        schedule.to_dict()
                        if hasattr(schedule, "to_dict")
                        else {"shift_id": schedule.shift_id}
                    )

                results.append(
                    {
                        "employee_id": emp.id,
                        "employee_name": f"{emp.first_name} {emp.last_name}",
                        "status": status,
                        "details": details,  # Adding a details field for richer info on frontend
                    }
                )

            return jsonify(results), HTTPStatus.OK

        except Exception as e:
            # Log the exception e
            current_app.logger.error(
                f"Error in /api/availability/by_date: {str(e)}"
            )  # Corrected logging
            return jsonify(
                {"error": f"An unexpected error occurred: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/shifts_for_employee", methods=["GET"])
def get_shifts_for_employee_on_date():
    """Get all shift templates active on a given day for an employee, including availability information."""

    try:
        # Validate query parameters using Pydantic schema
        request_data = EmployeeShiftsForEmployeeRequest(**request.args)
        target_date = request_data.date
        employee_id = request_data.employee_id

    except ValidationError as e:
        return jsonify(
            {"status": "error", "message": "Invalid input.", "details": e.errors()}
        ), HTTPStatus.BAD_REQUEST  # Return validation details
    except ValueError as e:
        return (
            jsonify({"error": str(e)}),
            HTTPStatus.BAD_REQUEST,
        )  # Keep existing ValueError catch for employee_id conversion if needed elsewhere
    except Exception as e:
        current_app.logger.error(
            f"Error processing request in /api/availability/shifts_for_employee: {str(e)} - {type(e)}"
        )
        traceback.print_exc()
        return jsonify(
            {"error": f"An unexpected error occurred: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR

    try:
        # Ensure employee exists
        _ = Employee.query.get_or_404(employee_id)
        day_of_week_str = str(
            target_date.weekday()
        )  # Monday is 0, Sunday is 6. Key for active_days JSON.

        # 1. Get all shift templates active on this day_of_week
        potential_shift_templates = ShiftTemplate.query.all()
        active_shift_templates = []

        for st in potential_shift_templates:
            try:
                # Log the shift template and its active_days for debugging
                current_app.logger.debug(
                    f"Checking shift template ID {st.id}, active_days: {st.active_days}, type: {type(st.active_days)}"
                )

                if st.active_days is None:
                    current_app.logger.warning(
                        f"Shift template ID {st.id} has no active_days field"
                    )
                    continue

                # Handle dict format (older format)
                if isinstance(st.active_days, dict):
                    if st.active_days.get(day_of_week_str, False):
                        active_shift_templates.append(st)
                        current_app.logger.debug(
                            f"Added shift template ID {st.id} (dict format)"
                        )

                # Handle list format (newer format)
                elif isinstance(st.active_days, list):
                    day_of_week_int = int(day_of_week_str)
                    if day_of_week_int in st.active_days:
                        active_shift_templates.append(st)
                        current_app.logger.debug(
                            f"Added shift template ID {st.id} (list format)"
                        )

                else:
                    current_app.logger.warning(
                        f"Shift template ID {st.id} has unknown active_days format: {type(st.active_days)}"
                    )
            except Exception as e:
                current_app.logger.error(
                    f"Error processing shift template ID {st.id}: {str(e)}"
                )

        current_app.logger.info(
            f"Found {len(active_shift_templates)} active shift templates out of {len(potential_shift_templates)} total templates for day {day_of_week_str}"
        )

        # 2. Fetch employee's availability for that day_of_week
        employee_availabilities_for_day = EmployeeAvailability.query.filter_by(
            employee_id=employee_id,
            day_of_week=target_date.weekday(),  # Stored as integer in EmployeeAvailability
        ).all()

        availability_map = {
            avail.hour: avail for avail in employee_availabilities_for_day
        }
        shifts_with_availability = []

        # Check existing assignments for this employee on this date
        existing_assignment = Schedule.query.filter(
            Schedule.employee_id == employee_id,
            Schedule.date == target_date,
            Schedule.shift_id.isnot(None),
            Schedule.status.in_([ScheduleStatus.DRAFT, ScheduleStatus.PUBLISHED]),
        ).first()

        # Fetch all existing schedules for this date to check conflicts
        existing_schedules = Schedule.query.filter(
            Schedule.date == target_date,
            Schedule.shift_id.isnot(None),
            Schedule.status.in_([ScheduleStatus.DRAFT, ScheduleStatus.PUBLISHED]),
        ).all()
        assigned_shift_ids = {
            schedule.shift_id
            for schedule in existing_schedules
            if schedule.employee_id != employee_id
        }

        for shift_template in active_shift_templates:
            try:
                # Ensure start_time and end_time are time objects for .hour access
                st_start_time_obj = datetime.strptime(
                    shift_template.start_time, "%H:%M"
                ).time()
                st_end_time_obj = datetime.strptime(
                    shift_template.end_time, "%H:%M"
                ).time()
            except ValueError:
                current_app.logger.warning(
                    f"ShiftTemplate ID {shift_template.id} has invalid time format. Skipping."
                )
                continue  # Skip this shift template if times are malformed

            shift_start_hour = st_start_time_obj.hour
            shift_end_hour = st_end_time_obj.hour

            # Handle overnight shifts or shifts ending exactly at midnight
            current_day_shift_end_hour = shift_end_hour
            if (
                shift_end_hour == 0 and st_end_time_obj.minute == 0
            ):  # Ends exactly at midnight
                current_day_shift_end_hour = 24
            elif shift_end_hour < shift_start_hour:  # Overnight shift
                current_day_shift_end_hour = 24

            # Check availability for each hour of the shift
            is_fully_available = True
            availability_hours = []
            for hour_of_day in range(shift_start_hour, current_day_shift_end_hour):
                hourly_availability = availability_map.get(hour_of_day)
                if not hourly_availability or not hourly_availability.is_available:
                    is_fully_available = False
                else:
                    availability_hours.append(
                        {
                            "hour": hour_of_day,
                            "availability_type": hourly_availability.availability_type.value
                            if hourly_availability.availability_type
                            else "AVAILABLE",
                        }
                    )

            # Determine the most restrictive availability type from available hours
            effective_availability_type = AvailabilityType.AVAILABLE  # Default
            for hour in availability_hours:
                hour_type = hour["availability_type"]
                if hour_type == AvailabilityType.FIXED.value:
                    effective_availability_type = AvailabilityType.FIXED
                    break
                elif (
                    hour_type == AvailabilityType.PREFERRED.value
                    and effective_availability_type != AvailabilityType.FIXED
                ):
                    effective_availability_type = AvailabilityType.PREFERRED

            # Get shift name
            shift_name = (
                shift_template.name
                if hasattr(shift_template, "name")
                else (
                    shift_template.shift_type_id
                    or (
                        shift_template.shift_type.value
                        if hasattr(shift_template, "shift_type")
                        else "Unknown"
                    )
                )
            )

            # Add shift to result with availability information
            shift_info = {
                "shift_id": shift_template.id,
                "name": shift_name,
                "start_time": st_start_time_obj.strftime("%H:%M"),
                "end_time": st_end_time_obj.strftime("%H:%M"),
                "is_available": is_fully_available,
                "availability_type": effective_availability_type.value
                if is_fully_available
                else "UNAVAILABLE",
                "availability_hours": availability_hours,
                "is_currently_assigned": existing_assignment
                and existing_assignment.shift_id == shift_template.id,
                "is_assigned_to_other": shift_template.id in assigned_shift_ids,
            }

            shifts_with_availability.append(shift_info)

        return jsonify(shifts_with_availability), HTTPStatus.OK

    except Exception as e:
        current_app.logger.error(
            f"Error in /api/availability/shifts_for_employee: {str(e)} - {type(e)}"
        )
        traceback.print_exc()
        return jsonify(
            {"error": f"An unexpected error occurred: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
