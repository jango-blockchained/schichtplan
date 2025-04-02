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
from collections import defaultdict

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
        
        # Start time for measuring generation time
        generation_start_time = datetime.now()
        
        self.logger.info(f"[DIAGNOSTIC] Beginning schedule generation from {start_date} to {end_date}, version {version or 1}")
        self.logger.info(f"[DIAGNOSTIC] Create empty schedules: {create_empty_schedules}")
        
        # Create a result object to collect all diagnostic information
        result = {
            "success": False,
            "schedules": [],
            "warnings": [],
            "errors": [],
            "logs": [],
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "version": version or 1,
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_days": (end_date - start_date).days + 1
            }
        }

        try:
            # Make sure resources are loaded for these dates
            self.logger.info(f"[DIAGNOSTIC] Loading resources for date range {start_date} to {end_date}")
            if not hasattr(self.resources, 'start_date') or self.resources.start_date != start_date or self.resources.end_date != end_date:
                self.resources.start_date = start_date
                self.resources.end_date = end_date
                
            # Force resources to load/reload
            if not self.resources.is_loaded():
                self.logger.info("[DIAGNOSTIC] Resources not loaded - loading now")
                load_success = self.resources.load()
                if not load_success:
                    error_msg = "Failed to load resources"
                    self.logger.error(f"[DIAGNOSTIC] {error_msg}")
                    result["errors"].append(error_msg)
                    raise ScheduleGenerationError(error_msg)
                self.logger.info("[DIAGNOSTIC] Resources loaded successfully")
            else:
                self.logger.info("[DIAGNOSTIC] Resources already loaded")
            
            # Log the resource counts
            self.logger.info(f"[DIAGNOSTIC] Resources loaded: {bool(self.resources)}")
            employee_count = len(self.resources.employees) if hasattr(self.resources, 'employees') and self.resources.employees else 0
            shift_count = len(self.resources.shifts) if hasattr(self.resources, 'shifts') and self.resources.shifts else 0
            coverage_count = len(getattr(self.resources, 'coverage', [])) if hasattr(self.resources, 'coverage') else 0
            
            self.logger.info(f"[DIAGNOSTIC] Resource counts: {employee_count} employees, {shift_count} shifts, {coverage_count} coverage records")
            
            # Add resource counts to result
            result["metadata"]["resources"] = {
                "employees": employee_count,
                "shifts": shift_count,
                "coverage": coverage_count
            }
            
            if employee_count == 0:
                error_msg = "No employees found in resources"
                self.logger.error(f"[DIAGNOSTIC] {error_msg}")
                result["errors"].append(error_msg)
                raise ScheduleGenerationError(error_msg)
                
            if shift_count == 0:
                error_msg = "No shifts found in resources"
                self.logger.error(f"[DIAGNOSTIC] {error_msg}")
                result["errors"].append(error_msg)
                raise ScheduleGenerationError(error_msg)
                
            if coverage_count == 0:
                warning_msg = "No coverage data found in resources, using default coverage"
                self.logger.warning(f"[DIAGNOSTIC] {warning_msg}")
                result["warnings"].append(warning_msg)

            # First validate that all shifts have durations (fix for "Schichtdauer fehlt" error)
            if hasattr(self, "_validate_shift_durations"):
                try:
                    self.logger.info("[DIAGNOSTIC] Validating shift durations")
                    self._validate_shift_durations()
                    result["logs"].append("Shift durations validated successfully")
                except Exception as e:
                    error_msg = f"Shift validation failed: {str(e)}"
                    self.logger.error(f"[DIAGNOSTIC] {error_msg}")
                    result["errors"].append(error_msg)
                    raise ScheduleGenerationError("Schichtdauer fehlt") from e

            # Apply configuration if provided
            if config:
                self.logger.info("[DIAGNOSTIC] Applying custom configuration")
                self.config.apply_override(config)
                result["logs"].append("Applied custom configuration")

            # Initialize empty schedule
            self.schedule = ScheduleContainer(start_date, end_date, version=version or 1)
            self.schedule.entries = []
            self.logger.info("[DIAGNOSTIC] Initialized empty schedule container")

            # Create empty slots for each date first
            current_date = start_date
            while current_date <= end_date:
                self._create_empty_schedule_entries(current_date)
                current_date += timedelta(days=1)

            # Process each date in the range
            date_range = {"start": start_date, "end": end_date}
            date_metadata = {
                "dates_processed": 0,
                "dates_with_coverage": 0,
                "empty_dates": 0,
                "assignments_created": 0,
                "invalid_assignments": 0,
                "assignments_by_date": {},
            }

            current_date = start_date
            while current_date <= end_date:
                self.logger.info(f"[DIAGNOSTIC] Processing date: {current_date.isoformat()}")
                date_metadata["dates_processed"] += 1
                date_metadata["assignments_by_date"][current_date.isoformat()] = 0

                # Get shifts needed for this date
                try:
                    shifts, coverage = self._get_shifts_for_date(current_date)
                    if shifts:
                        date_metadata["dates_with_coverage"] += 1
                        self.logger.debug(f"[DIAGNOSTIC] Date {current_date} has {len(shifts)} shifts and coverage data: {coverage}")
                    else:
                        date_metadata["empty_dates"] += 1
                        self.logger.info(f"[DIAGNOSTIC] No shifts required for {current_date}")
                except Exception as e:
                    self.logger.error(f"[DIAGNOSTIC] Error getting shifts for {current_date}: {str(e)}")
                    date_metadata["empty_dates"] += 1
                    result["errors"].append(f"Failed to get shifts for {current_date}: {str(e)}")
                    shifts, coverage = [], {}

                # Only try to assign employees if we have shifts for this date
                if shifts:
                    try:
                        # Add FORCE_ASSIGN=True flag for fallback assignment
                        if not hasattr(self.config, "FORCE_ASSIGN"):
                            self.config.FORCE_ASSIGN = True
                        # Assign employees to shifts using the distribution manager
                        self.logger.info(f"[DIAGNOSTIC] Assigning employees for {current_date} with {len(shifts)} shifts")
                        assignments = self._generate_assignments_for_date(current_date)
                        
                        if assignments:
                            self.logger.info(f"[DIAGNOSTIC] Regular assignment created {len(assignments)} assignments for {current_date}")
                        else:
                            self.logger.warning(f"[DIAGNOSTIC] Regular assignment created 0 assignments for {current_date}")

                        # FALLBACK: If no assignments made and we have employees and shifts, force assignments
                        if not assignments and self.resources.employees and shifts and self.config.FORCE_ASSIGN:
                            self.logger.warning(f"[DIAGNOSTIC] No regular assignments made for {current_date}, using fallback assignment")
                            assignments = self._fallback_assign_employees(current_date, shifts)
                            if assignments:
                                self.logger.info(f"[DIAGNOSTIC] Fallback created {len(assignments)} assignments for {current_date}")
                                result["logs"].append(f"Used fallback assignment for {current_date}")
                            else:
                                self.logger.error(f"[DIAGNOSTIC] Fallback assignment also failed for {current_date}")
                                result["errors"].append(f"Failed to create any assignments for {current_date}")
                            
                        # Add assignments to the schedule
                        if assignments:
                            for assignment in assignments:
                                self.schedule.add_assignment(assignment)
                                date_metadata["assignments_created"] += 1
                                date_metadata["assignments_by_date"][current_date.isoformat()] += 1
                        else:
                            self.logger.warning(f"[DIAGNOSTIC] No assignments made for {current_date} after all attempts")
                            result["warnings"].append(f"No assignments made for {current_date}")
                    except Exception as e:
                        self.logger.error(f"[DIAGNOSTIC] Error assigning employees for {current_date}: {str(e)}")
                        self.logger.error("[DIAGNOSTIC] Stack trace:", exc_info=True)
                        result["errors"].append(f"Assignment error for {current_date}: {str(e)}")

                # Move to next date
                current_date = current_date + timedelta(days=1)

            # Finalize the schedule
            if hasattr(self, "_finalize_schedule"):
                self.logger.info("[DIAGNOSTIC] Finalizing schedule")
                self._finalize_schedule(date_range, self.resources.employees)
                result["logs"].append("Schedule finalized")

            # Summarize the generation results
            generation_time = datetime.now() - generation_start_time
            self.logger.info(
                f"[DIAGNOSTIC] Schedule generation completed in {generation_time.total_seconds():.2f} seconds\n"
                f"  - Dates processed: {date_metadata['dates_processed']}\n"
                f"  - Dates with coverage: {date_metadata['dates_with_coverage']}\n"
                f"  - Empty dates: {date_metadata['empty_dates']}\n"
                f"  - Assignments created: {date_metadata['assignments_created']}\n"
                f"  - Invalid assignments: {date_metadata['invalid_assignments']}"
            )

            # Detailed assignments by date
            for date_str, count in date_metadata["assignments_by_date"].items():
                self.logger.debug(f"[DIAGNOSTIC] Assignments for {date_str}: {count}")

            # Add metadata to result
            result["metadata"]["date_metadata"] = date_metadata
            result["metadata"]["generation_time_seconds"] = generation_time.total_seconds()
            result["success"] = True

            # Convert schedule entries to dictionaries
            schedule_dict = self.serializer.serialize_schedule(self.schedule)
            if isinstance(schedule_dict, dict):
                result["schedules"] = [schedule_dict]  # Wrap in array
            else:
                result["schedules"] = schedule_dict
            result["total_schedules"] = len(result["schedules"])

            # End the schedule generation step with success
            self.logging_manager.end_step()

            self.logger.info(f"[DIAGNOSTIC] Returning {len(result['schedules'])} schedule entries")

            return result

        except Exception as e:
            # Log detailed error information
            self.logger.error(f"[DIAGNOSTIC] Fatal error in schedule generation: {str(e)}")
            self.logger.error("[DIAGNOSTIC] Stack trace:", exc_info=True)
            
            # Try to gather any partial results
            if self.schedule and hasattr(self.schedule, 'entries'):
                partial_entries = self.serializer.serialize_schedule(self.schedule)
                if isinstance(partial_entries, dict):
                    result["schedules"] = [partial_entries]  # Wrap in array
                else:
                    result["schedules"] = partial_entries
                result["partial_result"] = True
                result["total_schedules"] = len(result["schedules"])
                
            # Add error information
            result["success"] = False
            result["error"] = str(e)
            result["errors"].append(str(e))
            
            # End the step with error
            self.logging_manager.end_step({"error": str(e)})
            
            return result

    def _fallback_assign_employees(self, current_date: date, shifts: List[Any]) -> List[Dict]:
        """Emergency fallback method to ensure shifts are assigned even when normal assignment fails"""
        self.logger.info(f"[DIAGNOSTIC] Using fallback assignment method for {current_date}")
        assignments = []
        
        # Log the input shifts
        if not shifts:
            self.logger.error(f"[DIAGNOSTIC] No shifts provided to fallback assignment for {current_date}")
            return []
            
        self.logger.info(f"[DIAGNOSTIC] Fallback assignment received {len(shifts)} shifts for {current_date}")
        
        # Group shifts by type for more organized assignment
        shifts_by_type = {}
        for i, shift in enumerate(shifts):
            # Get shift details for logging
            shift_id = None
            if isinstance(shift, dict):
                shift_id = shift.get("shift_id") or shift.get("id")
            else:
                shift_id = getattr(shift, "shift_id", None) or getattr(shift, "id", None)
                
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
            
            # Log shift details
            self.logger.debug(f"[DIAGNOSTIC] Shift {i+1}: ID={shift_id}, Type={shift_type}")
            
            if shift_type not in shifts_by_type:
                shifts_by_type[shift_type] = []
            shifts_by_type[shift_type].append(shift)
        
        # Log shift groups
        for shift_type, type_shifts in shifts_by_type.items():
            self.logger.info(f"[DIAGNOSTIC] Shift type {shift_type}: {len(type_shifts)} shifts")
        
        # Get a copy of active employees to work with
        all_employees = getattr(self.resources, "employees", [])
        if not all_employees:
            self.logger.error(f"[DIAGNOSTIC] No employees found in resources!")
            return []
            
        active_employees = [e for e in all_employees if getattr(e, "is_active", True)]
        
        self.logger.info(f"[DIAGNOSTIC] Found {len(active_employees)} active employees out of {len(all_employees)} total")
        
        # If no active employees, create a placeholder
        if not active_employees:
            self.logger.warning("[DIAGNOSTIC] No active employees found, creating placeholder employee")
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
        
        # Log the employees we'll be using
        for i, emp in enumerate(active_employees[:5]):  # Log first 5 employees
            emp_id = getattr(emp, "id", "unknown")
            emp_name = f"{getattr(emp, 'first_name', '')} {getattr(emp, 'last_name', '')}"
            emp_group = getattr(emp, "employee_group", "unknown")
            emp_hours = getattr(emp, "contracted_hours", 0)
            self.logger.debug(f"[DIAGNOSTIC] Employee {i+1}: ID={emp_id}, Name={emp_name}, Group={emp_group}, Hours={emp_hours}")
        
        if len(active_employees) > 5:
            self.logger.debug(f"[DIAGNOSTIC] ... and {len(active_employees) - 5} more employees")
        
        # Track assignment counts
        assignments_by_type = defaultdict(int)
        assignments_by_employee = defaultdict(int)
        unassignable_shifts = 0
        
        # Assign each shift
        employee_index = 0
        for shift_type, type_shifts in shifts_by_type.items():
            for shift_idx, shift in enumerate(type_shifts):
                # Get shift ID
                shift_id = None
                if isinstance(shift, dict):
                    shift_id = shift.get("shift_id", shift.get("id"))
                else:
                    shift_id = getattr(shift, "shift_id", getattr(shift, "id", None))
                
                if shift_id is None:
                    self.logger.warning(f"[DIAGNOSTIC] Cannot determine shift ID for shift {shift_idx+1} of type {shift_type}, skipping")
                    unassignable_shifts += 1
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
                    
                    emp_id = getattr(employee, "id", "unknown")
                    emp_name = f"{getattr(employee, 'first_name', '')} {getattr(employee, 'last_name', '')}"
                    
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
                    assignments_by_type[shift_type] += 1
                    assignments_by_employee[emp_id] += 1
                    self.logger.info(f"[DIAGNOSTIC] Fallback assigned employee {emp_id} ({emp_name}) to shift {shift_id} ({start_time}-{end_time})")
        
        # Log comprehensive summary
        self.logger.info(
            f"[DIAGNOSTIC] Fallback assignment summary for {current_date}:\n"
            f"  - Total shifts: {len(shifts)}\n"
            f"  - Unassignable shifts: {unassignable_shifts}\n"
            f"  - Assigned shifts: {len(assignments)}\n"
            f"  - Assignment by type: {dict(assignments_by_type)}\n"
            f"  - Unique employees assigned: {len(assignments_by_employee)}\n"
            f"  - Max shifts per employee: {max(assignments_by_employee.values()) if assignments_by_employee else 0}"
        )
        
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
        
    def _create_empty_schedule_entries(self, current_date: date):
        """Create empty schedule entries for a specific date"""
        empty_assignment = {
            "date": current_date,
            "status": "EMPTY",
            "version": 1,
        }
        self.schedule.entries.append(empty_assignment)
        self.schedule_by_date[current_date] = [empty_assignment]

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

    def __del__(self):
        """Ensure cleanup of resources when the generator is deleted"""
        try:
            # Make sure we end the process properly to write all logs
            if hasattr(self, 'logging_manager'):
                self.logging_manager.end_process({"status": "completed"})
        except Exception:
            # Silent error - just making sure we don't crash during cleanup
            pass

    def _find_best_employee_for_shift(self, shift, available_employees, current_date):
        """Find the best employee for a given shift based on various criteria."""
        try:
            best_employee = None
            min_assigned_shifts = float('inf')
            
            for employee in available_employees:
                # Skip if employee is not available for this shift
                if not self._is_employee_available_for_shift(employee, shift, current_date):
                    continue
                    
                # Count how many shifts this employee already has
                assigned_shifts = len([
                    entry for entry in self.schedule.entries 
                    if entry.get('employee_id') == employee.id 
                    and entry.get('shift_id') is not None
                ])
                
                # Prefer employee with fewer assigned shifts
                if assigned_shifts < min_assigned_shifts:
                    min_assigned_shifts = assigned_shifts
                    best_employee = employee
                    
            return best_employee
            
        except Exception as e:
            self.logger.error(f"Error finding best employee for shift: {str(e)}")
            return None

    def _is_employee_available_for_shift(self, employee, shift, current_date):
        """Check if an employee is available for a given shift."""
        try:
            # Check if employee is on leave
            if self.resources.is_employee_on_leave(employee.id, current_date):
                return False
                
            # Get employee availability records
            availability_records = self.resources.get_employee_availability(employee.id, current_date)
            
            # If no availability records, consider employee available
            if not availability_records:
                return True
                
            # Check if any availability record indicates the employee is available
            shift_start = shift.get('start_time', '00:00')
            shift_end = shift.get('end_time', '00:00')
            
            for record in availability_records:
                if record.get('is_available', True):
                    # Convert availability record hour to time string
                    hour = record.get('hour', 0)
                    avail_start = f"{hour:02d}:00"
                    avail_end = f"{hour + 1:02d}:00"
                    
                    # Check if availability overlaps with shift time
                    if (avail_start <= shift_end and avail_end >= shift_start):
                        return True
                        
            return False
            
        except Exception as e:
            self.logger.error(f"Error checking employee availability: {str(e)}")
            return False

    def _process_coverage(self, current_date: date) -> Dict[str, Any]:
        """
        Process coverage records to determine staffing needs for a date.
        Returns a dictionary with:
        - coverage_blocks: List of 15-minute coverage blocks with required staff
        - total_needed: Total staff needed for the day
        - peak_times: Times with highest staff requirements
        - coverage_windows: Consolidated time windows with staff requirements
        """
        # Convert Python's weekday (0=Monday) to our day_index (0=Sunday)
        python_weekday = current_date.weekday()
        check_day_index = (python_weekday + 6) % 7
        
        self.logger.info(
            f"Processing coverage for date {current_date} "
            f"(Python weekday={python_weekday} [{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][python_weekday]}], "
            f"Coverage day_index={check_day_index} [{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][check_day_index]}])"
        )
        
        # Initialize coverage blocks (96 blocks of 15 minutes for 24 hours)
        coverage_blocks = []
        for hour in range(24):
            for minute in range(0, 60, 15):
                time_str = f"{hour:02d}:{minute:02d}"
                coverage_blocks.append({
                    "time": time_str,
                    "staff_needed": 0,
                    "staff_assigned": 0
                })
        
        total_staff_needed = 0
        peak_times = []
        matching_coverage = []
        
        # Find coverage records for this date
        for coverage in self.resources.coverage:
            # Check if coverage applies to this date
            if self._coverage_applies_to_date(coverage, current_date):
                matching_coverage.append(coverage)
                start_time = getattr(coverage, "start_time", "00:00")
                end_time = getattr(coverage, "end_time", "00:00")
                staff_needed = getattr(coverage, "min_employees", 0)
                
                # Convert times to block indices
                start_idx = self._time_to_block_index(start_time)
                end_idx = self._time_to_block_index(end_time)
                
                # Update blocks
                for i in range(start_idx, end_idx):
                    coverage_blocks[i]["staff_needed"] = max(
                        coverage_blocks[i]["staff_needed"],
                        staff_needed
                    )
                
                total_staff_needed = max(total_staff_needed, staff_needed)
                
                # Track peak times (periods with highest staff requirements)
                if staff_needed == total_staff_needed:
                    peak_times.append({
                        "start": start_time,
                        "end": end_time,
                        "staff": staff_needed
                    })
        
        if not matching_coverage:
            self.logger.warning(f"No coverage information available for {current_date}")
            return {
                "coverage_blocks": coverage_blocks,
                "total_needed": 0,
                "peak_times": [],
                "coverage_windows": []
            }
        
        self.logger.info(f"Found {len(matching_coverage)} matching coverage records for {current_date}")
        for i, cov in enumerate(matching_coverage):
            self.logger.debug(
                f"Coverage {i+1}: {getattr(cov, 'start_time', '00:00')}-{getattr(cov, 'end_time', '00:00')}, "
                f"Staff needed: {getattr(cov, 'min_employees', 0)}"
            )
        
        # Consolidate coverage into windows
        coverage_windows = self._consolidate_coverage_blocks(coverage_blocks)
        
        return {
            "coverage_blocks": coverage_blocks,
            "total_needed": total_staff_needed,
            "peak_times": peak_times,
            "coverage_windows": coverage_windows
        }

    def _time_to_block_index(self, time_str: str) -> int:
        """Convert time string (HH:MM) to block index (0-95)"""
        try:
            hour, minute = map(int, time_str.split(":"))
            return (hour * 4) + (minute // 15)
        except (ValueError, TypeError):
            return 0

    def _consolidate_coverage_blocks(self, blocks: List[Dict]) -> List[Dict]:
        """Consolidate 15-minute blocks into larger windows with same staff requirements"""
        windows = []
        current_window = None
        
        for i, block in enumerate(blocks):
            if not current_window:
                current_window = {
                    "start": block["time"],
                    "staff_needed": block["staff_needed"],
                    "end": None
                }
            elif block["staff_needed"] != current_window["staff_needed"]:
                current_window["end"] = block["time"]
                if current_window["staff_needed"] > 0:
                    windows.append(current_window)
                current_window = {
                    "start": block["time"],
                    "staff_needed": block["staff_needed"],
                    "end": None
                }
        
        if current_window and current_window["staff_needed"] > 0:
            current_window["end"] = "23:45"
            windows.append(current_window)
        
        return windows

    def _adjust_shift_times(self, shift: Dict, coverage_windows: List[Dict]) -> Dict:
        """
        Dynamically adjust shift start/end times to better match coverage needs.
        Returns adjusted shift times or original if no adjustment needed/possible.
        """
        try:
            shift_start = shift.get('start_time', '00:00')
            shift_end = shift.get('end_time', '00:00')
            original_duration = self._calculate_duration(shift_start, shift_end)
            
            # Don't adjust if shift duration is undefined
            if original_duration <= 0:
                return shift
            
            best_start = shift_start
            best_end = shift_end
            best_coverage = 0
            
            # Try different start times within ±1 hour of original
            start_hour, start_min = map(int, shift_start.split(':'))
            for hour_adj in range(-1, 2):  # -1, 0, 1
                for min_adj in range(0, 60, 15):
                    new_start_hour = (start_hour + hour_adj) % 24
                    new_start_min = min_adj
                    new_start = f"{new_start_hour:02d}:{new_start_min:02d}"
                    
                    # Calculate new end time maintaining duration
                    new_end = self._add_duration(new_start, original_duration)
                    
                    # Calculate coverage score for this adjustment
                    coverage_score = self._calculate_coverage_score(
                        new_start, new_end, coverage_windows
                    )
                    
                    if coverage_score > best_coverage:
                        best_start = new_start
                        best_end = new_end
                        best_coverage = coverage_score
            
            # Only adjust if we found a better coverage
            if best_coverage > 0:
                adjusted_shift = shift.copy()
                adjusted_shift['start_time'] = best_start
                adjusted_shift['end_time'] = best_end
                adjusted_shift['is_adjusted'] = True
                return adjusted_shift
            
            return shift
            
        except Exception as e:
            self.logger.error(f"Error adjusting shift times: {str(e)}")
            return shift

    def _calculate_coverage_score(self, start: str, end: str, coverage_windows: List[Dict]) -> float:
        """Calculate how well a shift covers the needed staffing windows"""
        score = 0.0
        shift_blocks = set(self._get_time_blocks(start, end))
        
        for window in coverage_windows:
            window_blocks = set(self._get_time_blocks(window['start'], window['end']))
            overlap = len(shift_blocks & window_blocks)
            
            # Weight score by staff needed and overlap percentage
            if overlap > 0:
                overlap_percentage = overlap / len(window_blocks)
                score += overlap_percentage * window['staff_needed']
        
        return score

    def _get_time_blocks(self, start: str, end: str) -> List[int]:
        """Get list of 15-minute block indices between start and end times"""
        start_idx = self._time_to_block_index(start)
        end_idx = self._time_to_block_index(end)
        return list(range(start_idx, end_idx + 1))

    def _calculate_duration(self, start: str, end: str) -> float:
        """Calculate duration in hours between start and end times"""
        try:
            start_hour, start_min = map(int, start.split(':'))
            end_hour, end_min = map(int, end.split(':'))
            
            # Handle overnight shifts
            if end_hour < start_hour:
                end_hour += 24
            
            duration = (end_hour - start_hour) + (end_min - start_min) / 60.0
            return max(0, duration)
        except (ValueError, TypeError):
            return 0

    def _add_duration(self, start: str, duration: float) -> str:
        """Add duration hours to start time and return end time"""
        try:
            start_hour, start_min = map(int, start.split(':'))
            total_minutes = int(duration * 60)
            
            end_hour = (start_hour + (start_min + total_minutes) // 60) % 24
            end_min = (start_min + total_minutes) % 60
            
            return f"{end_hour:02d}:{end_min:02d}"
        except (ValueError, TypeError):
            return "00:00"

    def _create_date_shifts(self, current_date: date) -> List[Dict]:
        """Create shift instances for a specific date based on shift templates and coverage needs"""
        date_shifts = []
        
        self.logger.debug(f"Creating shifts for date {current_date}")
        
        # Get coverage information first
        coverage_info = self._process_coverage(current_date)
        if not coverage_info or not coverage_info.get('coverage_windows'):
            self.logger.warning(f"No coverage information available for {current_date}")
            return []
        
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
                    
                # Create base shift
                base_shift = {
                    "id": shift_template.id,
                    "shift_template_id": shift_template.id,
                    "date": current_date,
                    "shift_type": shift_type,
                    "start_time": shift_template.start_time,
                    "end_time": shift_template.end_time,
                    "duration_hours": getattr(shift_template, "duration_hours", None)
                }
                
                # Try to adjust shift times to better match coverage
                adjusted_shift = self._adjust_shift_times(base_shift, coverage_info['coverage_windows'])
                
                # Log if shift was adjusted
                if adjusted_shift.get('is_adjusted'):
                    self.logger.info(
                        f"Adjusted shift {shift_template.id} times from "
                        f"{base_shift['start_time']}-{base_shift['end_time']} to "
                        f"{adjusted_shift['start_time']}-{adjusted_shift['end_time']}"
                    )
                    
                date_shifts.append(adjusted_shift)
                self.logger.debug(
                    f"Created {shift_type} shift from template {shift_template.id} "
                    f"({adjusted_shift['start_time']}-{adjusted_shift['end_time']})"
                )
                
        self.logger.debug(f"Created {len(date_shifts)} shifts for date {current_date}")
        return date_shifts

    def _coverage_applies_to_date(self, coverage, check_date: date) -> bool:
        """
        Check if a coverage record applies to the given date.
        Coverage records can be specified in two ways:
        1. Specific date - exact date match
        2. Day of week - recurring weekly pattern where:
            - day_index: 0=Sunday, 1=Monday, ..., 6=Saturday
            - Python's weekday(): 0=Monday, 1=Tuesday, ..., 6=Sunday
        """
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
            # Convert to Sunday=0 format by shifting Monday=0 to Sunday=0
            check_day_index = (python_weekday + 6) % 7  # Subtract 1 is same as add 6 in modulo 7

            self.logger.debug(
                f"Checking coverage for date {check_date}: "
                f"Python weekday={python_weekday} ({['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][python_weekday]}), "
                f"Converted day_index={check_day_index} ({['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][check_day_index]}), "
                f"Coverage day_index={day_of_week}"
            )

            return day_of_week == check_day_index

        return False

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
        """
        Generate assignments for a specific date by matching employees to shifts.
        
        Args:
            current_date: The date to generate assignments for
            
        Returns:
            List of assignment dictionaries
        """
        self.logger.info(f"[DIAGNOSTIC] Generating assignments for {current_date}")
        assignments = []
        
        # Get shifts for this date
        shifts, coverage = self._get_shifts_for_date(current_date)
        if not shifts:
            self.logger.info(f"[DIAGNOSTIC] No shifts to assign for {current_date}")
            return []
            
        # Get available employees
        available_employees = [e for e in self.resources.employees if getattr(e, "is_active", True)]
        if not available_employees:
            self.logger.warning(f"[DIAGNOSTIC] No available employees found for {current_date}")
            return []
            
        self.logger.info(f"[DIAGNOSTIC] Found {len(available_employees)} available employees for {len(shifts)} shifts")
        
        # Track assignments per employee to ensure fair distribution
        assignments_per_employee = defaultdict(int)
        
        # Sort shifts by start time to ensure earlier shifts are assigned first
        shifts.sort(key=lambda x: x.get('start_time', '00:00'))
        
        # Try to assign each shift
        for shift in shifts:
            shift_id = shift.get('id')
            if not shift_id:
                self.logger.warning(f"[DIAGNOSTIC] Shift has no ID, skipping")
                continue
                
            # Find best employee for this shift
            best_employee = self._find_best_employee_for_shift(shift, available_employees, current_date)
            
            if best_employee:
                # Create assignment
                assignment = {
                    "employee_id": best_employee.id,
                    "shift_id": shift_id,
                    "date": current_date,
                    "start_time": shift.get('start_time'),
                    "end_time": shift.get('end_time'),
                    "shift_type": shift.get('shift_type'),
                    "status": "GENERATED"
                }
                
                assignments.append(assignment)
                assignments_per_employee[best_employee.id] += 1
                
                self.logger.info(
                    f"[DIAGNOSTIC] Assigned employee {best_employee.id} to shift {shift_id} "
                    f"({shift.get('start_time')}-{shift.get('end_time')})"
                )
            else:
                self.logger.warning(
                    f"[DIAGNOSTIC] Could not find suitable employee for shift {shift_id} "
                    f"({shift.get('start_time')}-{shift.get('end_time')})"
                )
        
        # Log assignment summary
        self.logger.info(
            f"[DIAGNOSTIC] Assignment summary for {current_date}:\n"
            f"  - Total shifts: {len(shifts)}\n"
            f"  - Assignments made: {len(assignments)}\n"
            f"  - Unique employees assigned: {len(assignments_per_employee)}\n"
            f"  - Max shifts per employee: {max(assignments_per_employee.values()) if assignments_per_employee else 0}"
        )
        
        return assignments
