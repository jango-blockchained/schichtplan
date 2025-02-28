from flask import Blueprint, request, jsonify, send_file
from models import db, Schedule, Employee, Shift, Settings, EmployeeGroup
from http import HTTPStatus
from datetime import datetime, timedelta, date
import calendar
from typing import List, Dict
from io import BytesIO
import reportlab.lib.pagesizes as pagesizes
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from flask import current_app

bp = Blueprint("schedules", __name__, url_prefix="/api/schedules")


def get_next_month_dates():
    today = date.today()
    next_month = today.replace(day=1) + timedelta(days=32)
    next_month = next_month.replace(day=1)
    last_day = calendar.monthrange(next_month.year, next_month.month)[1]
    return next_month, next_month.replace(day=last_day)


@bp.route("/", methods=["GET"])
def get_schedules():
    """Get all schedules for a given period"""
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = Schedule.query

    if start_date:
        query = query.filter(
            Schedule.date >= datetime.strptime(start_date, "%Y-%m-%d").date()
        )
    if end_date:
        query = query.filter(
            Schedule.date <= datetime.strptime(end_date, "%Y-%m-%d").date()
        )

    schedules = query.all()

    return jsonify(
        [
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
            }
            for schedule in schedules
        ]
    ), HTTPStatus.OK


@bp.route("/generate", methods=["POST"])
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
        Schedule.query.filter(
            Schedule.date >= start_date, Schedule.date <= end_date
        ).delete()

        # Ensure we're in an application context
        with current_app.app_context():
            # Generate new schedules
            generator = ScheduleGenerator()
            schedules, errors = generator.generate_schedule(start_date, end_date)

            # Save all schedules
            for schedule in schedules:
                db.session.add(schedule)

            db.session.commit()

            return jsonify(
                {
                    "message": "Schedule generated successfully",
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d"),
                    "total_shifts": len(schedules),
                    "errors": errors,
                }
            ), HTTPStatus.CREATED

    except ScheduleGenerationError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Schedule generation error: {str(e)}")
        return jsonify(
            {"error": "Could not generate schedule", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


def _generate_day_schedule(
    current_date: date,
    employees: List[Employee],
    shifts: List[Shift],
    store_config: Settings,
) -> List[Schedule]:
    """Generate schedule for a single day"""
    day_schedules = []

    # Sort shifts by start time
    sorted_shifts = sorted(shifts, key=lambda x: x.start_time)

    # Track employee hours
    employee_hours = {emp.id: 0 for emp in employees}

    for shift in sorted_shifts:
        # Determine number of employees needed for this shift
        if current_date.weekday() in [1, 3]:  # Tuesday and Thursday
            required_employees = shift.max_employees
        else:
            required_employees = max(
                shift.min_employees, (shift.max_employees + shift.min_employees) // 2
            )

        # Find available employees for this shift
        available_employees = [
            emp
            for emp in employees
            if _can_work_shift(emp, shift, current_date, employee_hours)
        ]

        # Assign employees to shift
        for _ in range(required_employees):
            if not available_employees:
                break

            # Prioritize keyholders for opening and closing shifts
            start_hour = int(shift.start_time.split(":")[0])
            end_hour = int(shift.end_time.split(":")[0])
            is_opening = start_hour <= 9  # Opening shifts start at or before 9 AM
            is_closing = end_hour >= 18  # Closing shifts end at or after 6 PM

            if is_opening or is_closing:
                keyholder = next(
                    (emp for emp in available_employees if emp.is_keyholder), None
                )
                if keyholder:
                    employee = keyholder
                else:
                    employee = available_employees[0]
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
    shift: Shift,
    current_date: date,
    employee_hours: Dict[int, float],
) -> bool:
    """Check if employee can work the given shift"""
    # Check weekly hours limit
    week_start = current_date - timedelta(days=current_date.weekday())
    weekly_hours = (
        Schedule.query.filter(
            Schedule.employee_id == employee.id,
            Schedule.date >= week_start,
            Schedule.date <= current_date,
        )
        .join(Shift)
        .with_entities(
            db.func.sum(
                db.func.cast(
                    (
                        db.func.strftime("%H", Shift.end_time)
                        + db.func.strftime("%M", Shift.end_time) / 60.0
                    )
                    - (
                        db.func.strftime("%H", Shift.start_time)
                        + db.func.strftime("%M", Shift.start_time) / 60.0
                    ),
                    db.Float,
                )
            )
        )
        .scalar()
        or 0
    )

    weekly_hours += employee_hours.get(employee.id, 0)

    if employee.employee_group in [EmployeeGroup.VZ, EmployeeGroup.TL]:
        if weekly_hours + shift.duration_hours > 40:
            return False
    elif employee.employee_group == EmployeeGroup.TZ:
        if weekly_hours + shift.duration_hours > employee.contracted_hours:
            return False
    else:  # GFB
        # Check monthly hours
        month_start = date(current_date.year, current_date.month, 1)
        monthly_hours = (
            Schedule.query.filter(
                Schedule.employee_id == employee.id,
                Schedule.date >= month_start,
                Schedule.date <= current_date,
            )
            .join(Shift)
            .with_entities(
                db.func.sum(
                    db.func.cast(
                        (
                            db.func.strftime("%H", Shift.end_time)
                            + db.func.strftime("%M", Shift.end_time) / 60.0
                        )
                        - (
                            db.func.strftime("%H", Shift.start_time)
                            + db.func.strftime("%M", Shift.start_time) / 60.0
                        ),
                        db.Float,
                    )
                )
            )
            .scalar()
            or 0
        )

        if monthly_hours + shift.duration_hours > 40:
            return False

    # Check if already working that day
    if Schedule.query.filter(
        Schedule.employee_id == employee.id, Schedule.date == current_date
    ).first():
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
        schedules = (
            Schedule.query.filter(
                Schedule.date >= start_date, Schedule.date <= end_date
            )
            .order_by(Schedule.date, Schedule.shift_id)
            .all()
        )

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
            store_opening="08:00", store_closing="20:00", break_duration_minutes=60
        )
        db.session.add(store_config)

        # Create shifts
        opening_shift = Shift(
            start_time="08:00",
            end_time="16:00",
            min_employees=2,
            max_employees=3,
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        )

        middle_shift = Shift(
            start_time="10:00",
            end_time="18:00",
            min_employees=2,
            max_employees=4,
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        )

        closing_shift = Shift(
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
            name="Key Holder 1",
            group=EmployeeGroup.VZ,
            is_keyholder=True,
            max_hours_per_week=40,
        )

        keyholder2 = Employee(
            name="Key Holder 2",
            group=EmployeeGroup.VZ,
            is_keyholder=True,
            max_hours_per_week=40,
        )

        employee1 = Employee(
            name="Employee 1",
            group=EmployeeGroup.TZ,
            is_keyholder=False,
            max_hours_per_week=30,
        )

        employee2 = Employee(
            name="Employee 2",
            group=EmployeeGroup.TZ,
            is_keyholder=False,
            max_hours_per_week=30,
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
                assert employee.is_keyholder
            elif shift.end_time >= "18:00":  # Closing shift
                assert employee.is_keyholder

            # Check break assignments for long shifts
            if shift.requires_break:
                assert "break_start" in schedule
                assert "break_end" in schedule

            # Check shift hours against store hours
            assert shift.start_time >= store_config.store_opening
            assert shift.end_time <= store_config.store_closing
