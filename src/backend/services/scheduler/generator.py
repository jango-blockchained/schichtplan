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

    def add_assignment(self, assignment):
        """Add an assignment to the schedule"""
        self.entries.append(assignment)

    def get_assignments_for_date(self, date):
        """Get all assignments for a specific date"""
        return [
            a
            for a in self.entries
            if getattr(a, "date", None) == date or a.get("date") == date
        ]


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
        self.logger.info(f"Generating schedule from {start_date} to {end_date}")

        # Load and verify resources
        self.resources.load()
        if not self.resources.verify_loaded_resources():
            raise ScheduleGenerationError("Failed to load required resources")

        # Initialize schedule container
        self.schedule = ScheduleContainer(
            start_date=start_date,
            end_date=end_date,
            version=version or 1,
        )

        # Generate assignments for each date
        current_date = start_date
        date_count = 0
        empty_dates = 0

        while current_date <= end_date:
            try:
                self.logger.info(f"Generating assignments for {current_date}")
                assignments = self._generate_assignments_for_date(current_date)
                if assignments:
                    self.logger.info(
                        f"Generated {len(assignments)} assignments for {current_date}"
                    )
                    date_count += 1
                elif create_empty_schedules:
                    self.logger.warning(
                        f"No coverage data found for date {current_date}"
                    )
                    self.logger.info(
                        f"Creating empty schedule entries for date {current_date}"
                    )
                    self._create_empty_schedule_entries(current_date)
                    empty_dates += 1
                else:
                    self.logger.warning(
                        f"No coverage data found for date {current_date}, skipping..."
                    )

                # Move to the next date
                current_date += timedelta(days=1)
            except Exception as e:
                self.logger.error(
                    f"Error generating assignments for {current_date}: {str(e)}"
                )
                raise ScheduleGenerationError(
                    f"Failed to generate assignments for {current_date}: {str(e)}"
                )

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
            # Skip empty schedule entries
            if isinstance(assignment, dict) and assignment.get("status") == "EMPTY":
                continue

            # Get employee_id and shift_id based on type
            employee_id = (
                assignment.get("employee_id")
                if isinstance(assignment, dict)
                else assignment.employee_id
            )
            shift_id = (
                assignment.get("shift_id")
                if isinstance(assignment, dict)
                else assignment.shift_id
            )
            assignment_date = (
                assignment.get("date")
                if isinstance(assignment, dict)
                else assignment.date
            )

            if employee_id and shift_id:
                # Get the employee and shift from the assignment
                employee = self.resources.get_employee(employee_id)
                shift = self.resources.get_shift(shift_id)

                if employee and shift:
                    # Check if the assignment exceeds constraints
                    exceeds = self.constraint_checker.exceeds_constraints(
                        employee, assignment_date, shift
                    )
                    if not exceeds:
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

        self.logging_manager.log_step_data("Result Size", len(str(serialized_result)))
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
        total_employees_needed = 0

        self.logger.debug(f"Processing coverage for date {current_date}")
        self.logger.debug(f"Available coverage records: {len(self.resources.coverage)}")

        # Find coverage records for this date or day of week
        for coverage in self.resources.coverage:
            # Check if this coverage applies to this date
            if self._coverage_applies_to_date(coverage, current_date):
                # Get employees needed
                employees_needed = getattr(coverage, "min_employees", 0)
                if not employees_needed and hasattr(coverage, "employees_needed"):
                    employees_needed = coverage.employees_needed

                self.logger.debug(
                    f"Found coverage requiring {employees_needed} employees"
                )
                total_employees_needed += employees_needed

        # Return a single value for total employees needed for the day
        return {"total": total_employees_needed} if total_employees_needed > 0 else {}

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
        day_of_week = None
        if hasattr(coverage, "day_index"):
            day_of_week = coverage.day_index
        elif hasattr(coverage, "day_of_week"):
            day_of_week = coverage.day_of_week

        if day_of_week is not None:
            # day_of_week: 0 = Monday, 6 = Sunday
            return day_of_week == check_date.weekday()

        return False

    def _create_date_shifts(self, current_date: date) -> List[Dict]:
        """Create shift instances for a specific date based on shift templates"""
        date_shifts = []

        self.logger.debug(f"Creating shifts for date {current_date}")
        self.logger.debug(f"Available shift templates: {len(self.resources.shifts)}")

        for shift_template in self.resources.shifts:
            # Check if this shift template should be used for this date
            if self._shift_applies_to_date(shift_template, current_date):
                # Get the shift type from the template
                shift_type = None
                if hasattr(shift_template, "shift_type_id"):
                    shift_type = shift_template.shift_type_id
                elif hasattr(shift_template, "shift_type"):
                    shift_type = getattr(
                        shift_template.shift_type, "value", shift_template.shift_type
                    )

                if not shift_type:
                    self.logger.warning(
                        f"No shift type found for template {shift_template.id}, using default"
                    )
                    # Determine shift type based on time if not provided
                    start_hour = int(shift_template.start_time.split(":")[0])
                    if start_hour < 11:
                        shift_type = "EARLY"
                    elif start_hour >= 14:
                        shift_type = "LATE"
                    else:
                        shift_type = "MIDDLE"

                # Create a shift instance
                shift = {
                    "shift_id": shift_template.id,
                    "shift_template": shift_template,
                    "date": current_date,
                    "shift_type": shift_type,
                    "start_time": shift_template.start_time,
                    "end_time": shift_template.end_time,
                }
                date_shifts.append(shift)
                self.logger.debug(
                    f"Created {shift_type} shift from template {shift_template.id} "
                    f"({shift_template.start_time}-{shift_template.end_time})"
                )

        self.logger.debug(f"Created {len(date_shifts)} shifts for date {current_date}")
        return date_shifts

    def _shift_applies_to_date(self, shift: ShiftTemplate, check_date: date) -> bool:
        """Check if a shift template applies to the given date"""
        # Check if shift has active_days attribute
        if hasattr(shift, "active_days"):
            # Convert date to day index (0-6, where 0 is Monday in our system)
            day_index = str(check_date.weekday())

            # Check if this day is active for this shift
            if isinstance(shift.active_days, dict):
                return shift.active_days.get(day_index, False)

        # If no active_days specified, assume shift applies to all days
        self.logger.debug(
            f"No active_days found for shift {shift.id}, assuming active for all days"
        )
        return True

    def _generate_assignments_for_date(self, current_date: date) -> List[Dict]:
        """Generate assignments for a specific date"""
        try:
            # Process coverage for this date
            coverage = self._process_coverage(current_date)
            if not coverage:
                self.logger.warning(
                    f"No coverage requirements found for date {current_date}"
                )
                return []

            # Create shifts for this date
            date_shifts = self._create_date_shifts(current_date)
            if not date_shifts:
                self.logger.warning(f"No shifts available for date {current_date}")
                return []

            self.logger.info(
                f"Found {len(date_shifts)} shifts and need {coverage.get('total', 0)} total employees for {current_date}"
            )

            # Use the distribution manager to assign employees
            assignments = self.distribution_manager.assign_employees_with_distribution(
                current_date, date_shifts, coverage
            )

            if not assignments:
                self.logger.warning(
                    f"No assignments could be made for date {current_date}"
                )
                return []

            self.logger.info(f"Generated {len(assignments)} assignments")

            # Add assignments to schedule container
            for assignment in assignments:
                self.schedule.add_assignment(assignment)

                # Update schedule_by_date for constraint checking
                if current_date not in self.schedule_by_date:
                    self.schedule_by_date[current_date] = []
                self.schedule_by_date[current_date].append(assignment)

            # Validate assignments
            valid_count = 0
            invalid_count = 0
            for assignment in assignments:
                employee_id = assignment.get("employee_id")
                shift_id = assignment.get("shift_id")

                if employee_id and shift_id:
                    employee = self.resources.get_employee(employee_id)
                    shift = self.resources.get_shift(shift_id)

                    if employee and shift:
                        if not self.constraint_checker.exceeds_constraints(
                            employee, current_date, shift
                        ):
                            valid_count += 1
                        else:
                            invalid_count += 1
                            self.logger.warning(
                                f"Assignment for employee {employee_id} on {current_date} "
                                f"exceeds constraints"
                            )

            self.logger.info(
                f"Assignment validation for {current_date}: "
                f"{valid_count} valid, {invalid_count} invalid"
            )

            return assignments

        except Exception as e:
            self.logger.error(
                f"Error generating assignments for date {current_date}: {str(e)}"
            )
            raise  # Re-raise the exception to be caught by the caller

    def _create_empty_schedule_entries(self, current_date: date):
        """Create empty schedule entries for a specific date"""
        empty_assignment = {
            "date": current_date,
            "status": "EMPTY",
            "version": 1,
        }
        self.schedule.entries.append(empty_assignment)
        self.schedule_by_date[current_date] = [empty_assignment]
