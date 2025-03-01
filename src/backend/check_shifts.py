import sys
import os
import logging

# Add the current directory to the path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Import app and models after path setup
from app import create_app
from models import ShiftTemplate, Employee


def main():
    # Create Flask app context
    app = create_app()

    with app.app_context():
        try:
            # Query all shifts
            shifts = ShiftTemplate.query.all()
            logger.info(f"Found {len(shifts)} shifts")

            # Log details about each shift
            for shift in shifts:
                logger.info(
                    f"Shift {shift.id}: {shift.start_time} - {shift.end_time}, "
                    f"Duration: {shift.duration_hours}h, "
                    f"Min employees: {shift.min_employees}, "
                    f"Max employees: {shift.max_employees}, "
                    f"Active days: {shift.active_days}"
                )

                if shift.duration_hours == 0.0:
                    logger.warning(f"Shift {shift.id} has a duration of 0.0 hours!")

                # Check if this is shift 9
                if shift.id == 9:
                    logger.debug(
                        f"FOUND SHIFT 9: {shift.id}, {shift.start_time} - {shift.end_time}, "
                        f"Duration: {shift.duration_hours}h, "
                        f"Min employees: {shift.min_employees}, "
                        f"Max employees: {shift.max_employees}, "
                        f"Active days: {shift.active_days}"
                    )

            # Query all active employees
            employees = Employee.query.filter_by(is_active=True).all()
            logger.info(f"Found {len(employees)} active employees")

            # Log details about each employee
            for employee in employees:
                logger.info(
                    f"Employee {employee.id}: {employee.first_name} {employee.last_name}, "
                    f"Contracted hours: {employee.contracted_hours}h, "
                    f"Is keyholder: {employee.is_keyholder}"
                )

        except Exception as e:
            logger.error(f"Error in main function: {str(e)}")
            raise


if __name__ == "__main__":
    main()
