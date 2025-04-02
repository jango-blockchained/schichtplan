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
        # Set up logging with diagnostic logs enabled by default
        self.logging_manager.setup_logging(
            log_level=logging.INFO,
            log_to_file=True,
            log_dir=None,  # Default: ~/.schichtplan/logs
            app_log_dir=None  # Will try to find src/logs automatically
        )
        # Start the process tracking
        self.logging_manager.start_process("Schedule Generation")
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
        self._schedule_entries = []  # Add this property for _finalize_schedule

    @property
    def schedule_entries(self):
        """Get the schedule entries from the schedule container or use internal entries"""
        if self.schedule and hasattr(self.schedule, 'entries'):
            return self.schedule.entries
        return self._schedule_entries

    @schedule_entries.setter
    def schedule_entries(self, value):
        """Set the schedule entries"""
        self._schedule_entries = value

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
        Main method to generate a schedule for the given date range

        Args:
            start_date: Start date for the schedule
            end_date: End date for the schedule
            config: Optional configuration overrides
            create_empty_schedules: Whether to create placeholders for days with no assignments
            version: Schedule version number

        Returns:
            Dictionary with schedule data and metadata
        """
        self.logging_manager.start_step("Schedule Generation")

        try:
            # First validate that all shifts have durations (fix for "Schichtdauer fehlt" error)
            if hasattr(self, "_validate_shift_durations"):
                try:
                    self._validate_shift_durations()
                except Exception as e:
                    self.logger.error(f"Shift validation failed: {str(e)}")
                    raise ScheduleGenerationError("Schichtdauer fehlt") from e

            # Apply configuration if provided
            if config:
                self.config.apply_override(config)

            # Initialize empty schedule
            self.schedule = ScheduleContainer(start_date, end_date, version=version or 1)
            self.schedule.entries = []

            # Process each date in the range
            date_range = {"start": start_date, "end": end_date}
            date_metadata = {
                "dates_processed": 0,
                "dates_with_coverage": 0,
                "empty_dates": 0,
                "assignments_created": 0,
                "invalid_assignments": 0,
            }

            current_date = start_date
            while current_date <= end_date:
                self.logger.info(f"Processing date: {current_date.isoformat()}")
                date_metadata["dates_processed"] += 1

                # Get shifts needed for this date
                try:
                    shifts, coverage = self._get_shifts_for_date(current_date)
                    if shifts:
                        date_metadata["dates_with_coverage"] += 1
                    else:
                        date_metadata["empty_dates"] += 1
                        self.logger.info(f"No shifts required for {current_date}")
                except Exception as e:
                    self.logger.error(f"Error getting shifts for {current_date}: {str(e)}")
                    date_metadata["empty_dates"] += 1
                    shifts, coverage = [], {}

                # Only try to assign employees if we have shifts for this date
                if shifts:
                    try:
                        # Add FORCE_ASSIGN=True flag for fallback assignment
                        if not hasattr(self.config, "FORCE_ASSIGN"):
                            self.config.FORCE_ASSIGN = True
                        # Assign employees to shifts using the distribution manager
                        assignments = self.distribution_manager.assign_employees_with_distribution(
                            current_date, shifts, coverage
                        )

                        # FALLBACK: If no assignments made and we have employees and shifts, force assignments
                        if not assignments and self.resources.employees and shifts and self.config.FORCE_ASSIGN:
                            self.logger.warning(f"No regular assignments made for {current_date}, using fallback assignment")
                            assignments = self._fallback_assign_employees(current_date, shifts)
                            
                        # Add assignments to the schedule
                        if assignments:
                            for assignment in assignments:
                                self.schedule.add_assignment(assignment)
                                date_metadata["assignments_created"] += 1
                        else:
                            self.logger.warning(f"No assignments made for {current_date}")
                    except Exception as e:
                        self.logger.error(f"Error assigning employees: {str(e)}")
                        self.logger.error("Stack trace:", exc_info=True)

                # Move to next date
                current_date = current_date + timedelta(days=1)

            # If no assignments were created, try to create empty placeholders
            if date_metadata["assignments_created"] == 0 and create_empty_schedules:
                self.logger.warning("No assignments were created, adding empty placeholders")
                self._create_empty_placeholders(date_range)

            # If still no entries, add at least one placeholder entry
            if not self.schedule.entries:
                self.logger.warning("No entries in schedule, adding emergency placeholder")
                empty_assignment = {
                    "employee_id": -1,  # Placeholder employee
                    "shift_id": -1,  # Placeholder shift
                    "date": start_date.isoformat(),
                    "status": "EMPTY",
                    "is_placeholder": True,
                }
                self.schedule.add_assignment(empty_assignment)

            # Finalize the schedule
            if hasattr(self, "_finalize_schedule"):
                self._finalize_schedule(date_range, self.resources.employees)

            # Fix: Use end_step instead of complete_step for LoggingManager
            self.logging_manager.end_step()

            # Generate result - FIX: use serializer to convert schedule to JSON-serializable dict
            # IMPORTANT: Avoid directly including the schedule object in the result
            schedule_dict = self._schedule_to_dict(self.schedule)
            
            result = {
                "schedule": schedule_dict,
                "metadata": {
                    "success": True,
                    "version": self.schedule.version,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "date_count": (end_date - start_date).days + 1,
                    "dates_with_coverage": date_metadata["dates_with_coverage"],
                    "empty_dates": date_metadata["empty_dates"],
                    "valid_assignments": date_metadata["assignments_created"],
                    "invalid_assignments": date_metadata["invalid_assignments"],
                },
            }

            # Add distribution metrics if available
            if hasattr(self.distribution_manager, "get_distribution_metrics"):
                metrics = self.distribution_manager.get_distribution_metrics()
                if metrics:
                    result["metadata"]["metrics"] = metrics

            return result

        except Exception as e:
            self.logger.error(f"Error generating schedule: {str(e)}")
            self.logger.error("Stack trace:", exc_info=True)
            raise

    def _validate_shift_durations(self):
        """
        Validate that all shift templates have durations
        Raises ScheduleGenerationError if validation fails
        """
        missing_durations = []
        self.logger.info("Validating shift durations...")
        
        if not self.resources.shifts:
            self.logger.warning("No shifts found to validate")
            return []

        for shift in self.resources.shifts:
            # First check if the shift already has a valid duration
            has_duration = False
            duration_hours = None
            
            # Try to get the duration directly
            if hasattr(shift, "duration_hours") and shift.duration_hours is not None:
                try:
                    duration_hours = float(shift.duration_hours)
                    if duration_hours > 0:
                        has_duration = True
                        self.logger.debug(f"Shift {shift.id} has valid duration: {duration_hours}h")
                except (ValueError, TypeError):
                    self.logger.warning(f"Invalid duration value for shift {shift.id}: {shift.duration_hours}")
            
            # If no duration yet, try to calculate from start and end times
            if not has_duration and hasattr(shift, "start_time") and hasattr(shift, "end_time"):
                if shift.start_time and shift.end_time:
                    try:
                        # Calculate duration from times
                        start_hour, start_min = map(int, shift.start_time.split(":"))
                        end_hour, end_min = map(int, shift.end_time.split(":"))
                        
                        # Handle shifts spanning midnight
                        if end_hour < start_hour:
                            end_hour += 24
                        
                        start_minutes = start_hour * 60 + start_min
                        end_minutes = end_hour * 60 + end_min
                        
                        duration_minutes = end_minutes - start_minutes
                        duration_hours = duration_minutes / 60.0
                        
                        # Update the shift with calculated duration
                        if duration_hours > 0:
                            has_duration = True
                            if hasattr(shift, "_calculate_duration"):
                                shift._calculate_duration()
                            else:
                                shift.duration_hours = duration_hours
                                
                            self.logger.debug(f"Calculated duration for shift {shift.id}: {duration_hours}h")
                    except Exception as e:
                        self.logger.warning(f"Failed to calculate duration for shift {shift.id}: {str(e)}")
            
            # If still no duration, add to missing list
            if not has_duration:
                shift_id = getattr(shift, "id", "Unknown ID")
                missing_durations.append(shift_id)
                self.logger.warning(
                    f"Shift {shift_id} missing duration. "
                    f"Start time: {getattr(shift, 'start_time', 'N/A')}, "
                    f"End time: {getattr(shift, 'end_time', 'N/A')}"
                )

        if missing_durations:
            self.logger.error(f"Found {len(missing_durations)} shifts missing durations: {missing_durations}")
            raise ScheduleGenerationError(f"Schichtdauer fehlt für {len(missing_durations)} Schichten")

        self.logger.info(f"Successfully validated {len(self.resources.shifts)} shifts")
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

    def _finalize_schedule(self, date_range, employees):
        """Finalize the schedule by adding placeholder shifts for non-working days."""
        try:
            from models.fixed_shift import ShiftType
        except ImportError:
            try:
                from src.backend.models.fixed_shift import ShiftType
            except ImportError:
                # Use the try_import utility function defined earlier
                ShiftTypeModule = try_import("models.fixed_shift", "ShiftType")
                if ShiftTypeModule:
                    ShiftType = ShiftTypeModule
                else:
                    # Fallback to string value if import fails
                    class ShiftType:
                        NON_WORKING = "NON_WORKING"
        
        # Don't import Schedule as it's not used
        
        schedule_entries = self.schedule_entries
        
        # Group existing entries by employee and date
        scheduled_days = {}
        for entry in schedule_entries:
            employee_id = entry['employee_id']
            date = entry['date']
            if employee_id not in scheduled_days:
                scheduled_days[employee_id] = set()
            scheduled_days[employee_id].add(date)
        
        # Create a placeholder shift for NON_WORKING days
        non_working_shift = {
            'id': -1,  # Special ID for non-working shifts
            'shift_type_id': ShiftType.NON_WORKING,
            'start_time': '00:00',
            'end_time': '00:00',
            'break_duration': 0,
            'color': '#cccccc'
        }
        
        # Add NON_WORKING entries for all dates in range where employees don't have shifts
        new_entries = []
        start_date = date_range['start']
        end_date = date_range['end']
        
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.isoformat().split('T')[0]
            
            for employee in employees:
                employee_id = employee.id
                
                # Check if the employee already has a shift on this day
                if employee_id in scheduled_days and date_str in scheduled_days[employee_id]:
                    continue
                
                # Check if this is a work day for the employee based on contracted hours
                # For simplicity, we're just checking if it's a weekday
                is_weekday = current_date.weekday() < 5
                
                if is_weekday:
                    # Add a NON_WORKING placeholder
                    new_entry = {
                        'employee_id': employee_id,
                        'shift_id': non_working_shift['id'],
                        'shift_type_id': non_working_shift['shift_type_id'],
                        'date': date_str,
                        'shift_start': non_working_shift['start_time'],
                        'shift_end': non_working_shift['end_time'],
                        'break_duration': non_working_shift['break_duration'],
                        'notes': 'Kein Einsatz an diesem Tag',
                        'status': 'GENERATED',
                        'is_empty': True
                    }
                    new_entries.append(new_entry)
            
            current_date = current_date + timedelta(days=1)
        
        # Add the new entries to the schedule
        self.schedule_entries.extend(new_entries)
        
        return self.schedule_entries

    def _fallback_assign_employees(self, current_date: date, shifts: List[Any]) -> List[Dict]:
        """Emergency fallback method to ensure shifts are assigned even when normal assignment fails"""
        self.logger.info(f"Using fallback assignment method for {current_date}")
        assignments = []
        
        # Group shifts by type for more organized assignment
        shifts_by_type = {}
        for shift in shifts:
            # Get shift type
            shift_type = None
            if isinstance(shift, dict):
                shift_type = shift.get("shift_type_id", "MIDDLE")
            else:
                shift_type = getattr(shift, "shift_type_id", "MIDDLE")
                
            if not shift_type:
                # Use time-based categorization
                start_time = None
                if isinstance(shift, dict):
                    start_time = shift.get("start_time", "12:00")
                else:
                    start_time = getattr(shift, "start_time", "12:00")
                
                try:
                    start_hour = int(start_time.split(":")[0])
                    if start_hour < 11:
                        shift_type = "EARLY"
                    elif start_hour >= 14:
                        shift_type = "LATE"
                    else:
                        shift_type = "MIDDLE"
                except (ValueError, IndexError):
                    shift_type = "MIDDLE"
            
            if shift_type not in shifts_by_type:
                shifts_by_type[shift_type] = []
            shifts_by_type[shift_type].append(shift)
        
        # Get a copy of active employees to work with
        active_employees = [e for e in self.resources.employees if getattr(e, "is_active", True)]
        
        # If no active employees, create a placeholder
        if not active_employees:
            self.logger.warning("No active employees found, creating placeholder employee")
            from models.employee import Employee, EmployeeGroup
            placeholder = Employee(
                first_name="Placeholder",
                last_name="Employee",
                employee_group=EmployeeGroup.VZ.value,
                contracted_hours=40
            )
            placeholder.id = -1
            placeholder.is_active = True
            active_employees = [placeholder]
        
        # Assign each shift
        employee_index = 0
        for shift_type, type_shifts in shifts_by_type.items():
            for shift in type_shifts:
                # Get shift ID
                shift_id = None
                if isinstance(shift, dict):
                    shift_id = shift.get("shift_id", shift.get("id"))
                else:
                    shift_id = getattr(shift, "shift_id", getattr(shift, "id", None))
                
                if shift_id is None:
                    self.logger.warning(f"Cannot determine shift ID for {shift}, skipping")
                    continue
                
                # Get shift times
                start_time = None
                end_time = None
                if isinstance(shift, dict):
                    start_time = shift.get("start_time", "08:00")
                    end_time = shift.get("end_time", "16:00")
                else:
                    start_time = getattr(shift, "start_time", "08:00")
                    end_time = getattr(shift, "end_time", "16:00")
                
                # Select an employee using round-robin
                if active_employees:
                    employee = active_employees[employee_index % len(active_employees)]
                    employee_index += 1
                    
                    assignment = {
                        "employee_id": employee.id,
                        "shift_id": shift_id,
                        "date": current_date,
                        "start_time": start_time,
                        "end_time": end_time,
                        "shift_type": shift_type,
                        "status": "GENERATED",
                        "fallback_assigned": True
                    }
                    
                    assignments.append(assignment)
                    self.logger.info(f"Fallback assigned employee {employee.id} to shift {shift_id}")
        
        self.logger.info(f"Fallback assignment created {len(assignments)} assignments")
        return assignments

    def _get_shifts_for_date(self, current_date: date) -> tuple:
        """
        Get the shifts needed for a specific date based on coverage requirements
        
        Args:
            current_date: The date to get shifts for
            
        Returns:
            Tuple of (shifts, coverage)
        """
        self.logger.info(f"Getting shifts for date {current_date}")
        
        # Process coverage for this date
        coverage = self._process_coverage(current_date)
        if not coverage:
            self.logger.warning(f"No coverage requirements found for date {current_date}")
            return [], {}

        # Create shifts for this date
        date_shifts = self._create_date_shifts(current_date)
        if not date_shifts:
            self.logger.warning(f"No shifts available for date {current_date}")
            return [], coverage

        self.logger.info(
            f"Found {len(date_shifts)} shifts and need {coverage.get('total', 0)} total employees for {current_date}"
        )
        
        return date_shifts, coverage
        
    def _create_empty_placeholders(self, date_range: dict):
        """
        Create empty placeholder entries for all dates in the range
        
        Args:
            date_range: Dictionary with 'start' and 'end' date keys
        """
        self.logger.info("Creating empty placeholder entries")
        
        start_date = date_range.get('start')
        end_date = date_range.get('end')
        
        if not start_date or not end_date:
            self.logger.warning("Invalid date range for creating placeholders")
            return
            
        current_date = start_date
        while current_date <= end_date:
            empty_assignment = {
                "employee_id": -1,  # Placeholder employee
                "shift_id": -1,  # Placeholder shift
                "date": current_date.isoformat(),
                "status": "EMPTY",
                "is_placeholder": True,
                "notes": "Kein Einsatz an diesem Tag"
            }
            self.schedule.add_assignment(empty_assignment)
            self.logger.debug(f"Added empty placeholder for {current_date}")
            
            # Move to next date
            current_date = current_date + timedelta(days=1)
            
        self.logger.info(f"Created {(end_date - start_date).days + 1} placeholder entries")

    def _schedule_to_dict(self, schedule) -> Dict[str, Any]:
        """
        Convert a ScheduleContainer object to a JSON-serializable dictionary
        
        Args:
            schedule: The ScheduleContainer object to convert
            
        Returns:
            A dictionary representation of the schedule that is JSON-serializable
        """
        if not schedule:
            return {}
            
        # Basic schedule metadata
        schedule_dict = {
            "id": getattr(schedule, "id", None),
            "version": getattr(schedule, "version", 1),
            "status": getattr(schedule, "status", "DRAFT"),
            "start_date": getattr(schedule, "start_date", None),
            "end_date": getattr(schedule, "end_date", None),
        }
        
        # Convert date objects to ISO strings
        if isinstance(schedule_dict["start_date"], date):
            schedule_dict["start_date"] = schedule_dict["start_date"].isoformat()
        if isinstance(schedule_dict["end_date"], date):
            schedule_dict["end_date"] = schedule_dict["end_date"].isoformat()
            
        # Convert entries to dictionaries
        entries = []
        for entry in schedule.entries:
            if isinstance(entry, dict):
                # Make a copy to avoid modifying the original
                entry_dict = entry.copy()
                
                # Convert any date objects to ISO strings
                if "date" in entry_dict and isinstance(entry_dict["date"], date):
                    entry_dict["date"] = entry_dict["date"].isoformat()
                    
            else:
                # Convert object to dictionary
                entry_dict = {
                    "id": getattr(entry, "id", None),
                    "employee_id": getattr(entry, "employee_id", None),
                    "shift_id": getattr(entry, "shift_id", None),
                    "date": getattr(entry, "date", None),
                    "status": getattr(entry, "status", "DRAFT"),
                    "version": getattr(entry, "version", 1),
                }
                
                # Convert date object to ISO string
                if isinstance(entry_dict["date"], date):
                    entry_dict["date"] = entry_dict["date"].isoformat()
                
                # Add additional properties if available
                if hasattr(entry, "start_time"):
                    entry_dict["start_time"] = entry.start_time
                if hasattr(entry, "end_time"):
                    entry_dict["end_time"] = entry.end_time
                if hasattr(entry, "shift_type"):
                    entry_dict["shift_type"] = entry.shift_type
                if hasattr(entry, "notes"):
                    entry_dict["notes"] = entry.notes
                if hasattr(entry, "is_placeholder"):
                    entry_dict["is_placeholder"] = entry.is_placeholder
            
            entries.append(entry_dict)
            
        schedule_dict["entries"] = entries
        return schedule_dict
