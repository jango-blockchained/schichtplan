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
    """Container for schedule data"""

    def __init__(
        self,
        start_date: date,
        end_date: date,
        status: str = "DRAFT",
        version: int = 1,
        id: Optional[int] = None,
    ):
        self.start_date = start_date
        self.end_date = end_date
        self.status = status
        self.version = version
        self.id = id
        self.assignments = []
        self.logger = logging.getLogger(__name__)

    def add_assignment(self, assignment: Dict[str, Any]) -> None:
        """Add an assignment to the schedule"""
        self.logger.info(f"Adding assignment: {assignment}")
        if not all(key in assignment for key in ["date", "employee_id", "shift_id"]):
            self.logger.error(f"Invalid assignment format: {assignment}")
            return

        # Add schedule metadata
        assignment["version"] = self.version
        assignment["status"] = assignment.get("status", "PENDING")

        self.assignments.append(assignment)
        self.logger.info(
            f"Successfully added assignment. Total assignments: {len(self.assignments)}"
        )

    def get_assignments(self) -> List[Dict[str, Any]]:
        """Get all assignments in the schedule"""
        return self.assignments

    def get_assignments_for_date(self, target_date: date) -> List[Dict[str, Any]]:
        """Get assignments for a specific date"""
        return [a for a in self.assignments if a.get("date") == target_date.isoformat()]

    def clear_assignments(self) -> None:
        """Clear all assignments"""
        self.assignments = []


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
        """Generate a schedule for the given date range"""
        try:
            # Load and verify resources
            self.logger.info("Loading resources...")
            self.resources.load()
            if not self.resources.verify_loaded_resources():
                raise ScheduleGenerationError("Failed to load required resources")

            # Initialize schedule container
            self.schedule = ScheduleContainer(
                start_date=start_date,
                end_date=end_date,
                status="DRAFT",
                version=version or 1,
            )

            # Initialize schedule by date
            self.schedule_by_date = {}

            # Process each date in the range
            current_date = start_date
            date_count = 0
            empty_dates = 0
            valid_count = 0
            invalid_count = 0
            generation_errors = []

            while current_date <= end_date:
                try:
                    # Generate assignments for this date
                    assignments = self._generate_assignments_for_date(current_date)

                    if assignments:
                        date_count += 1
                        # Add assignments to schedule container
                        for assignment in assignments:
                            if assignment.get("status") != "EMPTY":
                                if self._validate_assignment(assignment):
                                    valid_count += 1
                                else:
                                    invalid_count += 1
                            self.schedule.add_assignment(assignment)
                    else:
                        empty_dates += 1
                        if create_empty_schedules:
                            # Create empty schedule entries
                            empty_entries = self._create_empty_schedule_entries(
                                current_date
                            )
                            for entry in empty_entries:
                                self.schedule.add_assignment(entry)

                except Exception as e:
                    error_msg = (
                        f"Error generating assignments for {current_date}: {str(e)}"
                    )
                    self.logger.error(error_msg)
                    generation_errors.append({"type": "error", "message": error_msg})

                current_date += timedelta(days=1)

            # Calculate metrics
            metrics = self._calculate_metrics()

            # Save the generated schedules to the database
            try:
                self._save_to_database()
                self.logger.info("Successfully saved schedules to database")
            except Exception as e:
                error_msg = f"Error saving schedules to database: {str(e)}"
                self.logger.error(error_msg)
                generation_errors.append({"type": "error", "message": error_msg})

            # Prepare result
            serialized_result = {
                "entries": self.schedule.get_assignments(),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "status": self.schedule.status,
                "version": self.schedule.version,
                "schedule_id": self.schedule.id,
                "validation": {
                    "valid_assignments": valid_count,
                    "invalid_assignments": invalid_count,
                },
                "metrics": metrics,
                "logs": generation_errors,
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

            return serialized_result

        except Exception as e:
            error_msg = f"Error in schedule generation: {str(e)}"
            self.logger.error(error_msg)
            return {"error": error_msg}

    def _save_to_database(self) -> None:
        """Save generated schedules to the database"""
        try:
            self.logger.info("Saving schedules to database...")

            # Delete existing schedules for this version and date range
            self.db.query(Schedule).filter(
                Schedule.version == self.schedule.version,
                Schedule.date >= self.schedule.start_date,
                Schedule.date <= self.schedule.end_date,
            ).delete()

            # Create new schedule entries
            for assignment in self.schedule.get_assignments():
                if assignment.get("status") != "EMPTY":
                    schedule = Schedule(
                        date=datetime.strptime(assignment["date"], "%Y-%m-%d").date(),
                        employee_id=assignment["employee_id"],
                        shift_id=assignment["shift_id"],
                        shift_type=assignment["shift_type"],
                        availability_type=assignment["availability_type"],
                        status=assignment["status"],
                        version=self.schedule.version,
                    )
                    self.db.add(schedule)

            # Commit changes
            self.db.commit()
            self.logger.info("Successfully saved schedules to database")

        except Exception as e:
            self.logger.error(f"Error saving schedules to database: {str(e)}")
            self.db.rollback()
            raise

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
        coverage_details = []

        self.logger.info(
            f"Processing coverage for date {current_date} (weekday: {current_date.weekday()})"
        )
        self.logger.info(
            f"Total available coverage records: {len(self.resources.coverage)}"
        )

        # Find coverage records for this date or day of week
        for coverage in self.resources.coverage:
            self.logger.debug(
                f"Checking coverage record: day_index={getattr(coverage, 'day_index', None)}, "
                f"day_of_week={getattr(coverage, 'day_of_week', None)}, "
                f"date={getattr(coverage, 'date', None)}"
            )

            # Check if this coverage applies to this date
            if self._coverage_applies_to_date(coverage, current_date):
                # Get employees needed
                employees_needed = getattr(coverage, "min_employees", 0)
                if not employees_needed and hasattr(coverage, "employees_needed"):
                    employees_needed = coverage.employees_needed

                coverage_details.append(
                    {
                        "day_index": getattr(coverage, "day_index", None),
                        "start_time": getattr(coverage, "start_time", None),
                        "end_time": getattr(coverage, "end_time", None),
                        "employees_needed": employees_needed,
                    }
                )

                self.logger.info(
                    f"Found applicable coverage: day_index={getattr(coverage, 'day_index', None)}, "
                    f"time={getattr(coverage, 'start_time', None)}-{getattr(coverage, 'end_time', None)}, "
                    f"employees_needed={employees_needed}"
                )
                total_employees_needed += employees_needed

        if coverage_details:
            self.logger.info(f"Coverage details for {current_date}: {coverage_details}")
        else:
            self.logger.warning(f"No applicable coverage found for date {current_date}")

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
            # Convert Python's weekday() (0=Monday) to our day_index (0=Sunday)
            python_weekday = check_date.weekday()
            # Convert to Sunday=0 format
            check_day_index = (python_weekday + 1) % 7

            self.logger.debug(
                f"Checking coverage for date {check_date}: "
                f"Python weekday={python_weekday}, "
                f"Converted day_index={check_day_index}, "
                f"Coverage day_index={day_of_week}"
            )

            return day_of_week == check_day_index

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

    def _generate_assignments_for_date(
        self, current_date: date
    ) -> List[Dict[str, Any]]:
        """Generate assignments for a specific date"""
        self.logger.info(f"Generating assignments for {current_date}")

        # Get shifts and coverage for this date
        date_shifts = self.resources.get_shifts_for_date(current_date)
        if not date_shifts:
            self.logger.warning(f"No shifts found for date {current_date}")
            return []

        coverage = self.resources.get_coverage_for_date(current_date)
        if not coverage:
            self.logger.warning(f"No coverage found for date {current_date}")
            return []

        # Get active employees
        employees = self.resources.get_active_employees()
        if not employees:
            self.logger.warning("No active employees found")
            return []

        # Initialize distribution manager with employees and shifts
        self.distribution_manager.initialize(
            employees, shifts=date_shifts, resources=self.resources
        )

        assignments = []
        for shift in date_shifts:
            # Find best employee for this shift
            best_employee = None
            best_score = float("-inf")

            for employee in employees:
                # Skip if employee is not available
                if not self.resources.is_employee_available(
                    employee, current_date, shift
                ):
                    continue

                # Calculate score for this assignment
                score = self.distribution_manager.calculate_assignment_score(
                    employee, shift, current_date
                )
                if score > best_score:
                    best_score = score
                    best_employee = employee

            if best_employee:
                # Create assignment with all required fields
                assignment = {
                    "date": current_date.isoformat(),
                    "employee_id": best_employee.id,
                    "shift_id": shift.id,
                    "status": "PENDING",
                    "version": self.schedule.version,
                    "shift_type": shift.type,
                    "availability_type": "AVAILABLE",  # Default to available since we checked availability
                }

                # Update distribution manager with this assignment
                self.distribution_manager.update_with_assignment(
                    best_employee, shift, current_date
                )

                assignments.append(assignment)
                self.logger.debug(f"Created assignment: {assignment}")
            else:
                self.logger.warning(
                    f"Could not find suitable employee for shift {shift.id} on {current_date}"
                )
                # Create empty assignment
                assignment = {
                    "date": current_date.isoformat(),
                    "employee_id": None,
                    "shift_id": shift.id,
                    "status": "EMPTY",
                    "version": self.schedule.version,
                    "shift_type": shift.type,
                    "availability_type": None,
                }
                assignments.append(assignment)

        # Store assignments for this date
        self.schedule_by_date[current_date] = assignments

        return assignments

    def _create_empty_schedule_entries(
        self, current_date: date
    ) -> List[Dict[str, Any]]:
        """Create empty schedule entries for a specific date"""
        self.logger.info(f"Creating empty schedule entries for {current_date}")

        # Get shifts for this date
        date_shifts = self.resources.get_shifts_for_date(current_date)
        if not date_shifts:
            self.logger.warning(f"No shifts found for date {current_date}")
            return []

        # Create empty entries for each shift
        empty_entries = []
        for shift in date_shifts:
            entry = {
                "date": current_date.isoformat(),
                "employee_id": None,
                "shift_id": shift.get("id"),
                "shift_type": shift.get("type"),
                "status": "EMPTY",
                "version": self.schedule.version,
                "availability_type": None,
            }
            empty_entries.append(entry)
            self.logger.debug(f"Created empty entry: {entry}")

        self.logger.info(
            f"Created {len(empty_entries)} empty entries for {current_date}"
        )
        return empty_entries

    def _validate_assignment(self, assignment):
        """Validate a single assignment"""
        employee_id = assignment.get("employee_id")
        shift_id = assignment.get("shift_id")

        if employee_id and shift_id:
            employee = self.resources.get_employee(employee_id)
            shift = self.resources.get_shift(shift_id)

            if employee and shift:
                return not self.constraint_checker.exceeds_constraints(
                    employee, assignment.get("date"), shift
                )

        return False

    def _calculate_metrics(self):
        """Calculate metrics for the generated schedule"""
        metrics = self.distribution_manager.get_distribution_metrics()
        return metrics
