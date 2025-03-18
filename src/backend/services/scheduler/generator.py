"""Schedule generation service for Schichtplan."""

from datetime import date, datetime, timedelta
import logging
from typing import Dict, List, Any, Optional
import sys
import os

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)


class ScheduleGenerationError(Exception):
    """Exception raised for errors during schedule generation."""

    pass


# Import the extracted modules
from .config import SchedulerConfig
from .constraints import ConstraintChecker
from .availability import AvailabilityChecker
from .distribution import DistributionManager
from .serialization import ScheduleSerializer
from .logging_utils import LoggingManager
from src.backend.models.employee import AvailabilityType

# Try to handle imports in different environments
try:
    from models.employee import AvailabilityType
    from models import Employee, ShiftTemplate, Schedule
    from utils.logger import logger
    from services.scheduler.resources import ScheduleResources
except ImportError:
    try:
        from backend.models.employee import AvailabilityType
        from backend.models import Employee, ShiftTemplate, Schedule
        from backend.utils.logger import logger
        from backend.services.scheduler.resources import ScheduleResources
    except ImportError:
        try:
            from src.backend.models.employee import AvailabilityType
            from src.backend.models import Employee, ShiftTemplate, Schedule
            from src.backend.utils.logger import logger
            from src.backend.services.scheduler.resources import ScheduleResources
        except ImportError:
            # Create placeholder logger and classes for standalone testing
            logger = logging.getLogger(__name__)

            from enum import Enum

            class AvailabilityType(str, Enum):
                """Mock enum for availability types"""

                AVAILABLE = "AVL"
                FIXED = "FIX"
                PREFERRED = "PRF"
                UNAVAILABLE = "UNV"

            class Employee:
                """Type hint class for Employee"""

                id: int

            class ShiftTemplate:
                """Type hint class for ShiftTemplate"""

                id: int

            class Schedule:
                """Type hint class for Schedule"""

                id: int
                entries = []

            # Define a basic ScheduleResources class
            class ScheduleResources:
                """Minimal ScheduleResources for standalone testing"""

                def __init__(self):
                    self.employees = []
                    self.shifts = []
                    self.availabilities = []
                    self.coverage = []
                    self.leaves = []

                def is_loaded(self):
                    return len(self.employees) > 0

                def load(self):
                    pass


class ScheduleAssignment:
    """Represents a single assignment of an employee to a shift"""

    def __init__(
        self,
        employee_id: int,
        shift_id: int,
        date: date,
        shift_template: Any = None,
        availability_type: str = None,
        status: str = "PENDING",
        version: int = 1,
    ):
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.date = date
        self.shift_template = shift_template
        self.availability_type = availability_type or AvailabilityType.AVAILABLE.value
        self.status = status
        self.version = version


class ScheduleGenerator:
    """
    Main class for generating employee schedules.
    Coordinates the scheduling process using the specialized modules.
    """

    def __init__(self, resources=None, config=None):
        # Initialize the logging manager
        self.logging_manager = LoggingManager(app_name="scheduler")
        self.logger = self.logging_manager.get_logger()

        # Initialize resources and config
        self.resources = resources or ScheduleResources()
        self.config = config or SchedulerConfig()

        # Initialize the specialized modules
        self.constraint_checker = ConstraintChecker(
            self.resources, self.config, self.logger
        )
        self.availability_checker = AvailabilityChecker(self.resources, self.logger)
        self.distribution_manager = DistributionManager(
            self.resources,
            self.constraint_checker,
            self.availability_checker,
            self.config,
            self.logger,
        )
        self.serializer = ScheduleSerializer(self.logger)

        # Schedule data
        self.schedule = None
        self.assignments = []
        self.schedule_by_date = {}

    def generate_schedule(
        self,
        start_date: date,
        end_date: date,
        config: Optional[Dict] = None,
        create_empty_schedules: bool = False,
        version: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Wrapper for generate method to maintain backward compatibility
        """
        return self.generate(
            start_date, end_date, config, create_empty_schedules, version
        )

    def generate(
        self,
        start_date: date,
        end_date: date,
        config: Optional[Dict] = None,
        create_empty_schedules: bool = False,
        version: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Generate a schedule for the given date range

        Args:
            start_date: The start date of the schedule
            end_date: The end date of the schedule
            config: Optional configuration dictionary
            create_empty_schedules: Whether to create empty schedule entries for days with no coverage
            version: Optional version of the schedule
        """
        try:
            # Set up diagnostic logging
            log_path = self.logging_manager.setup_logging(
                log_level=logging.DEBUG, log_to_file=True
            )
            self.logger.info(
                f"Starting schedule generation for {start_date} to {end_date}"
            )
            self.logger.info(f"Diagnostic logs will be written to {log_path}")

            # Update config if provided
            if config:
                self.config.update_from_dict(config)

            # Load resources if not already loaded
            if not self.resources.is_loaded():
                self.logger.info("Loading resources...")
                self.resources.load()

            # Log resource counts
            self.logger.info(
                f"Loaded {len(self.resources.employees)} employees, "
                f"{len(self.resources.shifts)} shifts, "
                f"{len(self.resources.availabilities)} availability records, "
                f"{len(self.resources.coverage)} coverage records"
            )

            # Validate shift templates have durations
            self._validate_shift_durations()

            # Create a new schedule
            self.schedule = Schedule(
                start_date=start_date,
                end_date=end_date,
                status="DRAFT",
                version=version or 1,
            )

            # Initialize assignments list and schedule by date
            self.assignments = []
            self.schedule_by_date = {}

            # Process each day in the date range
            current_date = start_date
            while current_date <= end_date:
                self.logger.info(f"Processing date: {current_date}")

                # Process coverage for this date
                employees_needed = self._process_coverage(current_date)

                if not employees_needed:
                    self.logger.warning(
                        f"No coverage data found for {current_date}, skipping"
                    )
                    # If create_empty_schedules is True, create empty entries for this date
                    if create_empty_schedules:
                        self.logger.info(
                            f"Creating empty schedule entries for {current_date}"
                        )
                        # Create an empty assignment for this date with no employees assigned
                        empty_assignment = {
                            "date": current_date,
                            "status": "EMPTY",
                            "version": 1,
                        }
                        self.assignments.append(empty_assignment)
                        self.schedule_by_date[current_date] = [empty_assignment]

                    current_date += timedelta(days=1)
                    continue

                # Create shifts for this date based on templates
                date_shifts = self._create_date_shifts(current_date)

                # Assign employees to shifts using the distribution manager
                assigned_employees = (
                    self.distribution_manager.assign_employees_with_distribution(
                        current_date, date_shifts, employees_needed
                    )
                )

                # Add assignments to our tracking
                self.assignments.extend(assigned_employees)

                # Organize by date for easy access
                self.schedule_by_date[current_date] = assigned_employees

                # Update constraint checker and distribution manager with latest assignments
                self.constraint_checker.set_schedule(
                    self.assignments, self.schedule_by_date
                )
                self.distribution_manager.set_schedule(
                    self.assignments, self.schedule_by_date
                )

                # Move to next day
                current_date += timedelta(days=1)

            # Create schedule entries from assignments
            schedule_entries = self.serializer.create_schedule_entries(
                self.assignments, status="DRAFT", version=version
            )

            # Add entries to the schedule
            self.schedule.entries = schedule_entries

            # Convert schedule to dictionary for response
            result = self.serializer.convert_schedule_to_dict(self.schedule)

            self.logger.info(
                f"Schedule generation complete, created {len(schedule_entries)} entries"
            )

            return result

        except Exception as e:
            self.logger.error(f"Error generating schedule: {str(e)}", exc_info=True)
            raise ScheduleGenerationError(
                f"Failed to generate schedule: {str(e)}"
            ) from e

    def _validate_shift_durations(self):
        """
        Validate that all shift templates have durations
        Raises ScheduleGenerationError if validation fails
        """
        missing_durations = []

        for shift in self.resources.shifts:
            # Check if shift has duration
            has_duration = False

            # Check for duration_hours attribute
            if hasattr(shift, "duration_hours") and shift.duration_hours is not None:
                has_duration = True

            # If not, check if we can calculate from start and end times
            elif hasattr(shift, "start_time") and hasattr(shift, "end_time"):
                if shift.start_time and shift.end_time:
                    has_duration = True

            if not has_duration:
                missing_durations.append(
                    shift.id if hasattr(shift, "id") else "Unknown ID"
                )

        if missing_durations:
            self.logger.error(f"Shifts missing durations: {missing_durations}")
            raise ScheduleGenerationError("Schichtdauer fehlt")

    def _process_coverage(self, current_date: date) -> Dict[str, int]:
        """Process coverage records to determine staffing needs for a date"""
        coverage_for_date = {}

        # Find coverage records for this date or day of week
        for coverage in self.resources.coverage:
            # Check if this coverage applies to this date
            if self._coverage_applies_to_date(coverage, current_date):
                # Get shift type
                shift_type = getattr(coverage, "shift_type", "DAY")

                # Get employees needed
                employees_needed = getattr(coverage, "min_employees", 0)
                if not employees_needed and hasattr(coverage, "employees_needed"):
                    employees_needed = coverage.employees_needed

                # Add to coverage dictionary, combining if already exists
                if shift_type in coverage_for_date:
                    coverage_for_date[shift_type] += employees_needed
                else:
                    coverage_for_date[shift_type] = employees_needed

        return coverage_for_date

    def _coverage_applies_to_date(self, coverage, check_date: date) -> bool:
        """Check if a coverage record applies to the given date"""
        # Check for specific date
        if hasattr(coverage, "date") and coverage.date:
            coverage_date = coverage.date
            if isinstance(coverage_date, str):
                try:
                    coverage_date = datetime.fromisoformat(coverage_date).date()
                except (ValueError, TypeError):
                    return False

            return coverage_date == check_date

        # Check for day of week
        elif hasattr(coverage, "day_of_week") and coverage.day_of_week is not None:
            # day_of_week: 0 = Monday, 6 = Sunday
            return coverage.day_of_week == check_date.weekday()

        return False

    def _create_date_shifts(self, current_date: date) -> List[Dict]:
        """Create shift instances for a specific date based on shift templates"""
        date_shifts = []

        for shift_template in self.resources.shifts:
            # Check if this shift template should be used for this date
            # (could be based on day of week, etc.)
            if self._shift_applies_to_date(shift_template, current_date):
                # Create a shift instance
                shift = {
                    "shift_id": shift_template.id,
                    "shift_template": shift_template,
                    "date": current_date,
                    "shift_type": getattr(shift_template, "shift_type", "DAY"),
                }
                date_shifts.append(shift)

        return date_shifts

    def _shift_applies_to_date(self, shift: ShiftTemplate, check_date: date) -> bool:
        """Check if a shift template applies to the given date"""
        # Default - all shifts apply to all dates
        # Could add logic for specific days of week, etc.
        return True
