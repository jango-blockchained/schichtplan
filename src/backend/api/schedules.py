from flask import Blueprint, request, jsonify, send_file
from ..models import (
    db,
    Schedule,
    Employee,
    ShiftTemplate,
    Settings,
    EmployeeGroup,
    Coverage,
    ScheduleVersionMeta,
    ScheduleStatus,
)
from http import HTTPStatus
from datetime import datetime, timedelta, date
import calendar
from typing import List, Dict
from io import BytesIO
import reportlab.lib.pagesizes as pagesizes
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from flask import current_app
from ..services.scheduler import ScheduleGenerator, ScheduleGenerationError
import logging
from sqlalchemy import and_
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

bp = Blueprint("schedules", __name__, url_prefix="/api/schedules")


def get_next_month_dates():
    today = date.today()
    next_month = today.replace(day=1) + timedelta(days=32)
    next_month = next_month.replace(day=1)
    last_day = calendar.monthrange(next_month.year, next_month.month)[1]
    return next_month, next_month.replace(day=last_day)


from ..services.auth_service import login_required, permission_required, get_current_user

@bp.route("/", methods=["GET"])
@login_required
def get_schedules():
    """Get all schedules for a given period (requires authentication)"""
    try:
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        version = request.args.get("version", type=int)
        include_empty = request.args.get("include_empty", "false").lower() == "true"

        # Provide default date range (current week) if not specified
        if not start_date or not end_date:
            today = date.today()
            # Start from Monday of the current week
            start_of_week = today - timedelta(days=today.weekday())
            # End on Sunday of the current week
            end_of_week = start_of_week + timedelta(days=6)

            start_date = start_of_week.strftime("%Y-%m-%d")
            end_date = end_of_week.strftime("%Y-%m-%d")
            logger.info(f"Using default date range: {start_date} to {end_date}")

        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Get all versions for this date range
        try:
            versions_query = (db.session.query(Schedule.version)  # type: ignore
                              .filter(Schedule.date >= start_date_obj,  # type: ignore
                                      Schedule.date <= end_date_obj)  # type: ignore
                              .distinct()
                              .order_by(Schedule.version.desc()))  # type: ignore
            versions = versions_query.all()

            # Try to get from version metadata too
            version_metas_query = (ScheduleVersionMeta.query.filter(  # type: ignore
                and_(ScheduleVersionMeta.date_range_start != None,
                     ScheduleVersionMeta.date_range_start <= end_date_obj,  # type: ignore
                     ScheduleVersionMeta.date_range_end != None,
                     ScheduleVersionMeta.date_range_end >= start_date_obj))  # type: ignore
                                   .order_by(ScheduleVersionMeta.version.desc())) # type: ignore
            version_metas = version_metas_query.all()

            # Combine versions from both sources
            version_numbers = []
            version_statuses = {}

            # Add versions from metadata
            for meta in version_metas:
                version_numbers.append(meta.version)
                version_statuses[meta.version] = meta.status.value

            # Add versions from schedules that might not have metadata
            for v in versions:
                if v[0] not in version_numbers:
                    version_numbers.append(v[0])
                    # Default status for versions without metadata
                    version_statuses[v[0]] = "DRAFT"

            # Sort version numbers in descending order
            version_numbers.sort(reverse=True)

        except Exception as e:
            logger.error(f"Error getting schedule versions: {str(e)}")
            versions = []
            version_numbers = []
            version_statuses = {}

        # If no version is specified but versions exist, use the latest
        if version is None and version_numbers:
            version = version_numbers[0]
            logger.info(f"Using latest version: {version}")

        # Get schedules only if a valid version is specified or exists
        schedules = []
        if version is not None:
            schedule_query = Schedule.query.filter(Schedule.version == version)  # type: ignore
            if start_date_obj is not None:
                schedule_query = schedule_query.filter(Schedule.date >= start_date_obj)  # type: ignore
            if end_date_obj is not None:
                schedule_query = schedule_query.filter(Schedule.date <= end_date_obj)  # type: ignore
            
            schedules = schedule_query.all()

            # Apply include_empty filter after database query
            if not include_empty:
                schedules = [s for s in schedules if s.shift_id is not None]

        # Get version metadata for the current version if it exists
        current_version_meta = None
        if version is not None:
            meta = ScheduleVersionMeta.query.filter_by(version=version).first()  # type: ignore
            if meta:
                current_version_meta = meta.to_dict()

        return jsonify(
            {
                "schedules": [
                    {
                        "id": schedule.id,
                        "date": schedule.date.strftime("%Y-%m-%d"),
                        "employee_id": schedule.employee.id,
                        "employee_name": f"{schedule.employee.first_name} {schedule.employee.last_name}",
                        "shift_id": schedule.shift.id if schedule.shift else None,
                        "shift_start": schedule.shift.start_time
                        if schedule.shift
                        else None,
                        "shift_end": schedule.shift.end_time
                        if schedule.shift
                        else None,
                        "break_start": schedule.break_start,
                        "break_end": schedule.break_end,
                        "notes": schedule.notes,
                        "version": schedule.version,
                        "is_empty": not bool(schedule.shift_id),
                    }
                    for schedule in schedules
                ],
                "versions": version_numbers,
                "version_statuses": version_statuses,
                "current_version": version,
                "version_meta": current_version_meta,
                "errors": [],
            }
        ), HTTPStatus.OK

    except Exception as e:
        logger.error(f"Error in get_schedules: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/generate_disabled_by_ai_dev_helper", methods=["POST"])
def generate_schedule():
    """Generate a new schedule for the given date range"""
    try:
        data = request.get_json()
        if not data or "start_date" not in data or "end_date" not in data:
            return jsonify(
                {"error": "Missing required fields: start_date and end_date"}
            ), HTTPStatus.BAD_REQUEST

        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Invalid date format. Use YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Delete existing schedules for the period
        if start_date is not None and end_date is not None:
            Schedule.query.filter(Schedule.date >= start_date, Schedule.date <= end_date).delete() # type: ignore

        # Ensure we're in an application context
        with current_app.app_context():
            # Generate new schedules
            generator = ScheduleGenerator()
            # # Setup logging to DEBUG level for diagnostic output
            # # This will create the console, main file, app, and diagnostic handlers
            # try:
            #     log_dir = current_app.config.get("SCHEDULER_LOG_DIR", None) # Optional: Get custom log dir from config
            #     app_log_dir = current_app.config.get("APP_LOG_DIR", None) # Optional: Get custom app log dir from config
            #     generator.logging_manager.setup_logging(\
            #         log_level=logging.DEBUG, \
            #         log_to_file=True, \
            #         log_dir=log_dir, \
            #         app_log_dir=app_log_dir\
            #     )
            # except Exception as log_setup_err:
            #     # Log error during setup but don't necessarily stop generation
            #     logger.error(f"Failed to setup scheduler logging: {log_setup_err}", exc_info=True)

            result = generator.generate_schedule(start_date, end_date)

            # Check if there was an error
            if "error" in result:
                return jsonify({"error": result["error"]}), 500

            # Get the schedules from the result
            schedules = result.get("schedule", [])

            # Process and save schedules
            saved_schedules = []
            for schedule_data in schedules:
                # Create a new Schedule object
                schedule = Schedule(
                    employee_id=schedule_data["employee_id"],
                    shift_id=schedule_data["shift_id"],
                    date=datetime.strptime(schedule_data["date"], "%Y-%m-%d").date(),
                    notes=schedule_data.get("notes", ""),
                )
                db.session.add(schedule)
                saved_schedules.append(schedule)

            db.session.commit()

            return jsonify(
                {
                    "message": "Schedule generated successfully",
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d"),
                    "total_shifts": len(schedules),
                    "errors": result.get("errors", []),
                    "schedules": [
                        {
                            "id": schedule.id,
                            "date": schedule.date.strftime("%Y-%m-%d"),
                            "employee": {
                                "id": schedule.employee.id,
                                "name": f"{schedule.employee.first_name} {schedule.employee.last_name}",
                            },
                            "shift": {
                                "id": schedule.shift.id,
                                "start_time": schedule.shift.start_time,
                                "end_time": schedule.shift.end_time,
                            },
                            "break_start": schedule.break_start,
                            "break_end": schedule.break_end,
                            "notes": schedule.notes,
                        }
                        for schedule in saved_schedules
                    ],
                }
            ), HTTPStatus.CREATED

    except ScheduleGenerationError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST

    except Exception as e:
        db.session.rollback()
        logger.error(f"Schedule generation error: {str(e)}")
        return jsonify(
            {"error": "Could not generate schedule", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


def _generate_day_schedule(
    current_date: date,
    employees: List[Employee],
    shifts: List[ShiftTemplate],
    store_config: Settings,
) -> List[Schedule]:
    """Generate schedule for a single day"""
    day_schedules = []

    # Sort shifts by start time
    sorted_shifts = sorted(shifts, key=lambda x: x.start_time)
    # Track employee hours
    employee_hours = {emp.id: 0.0 for emp in employees}

    # Get coverage requirements for this day
    coverage_data = Coverage.query.filter_by(day_index=current_date.weekday()).all()

    for shift in sorted_shifts:
        # Get coverage requirements for this shift
        coverage = next(
            (
                c
                for c in coverage_data
                if c.start_time == shift.start_time and c.end_time == shift.end_time
            ),
            None,
        )

        # Find available employees for this shift
        available_employees = [
            emp
            for emp in employees
            if _can_work_shift(emp, shift, current_date, {k.value: v for k, v in employee_hours.items()})
        ]

        # Assign employees to shift
        required_employees = (
            coverage.min_employees if coverage else len(available_employees)
        )
        for _ in range(required_employees):
            if not available_employees:
                break

            # Check if keyholder is required
            needs_keyholder = coverage and coverage.requires_keyholder
            has_keyholder = any(
                e.is_keyholder == True for e in day_schedules if e.shift_id == shift.id
            )

            if needs_keyholder and not has_keyholder:
                # Try to find a keyholder first
                keyholder = next(
                    (emp for emp in available_employees if emp.is_keyholder is True), None
                )
                if keyholder:
                    employee = keyholder
                else:
                    # If no keyholder available, skip this shift
                    break
            else:
                employee = available_employees[0]

            # Create schedule entry
            schedule = Schedule(
                date=current_date, employee_id=employee.id, shift_id=shift.id
            )

            # Add break if shift is long enough
            if shift.requires_break:
                # Calculate break time (middle of shift)
                start_hour, start_min = map(int, shift.start_time.split(":"))
                end_hour, end_min = map(int, shift.end_time.split(":"))
                total_minutes = (end_hour * 60 + end_min) - (
                    start_hour * 60 + start_min
                )
                mid_point_minutes = total_minutes // 2
                break_hour = start_hour + (start_min + mid_point_minutes) // 60
                break_minute = (start_min + mid_point_minutes) % 60

                schedule.break_start = f"{break_hour:02d}:{break_minute:02d}"
                schedule.break_end = (
                    f"{(break_hour + 1):02d}:{break_minute:02d}"  # 1-hour break
                )

            day_schedules.append(schedule)

            # Update employee hours and remove from available list
            employee_hours[employee.id] += shift.duration_hours
            available_employees.remove(employee)

    return day_schedules


def _can_work_shift(
    employee: Employee,
    shift: ShiftTemplate,
    current_date: date,
    employee_hours: Dict[int, float],
) -> bool:
    """Check if an employee can work a shift"""
    # Get coverage requirements for this time slot
    coverage = Coverage.query.filter_by(
        day_index=current_date.weekday(),
        start_time=shift.start_time,
        end_time=shift.end_time,
    ).first()
    # If coverage requires a keyholder and employee is not one, they can't work
    if coverage and coverage.requires_keyholder and not employee.is_keyholder:
        return False

    # Check if employee has already worked today
    if Schedule.query.filter_by(employee_id=employee.id, date=current_date).first():  # type: ignore
        return False

    # Check if employee has worked yesterday's closing shift
    yesterday = current_date - timedelta(days=1)
    yesterday_schedule = Schedule.query.filter_by(
        employee_id=employee.id, date=yesterday
    ).first()
    if yesterday_schedule:
        yesterday_shift = db.session.get(ShiftTemplate, yesterday_schedule.shift_id)
        if yesterday_shift and int(yesterday_shift.end_time.split(":")[0]) >= 18:
            # Don't schedule for early shift after late shift
            if int(shift.start_time.split(":")[0]) <= 9:
                return False

    # Check weekly hours
    week_start = current_date - timedelta(days=current_date.weekday())
    week_hours = employee_hours.get(employee.id, 0.0)

    # Add hours from previous days this week
    week_schedules_query = (Schedule.query.filter(  # type: ignore
        Schedule.employee_id == employee.id,  # type: ignore
        Schedule.date >= week_start,  # type: ignore
        Schedule.date < current_date)  # type: ignore
                           )
    week_schedules = week_schedules_query.all()
    for schedule in week_schedules:
        schedule_shift = db.session.get(ShiftTemplate, schedule.shift_id)  # type: ignore
        if schedule_shift:
            week_hours += schedule_shift.duration_hours

    # Check if adding this shift would exceed weekly limits
    if employee.employee_group == EmployeeGroup.GFB:
        # GFB employees limited to 10 hours per week
        if week_hours + shift.duration_hours > 10:
            return False
    elif employee.employee_group == EmployeeGroup.TZ:
        # Part-time employees limited to contracted hours
        if week_hours + shift.duration_hours > employee.contracted_hours:
            return False
    else:
        # Full-time employees limited to 40 hours per week
        if week_hours + shift.duration_hours > 40:
            return False

    return True


@bp.route("/export", methods=["POST"])
def export_schedule():
    """Export schedule as PDF"""
    try:
        data = request.get_json()
        start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()

        # Get schedules for the period
        schedules = (Schedule.query.filter(Schedule.date >= start_date, Schedule.date <= end_date)  # type: ignore
                     .order_by(Schedule.date, Schedule.shift_id)  # type: ignore
                     .all())

        # Create PDF
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=pagesizes.landscape(pagesizes.A4))

        # Add header
        p.setFont("Helvetica-Bold", 14)
        p.drawString(1 * inch, 7.5 * inch, f"Schedule: {start_date} to {end_date}")

        # Add column headers
        p.setFont("Helvetica-Bold", 12)
        headers = ["Date", "Employee", "Shift", "Time", "Break"]
        x_positions = [1 * inch, 2.5 * inch, 4.5 * inch, 6 * inch, 7.5 * inch]
        y_position = 7 * inch

        for header, x in zip(headers, x_positions):
            p.drawString(x, y_position, header)

        # Add schedule entries
        p.setFont("Helvetica", 10)
        entries_per_page = 30
        entry_count = 0

        for schedule in schedules:
            if entry_count >= entries_per_page:
                p.showPage()
                entry_count = 0
                y_position = 7 * inch

                # Add headers to new page
                p.setFont("Helvetica-Bold", 12)
                for header, x in zip(headers, x_positions):
                    p.drawString(x, y_position, header)
                p.setFont("Helvetica", 10)

            y_position -= 0.3 * inch
            entry_count += 1

            # Date
            p.drawString(1 * inch, y_position, schedule.date.strftime("%Y-%m-%d"))

            # Employee
            p.drawString(
                2.5 * inch,
                y_position,
                f"{schedule.employee.first_name} {schedule.employee.last_name}",
            )

            # Shift
            p.drawString(4.5 * inch, y_position, schedule.shift.shift_type.value)

            # Time
            p.drawString(
                6 * inch,
                y_position,
                f"{schedule.shift.start_time.strftime('%H:%M')}-"
                f"{schedule.shift.end_time.strftime('%H:%M')}",
            )

            # Break
            if schedule.break_start and schedule.break_end:
                p.drawString(
                    7.5 * inch,
                    y_position,
                    f"{schedule.break_start.strftime('%H:%M')}-"
                    f"{schedule.break_end.strftime('%H:%M')}",
                )

        p.save()
        buffer.seek(0)

        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"schedule_{start_date}_{end_date}.pdf",
            mimetype="application/pdf",
        )

    except Exception as e:
        return jsonify(
            {"error": "Could not export schedule", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


def test_schedule_generation(client, app):
    """Test schedule generation"""
    # Create test data
    with app.app_context():
        # Create store config
        store_config = Settings(
            opening_time="08:00",
            closing_time="20:00", 
            break_duration=60
        )
        db.session.add(store_config)

        # Create shifts
        opening_shift = ShiftTemplate(
            start_time="08:00",
            end_time="16:00",
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        )

        middle_shift = ShiftTemplate(
            start_time="10:00",
            end_time="18:00",
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        )

        closing_shift = ShiftTemplate(
            start_time="12:00",
            end_time="20:00",
            min_employees=2,
            max_employees=3,
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        )

        db.session.add_all([opening_shift, middle_shift, closing_shift])

        # Create employees
        keyholder1 = Employee(
            first_name="Key",
            last_name="Holder 1",
            employee_group=EmployeeGroup.VZ,  # Assuming 'group' maps to 'employee_group'
            contracted_hours=40, # Assuming 'max_hours_per_week' maps to 'contracted_hours'
            is_keyholder=True,
        )

        keyholder2 = Employee(
            first_name="Key",
            last_name="Holder 2",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40,
            is_keyholder=True,
        )

        employee1 = Employee(
            first_name="Employee",
            last_name="1",
            employee_group=EmployeeGroup.TZ,
            contracted_hours=30,
            is_keyholder=False,
        )

        employee2 = Employee(
            first_name="Employee",
            last_name="2",
            employee_group=EmployeeGroup.TZ,
            contracted_hours=30,
            is_keyholder=False,
        )

        db.session.add_all([keyholder1, keyholder2, employee1, employee2])
        db.session.commit()

        # Test schedule generation
        response = client.post(
            "/api/schedules/generate",
            json={
                "start_date": "2024-01-01",  # Monday
                "end_date": "2024-01-07",  # Sunday
            },
        )

        assert response.status_code == 200
        schedules = response.json["schedules"]

        # Verify schedules
        for schedule in schedules:
            shift = next(
                s
                for s in [opening_shift, middle_shift, closing_shift]
                if s.id == schedule["shift_id"]
            )
            employee = next(
                e
                for e in [keyholder1, keyholder2, employee1, employee2]
                if e.id == schedule["employee_id"]
            )

            # Check opening/closing shift assignments
            if shift.start_time <= "09:00":  # Opening shift
                assert employee.is_keyholder == True
            elif shift.end_time >= "18:00":  # Closing shift
                assert employee.is_keyholder == True

            # Check break assignments for long shifts
            if shift.requires_break:
                assert "break_start" in schedule
                assert "break_end" in schedule

            # Check shift hours against store hours
            assert shift.start_time >= store_config.store_opening
            assert shift.end_time <= store_config.store_closing


@bp.route("/versions", methods=["GET"])
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

        # Get all version metadata
        version_metas_query = (ScheduleVersionMeta.query.filter(  # type: ignore
            ScheduleVersionMeta.date_range_start <= end_of_week,  # type: ignore
            ScheduleVersionMeta.date_range_end >= start_of_week)  # type: ignore
                               .order_by(ScheduleVersionMeta.version.desc()))  # type: ignore
        version_metas = version_metas_query.all()

        # If no versions exist, return empty list
        if not version_metas:
            # Try to find versions from schedules table as a fallback
            schedule_versions_query = (db.session.query(Schedule.version)  # type: ignore
                                       .filter(Schedule.date >= start_of_week, Schedule.date <= end_of_week)  # type: ignore
                                       .distinct()
                                       .order_by(Schedule.version.desc()))  # type: ignore
            schedule_versions = schedule_versions_query.all()

            # If we found versions in schedules, create metadata for them
            all_metas = []
            for (v,) in schedule_versions:
                # Get date range for this version from schedules
                date_info = (
                    db.session.query(
                        db.func.min(Schedule.date), db.func.max(Schedule.date)
                    )
                    .filter(Schedule.version == v)
                    .first()
                )

                if date_info and date_info[0] and date_info[1]:
                    # Create a temporary metadata object (doesn't save to DB)
                    meta = ScheduleVersionMeta(
                        version=v,
                        status=ScheduleStatus.DRAFT,
                        date_range_start=date_info[0],
                        date_range_end=date_info[1],
                        notes=f"Auto-generated metadata for version {v}",
                    )
                    all_metas.append(meta)

            # Return any versions we found from schedules
            if all_metas:
                return jsonify(
                    {
                        "versions": [m.to_dict() for m in all_metas],
                        "date_range": {
                            "start": start_of_week.isoformat(),
                            "end": end_of_week.isoformat(),
                            "week": start_of_week.isocalendar()[1],
                        },
                    }
                )

            # No versions found at all, return empty list
            return jsonify(
                {
                    "versions": [],
                    "date_range": {
                        "start": start_of_week.isoformat(),
                        "end": end_of_week.isoformat(),
                        "week": start_of_week.isocalendar()[1],
                    },
                }
            )

        # Return version information
        return jsonify(
            {
                "versions": [v.to_dict() for v in version_metas],
                "date_range": {
                    "start": start_of_week.isoformat(),
                    "end": end_of_week.isoformat(),
                    "week": start_of_week.isocalendar()[1],
                },
            }
        )
    except Exception as e:
        logger.error(f"Error fetching versions: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/version", methods=["POST"])
def create_new_version():
    """Create a new schedule version, optionally based on an existing version."""
    try:
        data = request.get_json()
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        base_version = data.get("base_version")
        notes = data.get("notes", "")
        create_empty = data.get("create_empty_schedules", True)

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
        max_schedule_version_query = (db.session.query(db.func.max(Schedule.version)))  # type: ignore
        max_schedule_version = max_schedule_version_query.scalar() or 0
        max_meta_version_query = (db.session.query(db.func.max(ScheduleVersionMeta.version)))  # type: ignore
        max_meta_version = max_meta_version_query.scalar() or 0
        new_version = max(max_schedule_version, max_meta_version) + 1

        # Check if a version already exists for this date range
        existing_version_query = (ScheduleVersionMeta.query.filter(  # type: ignore
            ScheduleVersionMeta.date_range_start == start_date,  # type: ignore
            ScheduleVersionMeta.date_range_end == end_date,  # type: ignore
            ScheduleVersionMeta.status != ScheduleStatus.ARCHIVED)
                                 )
        existing_version = existing_version_query.first()

        # If a version exists for this date range, create a new incremented version
        if existing_version:
            logger.info(
                f"Version already exists for date range {start_date} - {end_date}: {existing_version.version}"
            )
            # We'll continue with our new version number - no changes needed as we already incremented

        logger.info(
            f"Creating new version {new_version} (max schedule version: {max_schedule_version}, max meta version: {max_meta_version})"
            + (f" based on version {base_version}" if base_version else "")
        )

        # Create version metadata
        try:
            version_meta = ScheduleVersionMeta(
                version=new_version,
                created_at=datetime.utcnow(),
                created_by=None,  # TODO: Add user ID once authentication is implemented
                status=ScheduleStatus.DRAFT,
                date_range_start=start_date,
                date_range_end=end_date,
                base_version=base_version,
                notes=notes,
            )
            db.session.add(version_meta)
            db.session.commit()
            logger.info(f"Created version metadata for version {new_version}")

            # If base_version is provided, copy schedules from that version
            if base_version:
                base_schedules = Schedule.query.filter_by(version=base_version).all()  # type: ignore

                # Only copy if base schedules exist
                if base_schedules:
                    for base_schedule in base_schedules:
                        # Skip if the date is outside our new range
                        if (
                            base_schedule.date < start_date
                            or base_schedule.date > end_date
                        ):
                            continue

                        new_schedule = Schedule(
                            date=base_schedule.date,
                            employee_id=base_schedule.employee_id,
                            shift_id=base_schedule.shift_id,
                            version=new_version,
                            status=ScheduleStatus.DRAFT,
                            break_start=base_schedule.break_start,
                            break_end=base_schedule.break_end,
                            notes=base_schedule.notes,
                        )
                        db.session.add(new_schedule)

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
            db.session.rollback()
            logger.error(f"Could not create version metadata: {str(e)}")
            return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        logger.error(f"Error creating new version: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/version/<int:version>/status", methods=["PUT"])
def update_version_status(version):
    """Update a schedule's status (DRAFT, PUBLISHED, ARCHIVED)"""
    try:
        data = request.get_json()
        new_status_str = data.get("status")

        if not new_status_str:
            return jsonify({"error": "Status is required"}), HTTPStatus.BAD_REQUEST

        try:
            new_status = ScheduleStatus(new_status_str)
        except ValueError:
            return jsonify(
                {"error": f"Invalid status: {new_status_str}"}
            ), HTTPStatus.BAD_REQUEST

        # Get all schedules for this version
        schedules = Schedule.query.filter_by(version=version).all()  # type: ignore

        if not schedules:
            return jsonify(
                {"error": "Schedule version not found"}
            ), HTTPStatus.NOT_FOUND

        # Get version metadata
        version_meta = db.session.get(ScheduleVersionMeta, version)  # type: ignore

        if not version_meta:
            return jsonify(
                {"error": "Version metadata not found"}
            ), HTTPStatus.NOT_FOUND

        # Check for valid state transitions
        current_status = version_meta.status
        valid_transitions = {
            ScheduleStatus.DRAFT: [ScheduleStatus.PUBLISHED, ScheduleStatus.ARCHIVED],
            ScheduleStatus.PUBLISHED: [ScheduleStatus.ARCHIVED],
            ScheduleStatus.ARCHIVED: [],  # Cannot transition from archived
        }

        if new_status not in valid_transitions[current_status]:
            return jsonify(
                {
                    "error": f"Invalid state transition from {current_status.value} to {new_status_str}"
                }
            ), HTTPStatus.BAD_REQUEST

        try:
            # Update status for all schedules in this version
            for schedule in schedules:
                schedule.status = new_status

            # Update version metadata
            version_meta.status = new_status
            version_meta.updated_at = datetime.utcnow()

            # Commit the changes
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
            logger.error(f"Error updating version status: {str(e)}")
            return jsonify(
                {"error": f"Database error: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        logger.error(f"Error in update_version_status: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/version/<int:version>/details", methods=["GET"])
def get_version_details(version):
    """Get detailed information about a specific schedule version."""
    try:
        # Check if version exists
        schedules = Schedule.query.filter_by(version=version).all()  # type: ignore

        # Get version metadata
        version_meta = db.session.get(ScheduleVersionMeta, version)  # type: ignore

        if not version_meta:
            return jsonify(
                {"error": "Version metadata not found"}
            ), HTTPStatus.NOT_FOUND

        # Collect basic stats
        dates = []
        employees = set()
        if schedules:
            dates = sorted(list(set(s.date for s in schedules)))
            employees = set(s.employee_id for s in schedules)

        # Build response
        response = {
            "version": version,
            "status": version_meta.status.value,
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
            "schedule_count": len(schedules),
            "employees_count": len(employees),
            "days_count": len(dates),
        }

        return jsonify(response)

    except Exception as e:
        logger.error(f"Error getting version details: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/version/duplicate", methods=["POST"])
def duplicate_version():
    """Create a duplicate of an existing schedule version with a new version number."""
    try:
        data = request.get_json()
        source_version = data.get("source_version")
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        notes = data.get("notes", "")

        # Validate required parameters
        if not source_version or not start_date or not end_date:
            return jsonify(
                {"error": "source_version, start_date, and end_date are required"}
            ), HTTPStatus.BAD_REQUEST

        # Parse dates
        try:
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Invalid date format, expected YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Get source schedules
        source_schedules = Schedule.query.filter_by(version=source_version).all()  # type: ignore
        if not source_schedules:
            return jsonify(
                {"error": f"Source version {source_version} not found"}
            ), HTTPStatus.NOT_FOUND

        # Get source metadata
        source_meta = db.session.get(ScheduleVersionMeta, source_version)  # type: ignore

        # Get next version number
        max_schedule_version_query = (db.session.query(db.func.max(Schedule.version)))  # type: ignore
        max_schedule_version = max_schedule_version_query.scalar() or 0
        max_meta_version_query = (db.session.query(db.func.max(ScheduleVersionMeta.version)))  # type: ignore
        max_meta_version = max_meta_version_query.scalar() or 0
        new_version = max(max_schedule_version, max_meta_version) + 1

        try:
            # Create new version metadata
            new_meta = ScheduleVersionMeta(
                version=new_version,
                created_at=datetime.utcnow(),
                status=ScheduleStatus.DRAFT,
                date_range_start=start_date,
                date_range_end=end_date,
                base_version=source_version,
                notes=notes or f"Duplicated from version {source_version}",
            )
            db.session.add(new_meta)

            # Duplicate schedules
            for schedule in source_schedules:
                # Skip if the date is outside our new range
                if schedule.date < start_date or schedule.date > end_date:
                    continue

                new_schedule = Schedule(
                    date=schedule.date,
                    employee_id=schedule.employee_id,
                    shift_id=schedule.shift_id,
                    version=new_version,
                    status=ScheduleStatus.DRAFT,
                    break_start=schedule.break_start,
                    break_end=schedule.break_end,
                    notes=schedule.notes,
                )
                db.session.add(new_schedule)

            db.session.commit()

            return jsonify(
                {
                    "message": f"Version {source_version} duplicated successfully",
                    "version": new_version,
                    "status": "DRAFT",
                    "version_meta": new_meta.to_dict()
                    if hasattr(new_meta, "to_dict")
                    else None,
                }
            )

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error duplicating version: {str(e)}")
            return jsonify(
                {"error": f"Database error: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        logger.error(f"Error in duplicate_version: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/version/<int:version>", methods=["DELETE"])
def delete_version(version):
    """Delete a schedule version and all associated schedules.

    This will delete:
    1. All schedule entries for this version
    2. Version metadata
    """
    try:
        # Check if version exists
        schedules = Schedule.query.filter_by(version=version).all()  # type: ignore
        version_meta = db.session.get(ScheduleVersionMeta, version)  # type: ignore

        if not schedules and not version_meta:
            return jsonify(
                {"error": f"Version {version} not found"}
            ), HTTPStatus.NOT_FOUND

        try:
            # Start a transaction
            db.session.begin_nested()

            # Delete all schedules for this version
            if schedules:
                deleted_count = 0
                for schedule in schedules:
                    db.session.delete(schedule)
                    deleted_count += 1

                logger.info(
                    f"Deleted {deleted_count} schedule entries for version {version}"
                )

            # Delete version metadata
            if version_meta:
                db.session.delete(version_meta)
                logger.info(f"Deleted version metadata for version {version}")

            # Commit the transaction
            db.session.commit()

            return jsonify(
                {
                    "message": f"Version {version} deleted successfully",
                    "deleted_schedules_count": len(schedules) if schedules else 0,
                }
            )

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error deleting version {version}: {str(e)}")
            return jsonify(
                {"error": f"Database error: {str(e)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR

    except Exception as e:
        logger.error(f"Error in delete_version: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/", methods=["POST"])
def create_schedule():
    """Create a new schedule entry using transactional session management"""
    from ..utils.db_utils import session_manager
    
    # Validate input before doing database operations
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ["employee_id", "date", "version"]
        for field in required_fields:
            if field not in data:
                return jsonify(
                    {"error": f"Missing required field: {field}"}
                ), HTTPStatus.BAD_REQUEST

        # Parse date
        try:
            date_obj = datetime.strptime(data["date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {"error": "Invalid date format. Use YYYY-MM-DD"}
            ), HTTPStatus.BAD_REQUEST

        # Create new schedule
        schedule = Schedule(
            employee_id=data["employee_id"],
            shift_id=data.get("shift_id"),
            date=date_obj,
            version=data["version"],
            break_start=data.get("break_start"),
            break_end=data.get("break_end"),
            notes=data.get("notes"),
            shift_type=data.get("shift_type"),
            status=ScheduleStatus.DRAFT,
        )

        # Use session_manager context for automatic transaction handling
        with session_manager() as session:
            session.add(schedule)
            # Commit happens automatically at the end of the context
            # Rollback happens automatically if an exception occurs

        logger.info(
            f"Created new schedule for employee {data['employee_id']} on {data['date']}"
        )

        return jsonify(schedule.to_dict()), HTTPStatus.CREATED

    except SQLAlchemyError as e:
        # Database-specific errors (already handled by session_manager)
        logger.error(f"Database error creating schedule: {str(e)}")
        return jsonify(
            {"error": f"Database error: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
    except Exception as e:
        # General errors
        logger.error(f"Error in create_schedule: {str(e)}")
        return jsonify(
            {"error": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
