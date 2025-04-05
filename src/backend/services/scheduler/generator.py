"""Schedule generation service for Schichtplan."""

from datetime import date, datetime, timedelta
import logging
from typing import Dict, List, Any, Optional
import sys
import os
from collections import defaultdict
from functools import lru_cache
from unittest.mock import MagicMock

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Import the extracted modules
from .config import SchedulerConfig, WeightConfig
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

    def __init__(self, resources=None, config=None, params=None, progress_callback=None):
        # Initialize the logging manager
        self.logging_manager = LoggingManager(app_name="scheduler")
        
        # Make sure the logs directory exists
        log_dir = os.path.join(os.getcwd(), "src", "logs")
        diagnostics_dir = os.path.join(log_dir, "diagnostics")
        
        # Create directories if they don't exist
        os.makedirs(log_dir, exist_ok=True)
        os.makedirs(diagnostics_dir, exist_ok=True)
        
        # Set up logging with diagnostic logs enabled by default
        self.logging_manager.setup_logging(
            log_level=logging.INFO,
            log_to_file=True,
            log_dir=None,  # Default: ~/.schichtplan/logs
            app_log_dir=log_dir  # Explicitly provide the log dir
        )
        
        # Start the process tracking
        self.logging_manager.start_process("Schedule Generation")
        self.logger = self.logging_manager.get_logger()

        # Initialize resources and config
        params = params or {}
        self.config = config or SchedulerConfig()
        self.max_days_off_sequence = params.get("max_days_off_sequence", 2)
        self.weekend_split_enabled = params.get("weekend_split_enabled", True)
        self.resources = resources or ScheduleResources()
        self.weight_config = WeightConfig(**params.get("weight_config", {}))
        self.progress_callback = progress_callback

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

    def generate(self, start_date: date, end_date: date, create_empty: bool = False, config: Dict = None) -> Dict:
        """
        Generate a schedule for the given date range.
        
        Args:
            start_date: Start date for scheduling (inclusive)
            end_date: End date for scheduling (inclusive)
            create_empty: If True, create empty schedule entries even if no assignments
            config: Configuration options for the scheduler
            
        Returns:
            Dictionary with schedule results and statistics
        """
        from .day_mapper import get_coverage_day_index
        
        # Validate dates
        if end_date < start_date:
            msg = f"End date {end_date} is before start date {start_date}"
            self.logger.error(msg)
            return {"success": False, "error": msg}
            
        # Initialize scheduler
        if not self._init_scheduler():
            return {
                "success": False, 
                "error": "Failed to initialize scheduler, check logs for details"
            }
            
        # Process configuration
        if config is None:
            config = {}
            
        self.logger.info(f"Generating schedule from {start_date} to {end_date} with config: {config}")
        
        # Track results
        all_assignments = []
        errors = []
        
        # Convert string dates to date objects if needed
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date).date()
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date).date()
        
        # Create schedule object
        schedule = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "schedules": [],
            "total_shifts": 0,
            "errors": errors,
            "success": True
        }
        
        # Generate for each date in range
        current_date = start_date
        while current_date <= end_date:
            try:
                # Skip Sundays by default unless configuration specifies otherwise
                coverage_day_index = get_coverage_day_index(current_date)
                if coverage_day_index is None and not config.get("include_sundays", False):
                    self.logger.info(f"Skipping Sunday {current_date} (set include_sundays=True to include)")
                    current_date += timedelta(days=1)
                    continue
                
                # Generate assignments for this date
                date_assignments = self._generate_assignments_for_date(current_date)
                
                # Create empty schedule entries if requested
                if create_empty and not date_assignments:
                    self._create_empty_schedule_entries(current_date)
                
                # Add assignments to results
                all_assignments.extend(date_assignments)
                
                # Add entry to schedule
                schedule["schedules"].append({
                    "date": current_date.isoformat(),
                    "assignments": date_assignments,
                    "total": len(date_assignments)
                })
                schedule["total_shifts"] += len(date_assignments)
                
            except Exception as e:
                error_msg = f"Error generating schedule for {current_date}: {str(e)}"
                self.logger.error(error_msg)
                errors.append(error_msg)
                
            # Move to next date    
            current_date += timedelta(days=1)
            
        # Final logging
        self.logger.info(f"Schedule generation complete - created {schedule['total_shifts']} shifts with {len(errors)} errors")
        
        return schedule

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

    def _get_shifts_for_date(self, current_date: date) -> List[Any]:
        """
        Get shifts applicable for a specific date.
        
        Args:
            current_date: Date to get shifts for
            
        Returns:
            List of shift templates that apply to this date
        """
        from .day_mapper import is_template_active_for_date, get_coverage_day_index
        
        self.logger.info(f"Getting shifts for date {current_date}")
        
        # Get coverage day index
        coverage_day_index = get_coverage_day_index(current_date)
        
        # Skip if it's Sunday (no coverage)
        if coverage_day_index is None:
            self.logger.warning(f"No shifts available for date {current_date} (Sunday)")
            return []
        
        matching_shifts = []
        
        # Check each shift template
        for shift in self.resources.get_shifts():
            # Check if shift applies to this date
            if hasattr(shift, "active_days") and isinstance(shift.active_days, dict):
                if is_template_active_for_date(shift.active_days, current_date):
                    matching_shifts.append(shift)
            # Fallback to more complex check
            elif self._shift_applies_to_date(shift, current_date):
                matching_shifts.append(shift)
        
        if not matching_shifts:
            self.logger.warning(f"No shifts available for date {current_date}")
            
        return matching_shifts

    def _create_empty_schedule_entries(self, current_date: date):
        """Create empty schedule entries for a specific date"""
        # Instead of creating a single empty entry, create one for each employee
        if hasattr(self.resources, 'employees') and self.resources.employees:
            for employee in self.resources.employees:
                # Only create entries for active employees
                if hasattr(employee, 'is_active') and employee.is_active:
                    empty_assignment = {
                        "date": current_date,
                        "employee_id": employee.id,
                        "status": "EMPTY",
                        "version": getattr(self.schedule, "version", 1),
                        "is_empty": True
                    }
                    self.schedule.entries.append(empty_assignment)
                    
                    # Add to date-indexed dict
                    if current_date not in self.schedule_by_date:
                        self.schedule_by_date[current_date] = []
                    self.schedule_by_date[current_date].append(empty_assignment)
        else:
            # Fallback to original behavior if no employees
            empty_assignment = {
                "date": current_date,
                "status": "EMPTY",
                "version": getattr(self.schedule, "version", 1),
                "is_empty": True
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
        # Import here to avoid circular imports
        from .day_mapper import get_python_weekday, get_coverage_day_index, PYTHON_DAY_NAMES
        
        # Get Python's weekday (0=Monday)
        python_weekday = get_python_weekday(current_date)
        
        # Get coverage day index (0=Monday, None for Sunday)
        coverage_day_index = get_coverage_day_index(current_date)
        
        self.logger.info(
            f"Processing coverage for date {current_date} "
            f"(Python weekday={python_weekday} [{PYTHON_DAY_NAMES[python_weekday]}], "
            f"Coverage day_index={coverage_day_index} "
            f"[{PYTHON_DAY_NAMES[coverage_day_index] if coverage_day_index is not None else 'None/Sunday'}])"
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
        
        # Skip processing if this is a Sunday (no coverage)
        if coverage_day_index is None:
            self.logger.warning(f"No coverage information available for {current_date} (Sunday)")
            return {
                "coverage_blocks": coverage_blocks,
                "total_needed": 0,
                "peak_times": [],
                "coverage_windows": []
            }
            
        # Get coverage information from resources
        # Try to find coverage with matching day_index
        for coverage in self.resources.get_coverages():
            if hasattr(coverage, "day_index") and coverage.day_index == coverage_day_index:
                matching_coverage.append(coverage)
        
        if not matching_coverage:
            self.logger.warning(f"No coverage information available for {current_date}")
            return {
                "coverage_blocks": coverage_blocks,
                "total_needed": 0,
                "peak_times": [],
                "coverage_windows": []
            }
        
        # For each coverage interval, update corresponding blocks
        for coverage in matching_coverage:
            try:
                start_time = coverage.start_time
                end_time = coverage.end_time
                staff_needed = coverage.min_employees
                
                # Find block indices for this coverage
                start_idx = self._time_to_block_index(start_time)
                end_idx = self._time_to_block_index(end_time)
                
                # Add staff needed to each block within this coverage interval
                for i in range(start_idx, end_idx):
                    if i < len(coverage_blocks):
                        coverage_blocks[i]["staff_needed"] += staff_needed
                        total_staff_needed += staff_needed
                
                # Track peak times
                peak_times.append({
                    "start": start_time,
                    "end": end_time,
                    "staff_needed": staff_needed
                })
            except Exception as e:
                self.logger.error(f"Error processing coverage: {str(e)}")
        
        # Log coverage information
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

    def _create_date_shifts(self, current_date: date) -> List[Any]:
        """
        Create shift instances for a specific date based on shift templates.
        
        Args:
            current_date: The date to create shifts for
            
        Returns:
            List of shift instances for the given date
        """
        from .day_mapper import is_template_active_for_date
        
        self.logger.info(f"Creating shifts for date {current_date}")
        shifts = []
        
        for shift_template in self.resources.get_shifts():
            # Check if this shift is active for this date
            if hasattr(shift_template, "active_days") and isinstance(shift_template.active_days, dict):
                if is_template_active_for_date(shift_template.active_days, current_date):
                    self.logger.debug(f"Shift {shift_template.name} is active on {current_date}")
                    shifts.append(shift_template)
            # Fallback to the legacy check method
            elif self._shift_applies_to_date(shift_template, current_date):
                self.logger.debug(f"Shift {shift_template.name} is active on {current_date} (legacy check)")
                shifts.append(shift_template)
        
        if not shifts:
            self.logger.warning(f"No shifts available for date {current_date}")
            
        return shifts

    def _coverage_applies_to_date(self, coverage, check_date: date) -> bool:
        """
        Check if a coverage record applies to the given date.
        Coverage records can be specified in two ways:
        1. Specific date - exact date match
        2. Day of week - recurring weekly pattern where:
            - day_index: 0=Monday, 1=Tuesday, ..., 5=Saturday (our demo data format)
            - Python's weekday(): 0=Monday, 1=Tuesday, ..., 6=Sunday (Python format)
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
            # Python's weekday() uses 0=Monday, which matches our day_index
            python_weekday = check_date.weekday()
            check_day_index = python_weekday

            self.logger.debug(
                f"Checking coverage for date {check_date}: "
                f"Python weekday={python_weekday} ({['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][python_weekday]}), "
                f"Converted day_index={check_day_index} ({['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][check_day_index]}), "
                f"Coverage day_index={day_of_week}"
            )

            return day_of_week == check_day_index

        return False

    def _shift_applies_to_date(self, shift, check_date: date) -> bool:
        """
        Check if a shift applies to a specific date based on patterns (day of week, etc).
        """
        # Import here to avoid circular imports
        from .day_mapper import get_python_weekday, get_template_day_key, PYTHON_DAY_NAMES
        
        # Get the weekday of the check_date (0=Monday, 6=Sunday)
        weekday = get_python_weekday(check_date)
        day_name = PYTHON_DAY_NAMES[weekday]
        
        # Get the template day key (string key for active_days dict)
        template_day_key = get_template_day_key(check_date)
        
        self.logger.info(
            f"[DIAGNOSTIC] Checking if shift {shift.id} applies to {check_date} "
            f"(weekday={weekday}, {day_name}, template_day_key={template_day_key})"
        )
        
        # Check if shift has active_days as dictionary
        if hasattr(shift, "active_days") and isinstance(shift.active_days, dict):
            is_active = shift.active_days.get(template_day_key, False)
            self.logger.debug(
                f"[DIAGNOSTIC] Using active_days dictionary: "
                f"key={template_day_key}, active={is_active}"
            )
            return is_active
            
        # Fallback: check other possible formats
        active_days = False
        
        # Try to get active_days from shift in different possible formats
        if hasattr(shift, "active_days"):
            # Format might be a list of active day indices
            if isinstance(shift.active_days, list):
                self.logger.debug(f"[DIAGNOSTIC] Found active_days as list: {shift.active_days}")
                active_days = str(weekday) in shift.active_days or weekday in shift.active_days
                
                # Check for day names in list
                day_name_lower = day_name.lower()
                if any(day.lower() == day_name_lower for day in shift.active_days if isinstance(day, str)):
                    active_days = True
                    
            # Format might be a string of day indices (e.g., "0,1,2,3,4")
            elif isinstance(shift.active_days, str) and shift.active_days:
                self.logger.debug(f"[DIAGNOSTIC] Found active_days as string: {shift.active_days}")
                active_day_strings = shift.active_days.split(",")
                active_days = str(weekday) in active_day_strings
                
                # Check for day names in string
                day_name_lower = day_name.lower()
                if any(day.lower() == day_name_lower for day in active_day_strings):
                    active_days = True
        
        # Legacy/alternative fields that might contain day patterns
        if not active_days and hasattr(shift, "valid_days"):
            self.logger.debug(f"[DIAGNOSTIC] Falling back to valid_days: {shift.valid_days}")
            
            if isinstance(shift.valid_days, dict):
                active_days = shift.valid_days.get(template_day_key, False)
            elif isinstance(shift.valid_days, list):
                active_days = weekday in shift.valid_days or str(weekday) in shift.valid_days
            elif isinstance(shift.valid_days, str) and shift.valid_days:
                active_day_strings = shift.valid_days.split(",")
                active_days = str(weekday) in active_day_strings
        
        # Alternative: Check specific day_of_week field 
        if not active_days and hasattr(shift, "day_of_week"):
            self.logger.debug(f"[DIAGNOSTIC] Checking day_of_week field: {shift.day_of_week}")
            if shift.day_of_week is not None:
                # day_of_week might be stored as int or string
                try:
                    if isinstance(shift.day_of_week, str) and shift.day_of_week.isdigit():
                        active_days = int(shift.day_of_week) == weekday
                    else:
                        active_days = shift.day_of_week == weekday
                except (ValueError, TypeError):
                    # If conversion fails, assume this isn't a match
                    active_days = False
        
        # If we still can't determine active days, assume all days are active
        if not active_days:
            self.logger.warning(f"[DIAGNOSTIC] Could not determine active days for shift {shift.id}. Assuming active for all days.")
            active_days = True
            
        self.logger.info(f"[DIAGNOSTIC] Shift {shift.id} applies to {check_date}: {active_days}")
        return active_days

    def _generate_assignments_for_date(self, current_date: date) -> List[Dict]:
        """
        Generate shift assignments for a specific date.
        
        Args:
            current_date: The date to generate assignments for
            
        Returns:
            List of generated assignments
        """
        from .day_mapper import get_coverage_day_index
        
        self.logger.info(f"Generating assignments for date {current_date}")
        
        # Get applicable shifts
        shifts = self._get_shifts_for_date(current_date)
        if not shifts:
            self.logger.warning(f"No shifts available for date {current_date} - skipping")
            return []
        
        # Get coverage requirements for this date
        coverage_day_index = get_coverage_day_index(current_date)
        if coverage_day_index is None:
            self.logger.warning(f"No coverage requirements found for date {current_date} (Sunday) - skipping")
            return []
            
        # Get coverage requirements
        coverage_items = self.resources.get_daily_coverage(current_date)
        if not coverage_items:
            self.logger.warning(f"No coverage requirements found for date {current_date} - skipping")
            return []
            
        self.logger.info(f"Found {len(shifts)} shifts and {len(coverage_items)} coverage items for {current_date}")
        
        # Process each coverage requirement
        assignments = []
        
        # Get available employees for this date
        available_employees = self._get_available_employees(current_date)
        
        for coverage in coverage_items:
            # Skip if no employees are required
            if not hasattr(coverage, "required_employees") or coverage.required_employees <= 0:
                continue
                
            # Find applicable shifts for this coverage
            matching_shifts = self._find_shifts_for_coverage(shifts, coverage)
            if not matching_shifts:
                self.logger.warning(f"No matching shifts found for coverage {coverage.id} on {current_date}")
                continue
                
            # Try to assign employees to each matching shift
            for shift in matching_shifts:
                # Calculate how many employees we need for this shift
                needed_employees = min(
                    coverage.required_employees, 
                    len(available_employees)
                )
                
                if needed_employees <= 0:
                    self.logger.info(f"No employees needed for shift {shift.id} on {current_date}")
                    continue
                    
                self.logger.info(f"Trying to assign {needed_employees} employees to shift {shift.id} on {current_date}")
                
                # Try to find and assign employees
                assigned_count = 0
                for employee in available_employees.copy():
                    # Check if employee can be assigned to this shift
                    if self._can_assign_employee_to_shift(employee, shift, current_date):
                        # Create assignment
                        assignment = {
                            "employee_id": employee.id,
                            "shift_template_id": shift.id, 
                            "date": current_date,
                            "shift_id": shift.id,
                            "start_time": shift.start_time,
                            "end_time": shift.end_time,
                            "is_keyholder": getattr(employee, "is_keyholder", False),
                        }
                        
                        assignments.append(assignment)
                        assigned_count += 1
                        
                        # Remove employee from available pool
                        available_employees.remove(employee)
                        
                        # Check if we've assigned enough employees
                        if assigned_count >= needed_employees:
                            break
                
                self.logger.info(f"Assigned {assigned_count} employees to shift {shift.id} on {current_date}")
                
                # Update the remaining needed employees
                coverage.required_employees -= assigned_count
                if coverage.required_employees <= 0:
                    break
        
        self.logger.info(f"Generated {len(assignments)} assignments for date {current_date}")
        
        # Apply distribution logic using the distribution manager
        try:
            distributed_assignments = self.distribution_manager.distribute_shifts(
                current_date, current_date, assignments
            )
            
            self.logger.info(f"After distribution: {len(distributed_assignments)} assignments for date {current_date}")
            return distributed_assignments
        except AttributeError as e:
            # If the error is specifically about distribute_shifts not existing
            if "'DistributionManager' object has no attribute 'distribute_shifts'" in str(e):
                self.logger.warning(f"distribute_shifts method not found, falling back to basic assignment. Error: {str(e)}")
                # Just return the assignments we already generated
                return assignments
            # For other attribute errors, log and propagate
            self.logger.error(f"Attribute error during distribution: {str(e)}")
            raise

    def _get_available_employees(self, current_date: date) -> List[Any]:
        """
        Get employees available for a specific date.
        
        Args:
            current_date: Date to check availability for
            
        Returns:
            List of available employees
        """
        # Get all active employees
        all_employees = self.resources.get_employees()
        available_employees = []
        
        for employee in all_employees:
            # Check if employee is active
            if not getattr(employee, "is_active", True):
                continue
                
            # Check if employee has an absence record for this date
            has_absence = self._employee_has_absence(employee, current_date)
            if has_absence:
                continue
                
            # Check if employee has availability for this date
            has_availability = self._employee_has_availability(employee, current_date)
            if not has_availability:
                continue
                
            available_employees.append(employee)
            
        self.logger.debug(f"Found {len(available_employees)} available employees for {current_date}")
        return available_employees
    
    def _employee_has_absence(self, employee, check_date: date) -> bool:
        """
        Check if employee has an absence record for the date.
        
        Args:
            employee: Employee to check
            check_date: Date to check
            
        Returns:
            True if employee has absence, False otherwise
        """
        # Check employee's absences
        for absence in self.resources.get_absences():
            if absence.employee_id != getattr(employee, "id", None):
                continue
                
            # Check if absence covers this date
            if not hasattr(absence, "start_date") or not hasattr(absence, "end_date"):
                continue
                
            try:
                absence_start = absence.start_date
                absence_end = absence.end_date
                
                # Convert string dates if needed
                if isinstance(absence_start, str):
                    absence_start = datetime.strptime(absence_start, "%Y-%m-%d").date()
                if isinstance(absence_end, str):
                    absence_end = datetime.strptime(absence_end, "%Y-%m-%d").date()
                    
                # Check if check_date is within absence period
                if absence_start <= check_date <= absence_end:
                    return True
            except Exception as e:
                self.logger.warning(f"Error checking absence: {str(e)}")
                
        return False
        
    def _employee_has_availability(self, employee, check_date: date) -> bool:
        """
        Check if employee has availability for the date.
        
        Args:
            employee: Employee to check
            check_date: Date to check
            
        Returns:
            True if employee is available, False otherwise
        """
        # Get weekday of check_date
        from .day_mapper import get_python_weekday
        weekday = get_python_weekday(check_date)
        
        # Check employee's availabilities
        for availability in self.resources.get_availabilities():
            if availability.employee_id != getattr(employee, "id", None):
                continue
                
            # Check if availability applies to this day of week
            if hasattr(availability, "day_of_week") and availability.day_of_week == weekday:
                return True
                
        # Default to available if no specific availability records found
        return True
        
    def _find_shifts_for_coverage(self, shifts: List[Any], coverage: Any) -> List[Any]:
        """
        Find shifts that match a coverage requirement.
        
        Args:
            shifts: List of shift templates
            coverage: Coverage requirement
            
        Returns:
            List of shifts that match the coverage requirement
        """
        matching_shifts = []
        
        if not hasattr(coverage, "shift_type_id") or not hasattr(coverage, "start_time") or not hasattr(coverage, "end_time"):
            self.logger.warning(f"Invalid coverage requirement: {coverage}")
            return matching_shifts
            
        for shift in shifts:
            # Check shift type
            if hasattr(shift, "shift_type_id") and shift.shift_type_id == coverage.shift_type_id:
                # Check time overlap
                shift_start = self._time_to_minutes(shift.start_time)
                shift_end = self._time_to_minutes(shift.end_time)
                coverage_start = self._time_to_minutes(coverage.start_time)
                coverage_end = self._time_to_minutes(coverage.end_time)
                
                if self._times_overlap(shift_start, shift_end, coverage_start, coverage_end):
                    matching_shifts.append(shift)
                    self.logger.debug(f"Shift {shift.id} matches coverage {coverage.id}")
        
        if not matching_shifts:
            self.logger.warning(f"No shifts found matching coverage {coverage.id} (type: {coverage.shift_type_id})")
            
        return matching_shifts

    def _times_overlap(self, start1: int, end1: int, start2: int, end2: int) -> bool:
        """
        Check if two time periods overlap.
        
        Args:
            start1: Start time 1 in minutes
            end1: End time 1 in minutes
            start2: Start time 2 in minutes
            end2: End time 2 in minutes
            
        Returns:
            True if the time periods overlap, False otherwise
        """
        # Handle overnight shifts (end time less than start time)
        if end1 < start1:
            end1 += 24 * 60  # Add 24 hours
        
        if end2 < start2:
            end2 += 24 * 60  # Add 24 hours
            
        # Check for overlap
        return max(start1, start2) < min(end1, end2)
        
    def _time_to_minutes(self, time_str):
        """
        Convert HH:MM time string to minutes since midnight.
        
        Args:
            time_str: Time string in HH:MM format
            
        Returns:
            Minutes since midnight
        """
        try:
            hours, minutes = map(int, time_str.split(":"))
            return hours * 60 + minutes
        except (ValueError, TypeError):
            return 0
            
    def _can_assign_employee_to_shift(self, employee, shift, current_date):
        """
        Check if an employee can be assigned to a shift.
        
        Args:
            employee: Employee to check
            shift: Shift to check
            current_date: Date of the shift
            
        Returns:
            True if employee can be assigned, False otherwise
        """
        # Check if shift requires keyholder
        if getattr(shift, "requires_keyholder", False) and not getattr(employee, "is_keyholder", False):
            return False
            
        # Check employee's skills against shift requirements
        if hasattr(shift, "required_skills") and hasattr(employee, "skills"):
            shift_skills = getattr(shift, "required_skills", [])
            employee_skills = getattr(employee, "skills", [])
            
            # Check if employee has all required skills
            if shift_skills and not all(skill in employee_skills for skill in shift_skills):
                return False
                
        # More complex checks can be added here
        
        # Default to assignable
        return True

    def generate_schedule(self, start_date: date, end_date: date, config: dict = None, create_empty_schedules: bool = False, version: int = 1):
        """
        Wrapper for generate method to maintain backward compatibility.
        
        Args:
            start_date: Start date for scheduling (inclusive)
            end_date: End date for scheduling (inclusive)
            config: Configuration options for the scheduler
            create_empty_schedules: If True, create empty schedule entries even if no assignments
            version: Schedule version number
            
        Returns:
            Dictionary with schedule results and statistics
        """
        # Call the new generate method with parameters in the right order
        return self.generate(
            start_date=start_date, 
            end_date=end_date, 
            create_empty=create_empty_schedules,
            config=config
        )

    def _init_scheduler(self) -> bool:
        """
        Initialize the scheduler by loading or creating the necessary resources.
        
        Returns:
            True if initialization is successful, False otherwise
        """
        try:
            # Initialize components as needed
            self.logger.info("Initializing scheduler resources...")
            
            # Initialize resources if not already initialized
            if not self.resources:
                self.logger.info("Creating new ScheduleResources instance")
                self.resources = ScheduleResources()
            
            # Check if we should use mock data for testing/demo purposes
            if os.environ.get('SCHICHTPLAN_USE_MOCK_DATA', 'false').lower() == 'true':
                self.logger.info("SCHICHTPLAN_USE_MOCK_DATA is enabled, creating mock resources")
                return self._create_mock_resources()
            
            # Otherwise, try to load from database
            # Check if resources are loaded
            if not self.resources.is_loaded():
                self.logger.info("Resources not loaded, attempting to load now")
                if not self.resources.load():
                    self.logger.error("Failed to load scheduler resources from database")
                    
                    # Log more detailed error information
                    self.logger.error("No employees loaded - schedule generation cannot proceed")
                    self.logger.error("No shift templates loaded - schedule generation cannot proceed")
                    self.logger.error("To use mock data for testing, set SCHICHTPLAN_USE_MOCK_DATA=true in environment")
                    return False
            
            # Log resource counts to help with debugging
            self.logger.info(f"Resources loaded: {len(self.resources.get_employees())} employees, {len(self.resources.get_shifts())} shifts")
                    
            # Check for critical resources
            if not self.resources.get_employees():
                self.logger.error("No employees available - cannot proceed with scheduling")
                self.logger.error("To use mock data for testing, set SCHICHTPLAN_USE_MOCK_DATA=true in environment")
                return False
                
            if not self.resources.get_shifts():
                self.logger.error("No shift templates available - cannot proceed with scheduling")
                self.logger.error("To use mock data for testing, set SCHICHTPLAN_USE_MOCK_DATA=true in environment")
                return False
                
            # Initialization successful
            self.logger.info("Scheduler initialization successful")
            return True
            
        except Exception as e:
            self.logger.error(f"Error initializing scheduler: {str(e)}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return False
            
    def _create_mock_resources(self):
        """Create mock resources for testing/demo purposes when database is not available"""
        self.logger.info("Creating mock resources for testing")
        
        # Create mock employees
        from unittest.mock import MagicMock
        
        # Create mock employees
        mock_employees = []
        for i in range(1, 6):  # Create 5 employees
            emp = MagicMock()
            emp.id = i
            emp.first_name = f"Employee{i}"
            emp.last_name = "Test"
            emp.is_active = True
            emp.is_keyholder = i == 1  # First employee is keyholder
            emp.skills = ["basic"]
            mock_employees.append(emp)
            
        # Create mock shift templates
        mock_shifts = []
        shift_types = [
            {"id": 1, "name": "Morning", "start_time": "08:00", "end_time": "16:00", "shift_type": "EARLY"},
            {"id": 2, "name": "Evening", "start_time": "16:00", "end_time": "00:00", "shift_type": "LATE"},
            {"id": 3, "name": "Midday", "start_time": "12:00", "end_time": "20:00", "shift_type": "MIDDLE"}
        ]
        
        for i, shift_data in enumerate(shift_types, 1):
            shift = MagicMock()
            shift.id = i
            shift.name = shift_data["name"]
            shift.start_time = shift_data["start_time"]
            shift.end_time = shift_data["end_time"]
            shift.shift_type = shift_data["shift_type"]
            shift.duration_hours = 8.0
            shift.required_skills = []
            # Make the shift active for all weekdays (0-4)
            shift.active_days = {str(day): True for day in range(5)}
            # Weekend days (5-6) not active
            shift.active_days.update({str(day): False for day in range(5, 7)})
            mock_shifts.append(shift)
            
        # Create mock coverage data
        mock_coverage = []
        for day in range(5):  # Monday to Friday
            for shift_type in ["EARLY", "MIDDLE", "LATE"]:
                cov = MagicMock()
                cov.id = len(mock_coverage) + 1
                cov.day_index = day
                cov.day_of_week = day
                cov.shift_type_id = shift_type
                cov.required_employees = 2  # Require 2 employees per shift
                cov.start_time = shift_types[0]["start_time"] if shift_type == "EARLY" else \
                                shift_types[2]["start_time"] if shift_type == "MIDDLE" else \
                                shift_types[1]["start_time"]
                cov.end_time = shift_types[0]["end_time"] if shift_type == "EARLY" else \
                              shift_types[2]["end_time"] if shift_type == "MIDDLE" else \
                              shift_types[1]["end_time"]
                mock_coverage.append(cov)
                
        # Create mock availabilities
        mock_availabilities = []
        for employee_id in range(1, 6):
            for day in range(7):  # All days of the week
                avail = MagicMock()
                avail.employee_id = employee_id
                avail.day_of_week = day
                avail.is_available = day < 5  # Available on weekdays
                avail.availability_type = 1  # Available by default
                mock_availabilities.append(avail)

        # Create mock absences
        mock_absences = []
        
        # Manually add mock data to resources
        self.resources.employees = mock_employees
        self.resources.shifts = mock_shifts
        self.resources.coverage = mock_coverage
        self.resources.availabilities = mock_availabilities
        self.resources.absences = mock_absences
        self.resources._employee_cache = {emp.id: emp for emp in mock_employees}
        self.resources._loaded = True
        
        # Ensure getter methods exist
        if not hasattr(self.resources, 'get_employees'):
            self.resources.get_employees = lambda: self.resources.employees
        if not hasattr(self.resources, 'get_shifts'):
            self.resources.get_shifts = lambda: self.resources.shifts
        if not hasattr(self.resources, 'get_availabilities'):
            self.resources.get_availabilities = lambda: self.resources.availabilities
        if not hasattr(self.resources, 'get_absences'):
            self.resources.get_absences = lambda: self.resources.absences
        
        self.logger.info(f"Created mock data with {len(mock_employees)} employees, {len(mock_shifts)} shifts, {len(mock_coverage)} coverage records, {len(mock_availabilities)} availability records")
        
        # Create a mock distribution manager that doesn't use distribute_shifts
        self.distribution_manager = MagicMock()
        self.distribution_manager.distribute_shifts = lambda start_date, end_date, assignments: assignments
        
        return True
