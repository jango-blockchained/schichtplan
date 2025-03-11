#!/usr/bin/env python
"""
Tests for schedule generation with different constraints and edge cases.
This test suite focuses on testing how the schedule generator handles various constraints
such as employee availability, shift requirements, and business rules.
"""

import sys
import logging
from datetime import datetime, timedelta

from app import create_app
from models.fixed_shift import ShiftTemplate
from models.employee import Employee
from models.settings import Settings
from models.availability import Availability
from services.scheduler.generator import ScheduleGenerator
from models import db

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def get_next_monday():
    """Get the date of the next Monday."""
    today = datetime.now().date()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # If today is Monday, get next Monday
    return today + timedelta(days=days_ahead)


def test_keyholder_constraint():
    """Test that the schedule generator respects the keyholder constraint."""
    logger.info("=== KEYHOLDER CONSTRAINT TEST ===")

    app = create_app()
    with app.app_context():
        # Get or create settings
        settings = Settings.query.first()
        if not settings:
            settings = Settings(
                store_opening="08:00", store_closing="20:00", break_duration_minutes=60
            )
            db.session.add(settings)

        # Save original settings
        original_require_keyholder = settings.require_keyholder

        try:
            # Enable keyholder requirement
            settings.require_keyholder = True
            db.session.commit()

            # Get all employees
            employees = Employee.query.all()

            # Save original keyholder status
            original_keyholder_status = {emp.id: emp.is_keyholder for emp in employees}

            # Set all employees as non-keyholders
            for emp in employees:
                emp.is_keyholder = False

            # Make one employee a keyholder
            if employees:
                employees[0].is_keyholder = True

            db.session.commit()

            # Calculate dates for next week
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing keyholder constraint for period: {start_date} to {end_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])

            # Check if each day has at least one keyholder
            days_with_schedules = set()
            days_with_keyholders = set()

            for schedule in schedules:
                if not schedule.get("is_empty") and schedule.get("shift_id"):
                    schedule_date = schedule.get("date")
                    days_with_schedules.add(schedule_date)

                    # Check if this is a keyholder
                    employee_id = schedule.get("employee_id")
                    employee = Employee.query.get(employee_id)

                    if employee and employee.is_keyholder:
                        days_with_keyholders.add(schedule_date)

            # Log results
            logger.info(f"Days with schedules: {len(days_with_schedules)}")
            logger.info(f"Days with keyholders: {len(days_with_keyholders)}")

            # Check if all days with schedules have at least one keyholder
            missing_keyholder_days = days_with_schedules - days_with_keyholders
            if missing_keyholder_days:
                logger.warning(f"Days missing keyholders: {missing_keyholder_days}")

            # Check for keyholder warnings
            keyholder_warnings = [w for w in warnings if "keyholder" in str(w).lower()]
            logger.info(f"Keyholder-related warnings: {len(keyholder_warnings)}")

            # Assert that all days with schedules have at least one keyholder
            # or there are warnings about missing keyholders
            assert len(missing_keyholder_days) == 0 or len(keyholder_warnings) > 0

            return result
        finally:
            # Restore original settings and employee status
            settings.require_keyholder = original_require_keyholder

            for emp in Employee.query.all():
                if emp.id in original_keyholder_status:
                    emp.is_keyholder = original_keyholder_status[emp.id]

            db.session.commit()


def test_weekly_hours_constraint():
    """Test that the schedule generator respects weekly hour limits."""
    logger.info("=== WEEKLY HOURS CONSTRAINT TEST ===")

    app = create_app()
    with app.app_context():
        # Get or create settings
        settings = Settings.query.first()
        if not settings:
            settings = Settings(
                store_opening="08:00", store_closing="20:00", break_duration_minutes=60
            )
            db.session.add(settings)

        # Save original settings
        original_max_weekly_hours = settings.max_weekly_hours

        try:
            # Set a strict weekly hour limit
            settings.max_weekly_hours = 20  # Very low limit to force constraints
            db.session.commit()

            # Calculate dates for next week
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing weekly hours constraint for period: {start_date} to {end_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])

            # Check employee weekly hours
            employee_hours = {}

            for schedule in schedules:
                if not schedule.get("is_empty") and schedule.get("shift_id"):
                    employee_id = schedule.get("employee_id")

                    # Get shift duration
                    shift_id = schedule.get("shift_id")
                    shift = ShiftTemplate.query.get(shift_id)

                    if shift:
                        if employee_id not in employee_hours:
                            employee_hours[employee_id] = 0

                        employee_hours[employee_id] += shift.duration_hours

            # Log results
            logger.info("Employee weekly hours:")
            for emp_id, hours in employee_hours.items():
                employee = Employee.query.get(emp_id)
                employee_name = (
                    f"{employee.first_name} {employee.last_name}"
                    if employee
                    else f"Employee {emp_id}"
                )
                logger.info(f"  {employee_name}: {hours} hours")

                # Check if hours exceed the limit
                assert hours <= settings.max_weekly_hours, (
                    f"Employee {employee_name} exceeds weekly hour limit"
                )

            # Check for hours warnings
            hours_warnings = [w for w in warnings if "hours" in str(w).lower()]
            logger.info(f"Hours-related warnings: {len(hours_warnings)}")

            return result
        finally:
            # Restore original settings
            settings.max_weekly_hours = original_max_weekly_hours
            db.session.commit()


def test_rest_time_constraint():
    """Test that the schedule generator respects minimum rest time between shifts."""
    logger.info("=== REST TIME CONSTRAINT TEST ===")

    app = create_app()
    with app.app_context():
        # Get or create settings
        settings = Settings.query.first()
        if not settings:
            settings = Settings(
                store_opening="08:00", store_closing="20:00", break_duration_minutes=60
            )
            db.session.add(settings)

        # Save original settings
        original_min_rest_hours = settings.min_rest_hours

        try:
            # Set a strict rest time requirement
            settings.min_rest_hours = 12  # Require 12 hours rest between shifts
            db.session.commit()

            # Calculate dates for next week
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing rest time constraint for period: {start_date} to {end_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])

            # Group schedules by employee
            employee_schedules = {}

            for schedule in schedules:
                if not schedule.get("is_empty") and schedule.get("shift_id"):
                    employee_id = schedule.get("employee_id")

                    if employee_id not in employee_schedules:
                        employee_schedules[employee_id] = []

                    employee_schedules[employee_id].append(schedule)

            # Check rest time between consecutive shifts for each employee
            rest_time_violations = []

            for emp_id, emp_schedules in employee_schedules.items():
                # Sort schedules by date
                emp_schedules.sort(key=lambda s: s.get("date"))

                # Check consecutive days
                for i in range(len(emp_schedules) - 1):
                    current = emp_schedules[i]
                    next_schedule = emp_schedules[i + 1]

                    # Get shift end time for current schedule
                    current_shift = ShiftTemplate.query.get(current.get("shift_id"))
                    next_shift = ShiftTemplate.query.get(next_schedule.get("shift_id"))

                    if current_shift and next_shift:
                        # Calculate end time of current shift
                        current_date = datetime.fromisoformat(current.get("date"))
                        current_end_time = datetime.strptime(
                            current_shift.end_time, "%H:%M"
                        ).time()
                        current_end = datetime.combine(
                            current_date.date(), current_end_time
                        )

                        # Calculate start time of next shift
                        next_date = datetime.fromisoformat(next_schedule.get("date"))
                        next_start_time = datetime.strptime(
                            next_shift.start_time, "%H:%M"
                        ).time()
                        next_start = datetime.combine(next_date.date(), next_start_time)

                        # Calculate rest time in hours
                        rest_time = (next_start - current_end).total_seconds() / 3600

                        if rest_time < settings.min_rest_hours:
                            employee = Employee.query.get(emp_id)
                            employee_name = (
                                f"{employee.first_name} {employee.last_name}"
                                if employee
                                else f"Employee {emp_id}"
                            )

                            violation = {
                                "employee": employee_name,
                                "current_shift": f"{current.get('date')} {current_shift.start_time}-{current_shift.end_time}",
                                "next_shift": f"{next_schedule.get('date')} {next_shift.start_time}-{next_shift.end_time}",
                                "rest_time": rest_time,
                            }

                            rest_time_violations.append(violation)

            # Log results
            if rest_time_violations:
                logger.warning(
                    f"Found {len(rest_time_violations)} rest time violations:"
                )
                for violation in rest_time_violations:
                    logger.warning(
                        f"  {violation['employee']}: {violation['current_shift']} to {violation['next_shift']} (Rest: {violation['rest_time']:.2f}h)"
                    )
            else:
                logger.info("No rest time violations found")

            # Check for rest time warnings
            rest_warnings = [w for w in warnings if "rest" in str(w).lower()]
            logger.info(f"Rest time-related warnings: {len(rest_warnings)}")

            # Assert that there are no rest time violations or there are warnings about them
            assert len(rest_time_violations) == 0 or len(rest_warnings) > 0

            return result
        finally:
            # Restore original settings
            settings.min_rest_hours = original_min_rest_hours
            db.session.commit()


def test_employee_availability_constraint():
    """Test that the schedule generator respects employee availability."""
    logger.info("=== EMPLOYEE AVAILABILITY CONSTRAINT TEST ===")

    app = create_app()
    with app.app_context():
        # Calculate dates for next week
        start_date = get_next_monday()
        end_date = start_date + timedelta(days=6)

        # Get all employees
        employees = Employee.query.all()

        if not employees:
            logger.warning("No employees found for testing")
            return None

        # Save current availabilities
        current_availabilities = list(Availability.query.all())

        try:
            # Delete all existing availabilities
            for avail in current_availabilities:
                db.session.delete(avail)

            # Create a specific unavailability for the first employee
            test_employee = employees[0]
            test_date = start_date + timedelta(days=2)  # Wednesday of the test week

            unavailability = Availability(
                employee_id=test_employee.id,
                start_date=test_date,
                end_date=test_date,
                availability_type="UNV",  # Unavailable
                is_recurring=False,
            )
            db.session.add(unavailability)
            db.session.commit()

            logger.info(
                f"Testing availability constraint for period: {start_date} to {end_date}"
            )
            logger.info(
                f"Employee {test_employee.first_name} {test_employee.last_name} is unavailable on {test_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])

            # Check if the employee is scheduled on the unavailable date
            scheduled_on_unavailable_date = False

            for schedule in schedules:
                if (
                    schedule.get("employee_id") == test_employee.id
                    and schedule.get("date") == test_date.isoformat()
                    and not schedule.get("is_empty")
                    and schedule.get("shift_id")
                ):
                    scheduled_on_unavailable_date = True
                    break

            # Log results
            if scheduled_on_unavailable_date:
                logger.error(
                    f"Employee {test_employee.first_name} {test_employee.last_name} was scheduled on {test_date} despite being unavailable"
                )
            else:
                logger.info(
                    f"Employee {test_employee.first_name} {test_employee.last_name} was correctly not scheduled on {test_date}"
                )

            # Assert that the employee is not scheduled on the unavailable date
            assert not scheduled_on_unavailable_date, (
                "Employee was scheduled on an unavailable date"
            )

            return result
        finally:
            # Restore original availabilities
            # First delete the test unavailability
            Availability.query.filter_by(employee_id=test_employee.id).delete()

            # Then add back the original availabilities
            for avail in current_availabilities:
                db.session.add(avail)

            db.session.commit()


def test_shift_requirements_constraint():
    """Test that the schedule generator respects shift minimum employee requirements."""
    logger.info("=== SHIFT REQUIREMENTS CONSTRAINT TEST ===")

    app = create_app()
    with app.app_context():
        # Get all shifts
        shifts = ShiftTemplate.query.all()

        if not shifts:
            logger.warning("No shifts found for testing")
            return None

        # Save original min_employees values
        original_min_employees = {shift.id: shift.min_employees for shift in shifts}

        try:
            # Set higher minimum employee requirements for all shifts
            for shift in shifts:
                shift.min_employees = 3  # Require at least 3 employees per shift
            db.session.commit()

            # Calculate dates for next week
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing shift requirements constraint for period: {start_date} to {end_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])

            # Count employees per shift per day
            shift_counts = {}

            for schedule in schedules:
                if not schedule.get("is_empty") and schedule.get("shift_id"):
                    shift_id = schedule.get("shift_id")
                    schedule_date = schedule.get("date")

                    key = f"{schedule_date}_{shift_id}"

                    if key not in shift_counts:
                        shift_counts[key] = 0

                    shift_counts[key] += 1

            # Check if all shifts meet minimum requirements
            shifts_below_minimum = []

            for key, count in shift_counts.items():
                date_str, shift_id_str = key.split("_")
                shift_id = int(shift_id_str)
                shift = ShiftTemplate.query.get(shift_id)

                if shift and count < shift.min_employees:
                    shifts_below_minimum.append(
                        {
                            "date": date_str,
                            "shift_id": shift_id,
                            "shift_time": f"{shift.start_time}-{shift.end_time}",
                            "min_required": shift.min_employees,
                            "actual": count,
                        }
                    )

            # Log results
            if shifts_below_minimum:
                logger.warning(
                    f"Found {len(shifts_below_minimum)} shifts below minimum requirements:"
                )
                for shift_info in shifts_below_minimum:
                    logger.warning(
                        f"  {shift_info['date']} Shift {shift_info['shift_id']} ({shift_info['shift_time']}): {shift_info['actual']}/{shift_info['min_required']} employees"
                    )
            else:
                logger.info("All shifts meet minimum employee requirements")

            # Check for shift requirement warnings
            requirement_warnings = [
                w
                for w in warnings
                if "minimum" in str(w).lower() or "requirement" in str(w).lower()
            ]
            logger.info(
                f"Shift requirement-related warnings: {len(requirement_warnings)}"
            )

            # Assert that all shifts meet minimum requirements or there are warnings about them
            assert len(shifts_below_minimum) == 0 or len(requirement_warnings) > 0

            return result
        finally:
            # Restore original min_employees values
            for shift in ShiftTemplate.query.all():
                if shift.id in original_min_employees:
                    shift.min_employees = original_min_employees[shift.id]

            db.session.commit()


def run_all_tests():
    """Run all schedule constraint tests."""
    logger.info("Starting schedule constraint tests...")

    tests = [
        ("Keyholder Constraint", test_keyholder_constraint),
        ("Weekly Hours Constraint", test_weekly_hours_constraint),
        ("Rest Time Constraint", test_rest_time_constraint),
        ("Employee Availability Constraint", test_employee_availability_constraint),
        ("Shift Requirements Constraint", test_shift_requirements_constraint),
    ]

    results = {}

    for name, test_func in tests:
        logger.info(f"\nRunning test: {name}")
        try:
            result = test_func()
            results[name] = {"status": "Success", "result": result}
            logger.info(f"Test '{name}' completed successfully")
        except Exception as e:
            logger.error(f"Test '{name}' failed: {str(e)}")
            results[name] = {"status": "Failed", "error": str(e)}

    # Print summary
    logger.info("\n=== TEST SUMMARY ===")
    for name, result in results.items():
        status = result["status"]
        logger.info(f"{name}: {status}")

    return results


if __name__ == "__main__":
    run_all_tests()
