import sys
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Add the current directory to the path
sys.path.append(".")

# Import Flask app and create context
from app import create_app

app = create_app()
app.app_context().push()

# Import models and services
from models.schedule import Schedule
from models.fixed_shift import ShiftTemplate
from models.employee import Employee
from models.employee_availability import EmployeeAvailability, AvailabilityType
from services.schedule_generator import ScheduleGenerator
from utils.date_utils import get_next_monday, get_next_sunday


def main():
    # Calculate dates for next week (Monday to Sunday)
    next_monday = get_next_monday()
    next_sunday = get_next_sunday(next_monday)

    logger.info(f"Testing schedule generation for {next_monday} to {next_sunday}")

    # Delete existing schedules for next week
    deleted_count = Schedule.query.filter(
        Schedule.date >= next_monday, Schedule.date <= next_sunday
    ).delete()
    logger.info(f"Deleted {deleted_count} existing schedules")

    # Query all shifts
    shifts = ShiftTemplate.query.all()
    logger.info(f"Found {len(shifts)} shifts")

    # Log details of each shift
    for shift in shifts:
        logger.info(
            f"Shift {shift.id}: {shift.start_time}-{shift.end_time}, duration: {shift.duration_hours}h"
        )
        logger.info(
            f"  Min employees: {shift.min_employees}, Max employees: {shift.max_employees}"
        )
        logger.info(f"  Active days: {shift.active_days}")

        # Check for shifts with 0 duration
        if shift.duration_hours == 0.0:
            logger.warning(f"Shift {shift.id} has a duration of 0.0 hours!")

    # Query all employees
    employees = Employee.query.filter_by(is_active=True).all()
    logger.info(f"Found {len(employees)} active employees")

    # Log details of each employee
    for employee in employees:
        logger.info(
            f"Employee {employee.id}: {employee.first_name} {employee.last_name}"
        )
        logger.info(f"  Contracted hours: {employee.contracted_hours}h")
        logger.info(f"  Is keyholder: {employee.is_keyholder}")

    # Check for unavailable slots (absences)
    unavailable_slots = EmployeeAvailability.query.filter_by(
        availability_type=AvailabilityType.UNAVAILABLE.value
    ).all()
    logger.info(f"Found {len(unavailable_slots)} unavailable slots (absences)")

    # Create schedule generator
    generator = ScheduleGenerator()

    # Enable debug logging for schedule generation
    logging.getLogger("schedule_logger").setLevel(logging.DEBUG)

    # Generate schedules
    try:
        schedules, errors = generator.generate_schedule(next_monday, next_sunday)
        logger.info(f"Generated {len(schedules)} schedules")

        if errors:
            logger.warning(
                f"Encountered {len(errors)} errors/warnings during generation"
            )
            for error in errors:
                logger.warning(f"{error['type'].upper()}: {error['message']}")

        # Count empty and assigned schedules
        empty_schedules = [
            s
            for s in schedules
            if s.shift.start_time == "00:00" and s.shift.end_time == "00:00"
        ]
        assigned_schedules = [
            s
            for s in schedules
            if s.shift.start_time != "00:00" or s.shift.end_time != "00:00"
        ]

        logger.info(f"Total schedules: {len(schedules)}")
        logger.info(f"Empty schedules: {len(empty_schedules)}")
        logger.info(f"Assigned schedules: {len(assigned_schedules)}")

        assignment_rate = (
            len(assigned_schedules) / len(schedules) * 100 if schedules else 0
        )
        logger.info(f"Assignment rate: {assignment_rate:.1f}%")

    except Exception as e:
        logger.error(f"Error generating schedules: {str(e)}")


if __name__ == "__main__":
    main()
