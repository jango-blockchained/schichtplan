"""Schedule generation service for Schichtplan."""

from datetime import date, datetime, timedelta
import logging
from typing import Dict, List, Any, Optional
import sys
import os
from pathlib import Path

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Import the extracted modules
from .config import SchedulerConfig
from .constraints import ConstraintChecker
from .availability import AvailabilityChecker
from .distribution import DistributionManager
from .serialization import ScheduleSerializer
from .logging_utils import LoggingManager
from .resources import ScheduleResources

# Set up placeholder logger
logger = logging.getLogger(__name__)

# Setup for imports - we'll try different import paths
import importlib.util
from enum import Enum

# First, define fallback classes to use if imports fail
# pylint: disable=redefined-outer-name, duplicate-code


class _AvailabilityType(str, Enum):
    """Fallback enum for availability types"""

    AVAILABLE = "AVL"
    FIXED = "FIX"
    PREFERRED = "PRF"
    UNAVAILABLE = "UNV"


class _Employee:
    """Fallback Employee class"""

    id: int


class _ShiftTemplate:
    """Fallback ShiftTemplate class"""

    id: int
    name: str
    start_time: str
    end_time: str
    shift_type: str
    duration_hours: float


class _Schedule:
    """Fallback Schedule class"""

    id: int
    entries = []


# Function to dynamically import a module
def try_import(module_name, class_name=None):
    try:
        module = importlib.import_module(module_name)
        return module if class_name is None else getattr(module, class_name)
    except (ImportError, AttributeError):
        return None


# Try to import the required classes, falling back on our defined classes if needed
models_module = try_import("models")
if models_module is None:
    models_module = try_import("backend.models")
if models_module is None:
    models_module = try_import("src.backend.models")

# Now try to import employee module
employee_module = try_import("models.employee")
if employee_module is None:
    employee_module = try_import("backend.models.employee")
if employee_module is None:
    employee_module = try_import("src.backend.models.employee")

# Try to import logger
utils_logger = try_import("utils.logger")
if utils_logger is None:
    utils_logger = try_import("backend.utils.logger")
if utils_logger is None:
    utils_logger = try_import("src.backend.utils.logger")

# Set up our classes based on successful imports or fallbacks
if employee_module and hasattr(employee_module, "AvailabilityType"):
    AvailabilityType = employee_module.AvailabilityType
else:
    AvailabilityType = _AvailabilityType

if models_module:
    Employee = getattr(models_module, "Employee", _Employee)
    ShiftTemplate = getattr(models_module, "ShiftTemplate", _ShiftTemplate)
    Schedule = getattr(models_module, "Schedule", _Schedule)
else:
    Employee = _Employee
    ShiftTemplate = _ShiftTemplate
    Schedule = _Schedule

if utils_logger:
    logger = getattr(utils_logger, "logger", logger)


class ScheduleGenerationError(Exception):
    """Exception raised for errors during schedule generation."""

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


class ScheduleContainer:
    """Container class for schedule metadata"""

    def __init__(self, start_date, end_date, status="DRAFT", version=1):
        self.start_date = start_date
        self.end_date = end_date
        self.status = status
        self.version = version
        self.entries = []
        self.id = None  # Add an ID field

    def get_schedule(self):
        """Return self as this is the schedule container"""
        return self

    def get_assignments(self):
        """Return the schedule entries"""
        return self.entries


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
            # Set up diagnostic logging with unified paths
            app_log_dir = None

            # Try to find src/logs directory for app logs
            current_dir = Path.cwd()
            src_dir = current_dir
            while src_dir.name != "src" and src_dir.parent != src_dir:
                src_dir = src_dir.parent

            if src_dir.name == "src":
                app_log_dir = os.path.join(src_dir, "logs")

            # Set up the enhanced logging
            log_path = self.logging_manager.setup_logging(
                log_level=logging.DEBUG, log_to_file=True, app_log_dir=app_log_dir
            )

            # Start tracking the overall process
            process_name = f"Schedule Generation ({start_date} to {end_date})"
            self.logging_manager.start_process(process_name)

            # Log initial configuration
            self.logger.info(f"Diagnostic logs: {log_path}")
            self.logger.info(f"App logs: {self.logging_manager.get_app_log_path()}")
            self.logger.info(
                f"Summary log: {self.logging_manager.get_diagnostic_log_path()}"
            )

            # Step 1: Resource loading
            self.logging_manager.start_step("Resource Loading")
            if not self.resources.is_loaded():
                self.logger.info("Loading resources...")
                self.resources.load()

                # Log resource stats
                employee_count = len(self.resources.employees)
                shift_count = len(self.resources.shifts)
                self.logging_manager.log_step_data(
                    "Resources",
                    {
                        "employees": employee_count,
                        "shifts": shift_count,
                        "settings": str(self.resources.settings),
                    },
                )

                self.logger.info(
                    f"Resources loaded successfully: {employee_count} employees, {shift_count} shifts"
                )
            else:
                self.logger.info("Resources already loaded")

            self.logging_manager.end_step()

            # Step 2: Shift validation
            self.logging_manager.start_step("Shift Validation")
            invalid_shifts = self._validate_shift_durations()
            self.logging_manager.log_step_data("Invalid Shifts", len(invalid_shifts))
            self.logging_manager.end_step({"invalid_shifts": len(invalid_shifts)})

            # Create a new schedule container
            self.schedule = ScheduleContainer(
                start_date=start_date,
                end_date=end_date,
                version=version or 1,
            )

            # Process each date in the range
            self.logging_manager.start_step("Date Processing Loop")
            current_date = start_date
            date_count = 0
            empty_dates = 0

            while current_date <= end_date:
                self.logger.info(f"Processing date: {current_date}")

                # Track progress for each date
                self.logging_manager.log_step_data("Current Date", str(current_date))

                # Sub-step: Coverage processing
                self.logging_manager.start_step(f"Coverage Processing ({current_date})")
                coverage = self._process_coverage(current_date)
                has_coverage = bool(coverage)
                self.logging_manager.log_step_data("Coverage Data", coverage)
                self.logging_manager.end_step({"has_coverage": has_coverage})

                if has_coverage:
                    # Sub-step: Assignment generation
                    self.logging_manager.start_step(
                        f"Assignment Generation ({current_date})"
                    )
                    assignments = self._generate_assignments_for_date(
                        current_date, coverage
                    )
                    self.logging_manager.log_step_data(
                        "Assignment Count", len(assignments)
                    )
                    self.logging_manager.end_step({"assignments": len(assignments)})

                    date_count += 1
                elif create_empty_schedules:
                    # Sub-step: Empty schedule creation
                    self.logging_manager.start_step(
                        f"Empty Schedule Creation ({current_date})"
                    )
                    self.logger.warning(
                        f"No coverage data found for date {current_date}"
                    )
                    self.logger.info(
                        f"Creating empty schedule entries for date {current_date}"
                    )
                    self._create_empty_schedule_entries(current_date)
                    self.logging_manager.end_step({"empty_created": True})

                    empty_dates += 1
                else:
                    self.logger.warning(
                        f"No coverage data found for date {current_date}, skipping..."
                    )

                # Move to the next date
                current_date += timedelta(days=1)

            # Finish date processing loop
            self.logging_manager.end_step(
                {
                    "dates_processed": date_count + empty_dates,
                    "dates_with_coverage": date_count,
                    "dates_empty": empty_dates,
                }
            )

            # Step 3: Serialization
            self.logging_manager.start_step("Schedule Serialization")
            serialized_result = self.serializer.serialize_schedule(
                self.schedule.get_schedule()
            )

            # Add metrics to result
            metrics = self.distribution_manager.get_distribution_metrics()
            serialized_result["metrics"] = metrics

            # Schedule validation stats
            valid_count = 0
            invalid_count = 0

            for assignment in self.schedule.get_assignments():
                validity = self.constraint_checker.validate_assignment(assignment)
                if validity.is_valid:
                    valid_count += 1
                else:
                    invalid_count += 1

            serialized_result["validation"] = {
                "valid_assignments": valid_count,
                "invalid_assignments": invalid_count,
            }

            # Add additional information
            serialized_result["schedule_info"] = {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "version": self.schedule.version,
                "date_count": (end_date - start_date).days + 1,
                "dates_with_coverage": date_count,
                "empty_dates": empty_dates,
            }

            self.logging_manager.log_step_data(
                "Result Size", len(str(serialized_result))
            )
            self.logging_manager.end_step()

            # End the overall process with stats
            stats = {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "date_count": (end_date - start_date).days + 1,
                "dates_with_coverage": date_count,
                "empty_dates": empty_dates,
                "valid_assignments": valid_count,
                "invalid_assignments": invalid_count,
            }

            if metrics:
                stats["metrics"] = metrics

            self.logging_manager.end_process(stats)

            return serialized_result

        except Exception as e:
            # Log the error with exception info
            self.logging_manager.log_error(
                f"Error generating schedule: {str(e)}", exc_info=True
            )

            # End process with error status
            self.logging_manager.end_process({"error": str(e), "status": "failed"})

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

        return missing_durations

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

    def _generate_assignments_for_date(
        self, current_date: date, coverage: Dict[str, int]
    ) -> List[Dict]:
        """Generate assignments for a specific date based on coverage"""
        assignments = []

        for shift_type, employees_needed in coverage.items():
            for _ in range(employees_needed):
                assignment = {
                    "date": current_date,
                    "shift_type": shift_type,
                    "status": "ASSIGNED",
                    "version": 1,
                }
                assignments.append(assignment)

        return assignments

    def _create_empty_schedule_entries(self, current_date: date):
        """Create empty schedule entries for a specific date"""
        empty_assignment = {
            "date": current_date,
            "status": "EMPTY",
            "version": 1,
        }
        self.schedule.entries.append(empty_assignment)
        self.schedule_by_date[current_date] = [empty_assignment]
