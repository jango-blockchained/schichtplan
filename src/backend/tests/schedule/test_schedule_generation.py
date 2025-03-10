import sys
import logging
from datetime import datetime, timedelta
from app import create_app
from models.fixed_shift import ShiftTemplate
from models.employee import Employee
from models.schedule import Schedule
from services.scheduler import ScheduleGenerator
from models import db

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Set all loggers to DEBUG level
for log_name in logging.root.manager.loggerDict:
    logging.getLogger(log_name).setLevel(logging.DEBUG)


def get_next_monday():
    """Get the date of the next Monday."""
    today = datetime.now().date()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # If today is Monday, get next Monday
    return today + timedelta(days=days_ahead)


def main():
    try:
        # Create Flask app context
        app = create_app()
        with app.app_context():
            # Calculate dates for next week (Monday to Sunday)
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing schedule generation for period: {start_date} to {end_date}"
            )

            # Delete existing schedules for this period if any
            existing_schedules = Schedule.query.filter(
                Schedule.date >= start_date, Schedule.date <= end_date
            ).all()

            if existing_schedules:
                logger.info(
                    f"Deleting {len(existing_schedules)} existing schedules for this period"
                )
                for schedule in existing_schedules:
                    db.session.delete(schedule)
                db.session.commit()

            # Get all shifts and active employees
            shifts = ShiftTemplate.query.all()
            logger.info(f"Found {len(shifts)} shifts")

            # Log detailed shift information from database
            for shift in shifts:
                logger.info(
                    f"DB Shift: {shift.id}, Time: {shift.start_time}-{shift.end_time}, Duration: {shift.duration_hours}h, Min employees: {shift.min_employees}, Max employees: {shift.max_employees}"
                )

            employees = Employee.query.filter_by(is_active=True).all()
            logger.info(f"Found {len(employees)} active employees")

            # Log detailed employee information from database
            for employee in employees:
                logger.info(
                    f"DB Employee: {employee.id}, Name: {employee.first_name} {employee.last_name}, Hours: {employee.contracted_hours}h"
                )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Add debug logging for shift templates
            if (
                hasattr(generator, "resources")
                and generator.resources
                and hasattr(generator.resources, "shifts")
                and generator.resources.shifts
            ):
                logger.info(
                    f"Available shift templates in generator: {len(generator.resources.shifts)}"
                )
                for shift in generator.resources.shifts:
                    logger.info(
                        f"Generator Shift: {shift.id}, Time: {shift.start_time}-{shift.end_time}, Duration: {shift.duration_hours}h, Min employees: {shift.min_employees}, Max employees: {shift.max_employees}"
                    )
            else:
                logger.warning("No shift templates available in generator")

            # Add debug logging for employees
            if (
                hasattr(generator, "resources")
                and generator.resources
                and hasattr(generator.resources, "employees")
                and generator.resources.employees
            ):
                logger.info(
                    f"Available employees in generator: {len(generator.resources.employees)}"
                )
                for employee in generator.resources.employees:
                    logger.info(
                        f"Generator Employee: {employee.id}, Name: {employee.first_name} {employee.last_name}, Hours: {employee.contracted_hours}h"
                    )

                    # Check availability for each day and shift
                    for day_offset in range(7):
                        check_date = start_date + timedelta(days=day_offset)
                        logger.info(
                            f"Checking availability for employee {employee.id} on {check_date}"
                        )

                        if generator.resources.shifts:
                            for shift in generator.resources.shifts:
                                try:
                                    is_available = generator._check_availability(
                                        employee,
                                        check_date,
                                        shift.start_time,
                                        shift.end_time,
                                    )
                                    logger.info(
                                        f"  - Shift {shift.id} ({shift.start_time}-{shift.end_time}): {'Available' if is_available else 'Not available'}"
                                    )

                                    # If available, check other conditions
                                    if is_available:
                                        # Check rest time
                                        try:
                                            has_rest = generator._has_enough_rest_time(
                                                employee, shift, check_date
                                            )
                                            logger.info(
                                                f"    - Rest time check: {'Pass' if has_rest else 'Fail'}"
                                            )
                                        except Exception as e:
                                            logger.error(
                                                f"    - Rest time check error: {str(e)}"
                                            )

                                        # Check max shifts
                                        try:
                                            exceeds_shifts = (
                                                generator._exceeds_max_shifts(
                                                    employee, check_date
                                                )
                                            )
                                            logger.info(
                                                f"    - Max shifts check: {'Pass' if not exceeds_shifts else 'Fail'}"
                                            )
                                        except Exception as e:
                                            logger.error(
                                                f"    - Max shifts check error: {str(e)}"
                                            )

                                        # Check hours
                                        try:
                                            week_start = check_date - timedelta(
                                                days=check_date.weekday()
                                            )
                                            current_hours = (
                                                generator._get_employee_hours(
                                                    employee, week_start
                                                )
                                            )
                                            would_exceed = False
                                            if (
                                                current_hours is not None
                                                and shift.duration_hours is not None
                                            ):
                                                would_exceed = (
                                                    current_hours + shift.duration_hours
                                                    > employee.contracted_hours
                                                )
                                            logger.info(
                                                f"    - Hours check: Current={current_hours}h, Would exceed={would_exceed}"
                                            )
                                        except Exception as e:
                                            logger.error(
                                                f"    - Hours check error: {str(e)}"
                                            )
                                except Exception as e:
                                    logger.error(
                                        f"  - Availability check error: {str(e)}"
                                    )
            else:
                logger.warning("No employees available in generator")

            # Test _get_available_employees directly for each day and shift
            logger.info("TESTING _get_available_employees DIRECTLY:")
            for day_offset in range(7):
                check_date = start_date + timedelta(days=day_offset)
                logger.info(f"Testing available employees for date: {check_date}")

                if generator.resources and generator.resources.shifts:
                    for shift in generator.resources.shifts:
                        try:
                            available_employees = generator._get_available_employees(
                                check_date, shift.start_time, shift.end_time
                            )
                            logger.info(
                                f"  - Shift {shift.id} ({shift.start_time}-{shift.end_time}): {len(available_employees)} available employees"
                            )
                            if available_employees:
                                for emp in available_employees:
                                    logger.info(
                                        f"    - Available: {emp.id} ({emp.first_name} {emp.last_name})"
                                    )
                            else:
                                logger.info(
                                    "    - No employees available for this shift"
                                )
                        except Exception as e:
                            logger.error(
                                f"  - Error getting available employees: {str(e)}"
                            )

            # Generate schedules
            logger.info("Starting schedule generation...")
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            errors = result.get("errors", [])

            # Log results
            total_schedules = len(schedules)
            empty_schedules = len(
                [
                    s
                    for s in schedules
                    if s.get("is_empty", False)
                    or "shift_id" not in s
                    or not s["shift_id"]
                ]
            )
            assigned_schedules = total_schedules - empty_schedules

            logger.info("Schedule generation completed")
            logger.info(f"Total schedules: {total_schedules}")
            logger.info(f"Empty schedules: {empty_schedules}")
            logger.info(f"Assigned schedules: {assigned_schedules}")

            if total_schedules > 0:
                assignment_rate = (assigned_schedules / total_schedules) * 100
                logger.info(f"Assignment rate: {assignment_rate:.2f}%")

            # Check for errors
            if errors:
                logger.warning(f"Found {len(errors)} errors/warnings:")
                for error in errors:
                    error_type = error.get("type", "unknown")
                    message = error.get("message", "No message")
                    if error_type == "critical":
                        logger.error(f"  - CRITICAL: {message}")
                    elif error_type == "warning":
                        logger.warning(f"  - WARNING: {message}")
                    else:
                        logger.info(f"  - INFO: {message}")
            else:
                logger.info("No errors or warnings found")

            # Group errors by type for easier analysis
            coverage_errors = [
                e for e in errors if "coverage" in e.get("message", "").lower()
            ]
            rest_violations = [
                e for e in errors if "rest period" in e.get("message", "").lower()
            ]
            hours_violations = [
                e for e in errors if "hours" in e.get("message", "").lower()
            ]
            keyholder_violations = [
                e for e in errors if "keyholder" in e.get("message", "").lower()
            ]

            if coverage_errors:
                logger.warning(f"Coverage errors: {len(coverage_errors)}")
            if rest_violations:
                logger.warning(f"Rest period violations: {len(rest_violations)}")
            if hours_violations:
                logger.warning(f"Hours violations: {len(hours_violations)}")
            if keyholder_violations:
                logger.warning(f"Keyholder violations: {len(keyholder_violations)}")

            # Verify all employees are included in the schedule
            employee_ids = {e.id for e in employees}
            scheduled_employee_ids = {
                s.get("employee_id")
                for s in schedules
                if s.get("employee_id") is not None
            }
            missing_employees = employee_ids - scheduled_employee_ids

            if missing_employees:
                logger.error(
                    f"Missing {len(missing_employees)} employees in the schedule!"
                )
                for emp_id in missing_employees:
                    emp = next((e for e in employees if e.id == emp_id), None)
                    if emp:
                        logger.error(
                            f"  - Missing: {emp.id} ({emp.first_name} {emp.last_name})"
                        )
            else:
                logger.info("All employees are included in the schedule")

            # Print a summary of the schedule
            logger.info("\nSchedule Summary:")
            for day_offset in range(7):
                check_date = start_date + timedelta(days=day_offset)
                date_str = check_date.strftime("%Y-%m-%d")
                day_schedules = [s for s in schedules if s.get("date") == date_str]
                logger.info(f"  {date_str}: {len(day_schedules)} assignments")

    except Exception as e:
        logger.error(f"Test failed with error: {str(e)}")


if __name__ == "__main__":
    main()
