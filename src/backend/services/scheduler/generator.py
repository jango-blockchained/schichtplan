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
        Generates the schedule for the given date range.

        Args:
            start_date: The start date of the schedule.
            end_date: The end date of the schedule.
            config: Optional configuration overrides.
            create_empty_schedules: Whether to create empty entries for uncovered days/employees.
            version: The version number for the schedule being generated.

        Returns:
            A dictionary containing the generated schedule, errors, and logs.
        """
        # Reset logs for this generation run by starting a new process context
        self.logging_manager.start_process("Schedule Generation")
        self.logger.info(f"--- Starting Schedule Generation (v{version}) for {start_date} to {end_date} ---")

        if config:
            self.config.update_config(config)
            self.logger.info("Applied configuration overrides.")

        self.schedule = ScheduleContainer(start_date, end_date, version=version or 1)
        self._schedule_entries = [] # Ensure entries are reset

        try:
            # Step 1: Load Resources
            self.logger.info("Step 1: Loading required resources...")
            # Update the resources with the correct date range
            self.resources.start_date = start_date
            self.resources.end_date = end_date
            self.resources.load()
            self.logger.info(f"Loaded {len(self.resources.get_employees())} employees, "
                             f"{len(self.resources.get_shifts())} shifts, "
                             f"{len(self.resources.get_coverages())} coverages.")
                             
            if not self.resources.get_shifts():
                 self.logger.warning("No shift templates found for the specified period.")
                 # Optionally raise error or return specific message if shifts are essential

            # Step 2: Generate assignments day by day
            self.logger.info("Step 2: Generating assignments for each day...")
            current_date = start_date
            while current_date <= end_date:
                self.logger.debug(f"Processing date: {current_date}")

                # Generate assignments for the current date
                assignments = self._generate_assignments_for_date(current_date)
                self.schedule.entries.extend(assignments) # Add directly to container
                self._schedule_entries.extend(assignments) # Also keep internal track if needed

                # Create empty entries if configured
                if create_empty_schedules:
                    self._create_empty_schedule_entries(current_date)

                current_date += timedelta(days=1)
            self.logger.info(f"Generated {len(self.schedule.entries)} preliminary assignments.")


            # Step 3: Validate and Distribute
            self.logger.info("Step 3: Validating constraints and distributing shifts...")
            # The DistributionManager handles constraints internally now
            final_assignments = self.distribution_manager.distribute_shifts(
                start_date, end_date, self.schedule.entries # Pass preliminary assignments
            )
            # Update schedule entries with final, validated assignments
            self.schedule.entries = final_assignments
            self._schedule_entries = final_assignments # Update internal track as well
            self.logger.info(f"Finalized {len(final_assignments)} assignments after distribution and validation.")

            # Collect validation errors from the distribution manager
            validation_errors = self.distribution_manager.get_validation_errors()
            if validation_errors:
                 self.logger.warning(f"Found {len(validation_errors)} validation issues during distribution.")
                 # These errors should already be logged by the distribution manager


            # Step 4: Serialize Schedule
            self.logger.info("Step 4: Serializing the final schedule...")
            serialized_schedule = self.serializer.serialize_schedule(
                self.schedule, # Pass the ScheduleContainer
                validation_errors
            )
            self.logger.info("Schedule serialization complete.")


            # Final Step: Collect Logs and Return
            generation_logs = self.logging_manager.get_current_process_logs()
            self.logger.info(f"--- Schedule Generation Complete (v{version}). Errors: {len(validation_errors)}, Logs: {len(generation_logs)} ---")

            return {
                "success": True,
                "schedules": serialized_schedule["schedules"],
                "errors": serialized_schedule["errors"], # Errors from serialization/validation
                "version": version,
                "logs": generation_logs # Include logs in the result
            }

        except Exception as e:
            self.logger.exception(f"Critical error during schedule generation: {e}")
            generation_logs = self.logging_manager.get_current_process_logs()
            # Add the critical error itself to the logs if not already captured
            if not any(log['message'].endswith(str(e)) for log in generation_logs):
                generation_logs.append({
                    'timestamp': datetime.utcnow().isoformat(),
                    'level': 'CRITICAL',
                    'message': f"Generation failed critically: {e}"
                })

            return {
                "success": False,
                "error": f"An unexpected error occurred: {e}",
                "schedules": [],
                "errors": [{"message": f"Critical error: {e}", "details": str(e)}], # Simplified error structure
                "version": version,
                "logs": generation_logs # Include logs even on failure
            }

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
        # Get Python's weekday (0=Monday)
        python_weekday = current_date.weekday()
        
        # Use the same day index as Python (0=Monday) since our coverage data uses this format
        # This fixes the mismatch between Python weekday and our coverage day_index
        check_day_index = python_weekday
        
        self.logger.info(
            f"Processing coverage for date {current_date} "
            f"(Python weekday={python_weekday} [{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][python_weekday]}], "
            f"Coverage day_index={check_day_index} [{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][check_day_index]}])"
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
        """
        Creates shift instances for a specific date based on templates, considering
        coverage requirements and other constraints.
        """
        self.logger.info(f"[DIAGNOSTIC] Getting shifts for date {current_date}")
        
        # Get all shifts
        shifts = self.resources.get_shifts()
        self.logger.info(f"[DIAGNOSTIC] Total shifts from resources: {len(shifts)}")
        
        # Filter shifts that apply to this date 
        date_shifts = []
        for shift in shifts:
            applies = self._shift_applies_to_date(shift, current_date)
            if applies:
                date_shifts.append(shift)
                self.logger.debug(f"[DIAGNOSTIC] Including shift {shift.id} for {current_date}")
            else:
                self.logger.debug(f"[DIAGNOSTIC] Excluding shift {shift.id} for {current_date}")
        
        # Create coverage requirements mapping
        self.logger.info(f"[DIAGNOSTIC] Processing coverage for date {current_date} "
                         f"(Python weekday={current_date.weekday()} [{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][current_date.weekday()]}], "
                         f"Coverage day_index={current_date.weekday()} [{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][current_date.weekday()]}])")
        
        coverage_items = self.resources.get_daily_coverage(current_date)
        self.logger.info(f"[DIAGNOSTIC] Found {len(coverage_items)} coverage items for {current_date}")
        
        coverage_map = {}
        for cov in coverage_items:
            if hasattr(cov, "shift_type_id") and hasattr(cov, "required_employees"):
                coverage_map[cov.shift_type_id] = cov.required_employees
                self.logger.debug(f"[DIAGNOSTIC] Coverage for shift type {cov.shift_type_id}: "
                                 f"required={cov.required_employees}")
        
        if not coverage_map:
            self.logger.warning(f"[DIAGNOSTIC] No coverage information available for {current_date}")
        
        # If no shifts match this date, log and return empty list
        if not date_shifts:
            self.logger.warning(f"[DIAGNOSTIC] No shifts available for date {current_date}")
            return []
        
        self.logger.info(f"[DIAGNOSTIC] Returning {len(date_shifts)} shifts for {current_date}")
        return date_shifts

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
        # Get the weekday of the check_date (0=Monday, 6=Sunday)
        weekday = check_date.weekday()
        day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][weekday]
        
        self.logger.info(f"[DIAGNOSTIC] Checking if shift {shift.id} applies to {check_date} (weekday={weekday}, {day_name})")
        
        # Default pattern is all days active
        active_days = None
        
        # Try to get active_days from shift in different possible formats
        if hasattr(shift, "active_days"):
            # Format might be a dictionary with day indices
            if isinstance(shift.active_days, dict):
                self.logger.debug(f"[DIAGNOSTIC] Found active_days as dict: {shift.active_days}")
                active_days = shift.active_days.get(str(weekday), False)
                
                # If active_days has string keys with day names
                if not active_days and day_name.lower() in shift.active_days:
                    active_days = shift.active_days.get(day_name.lower(), False)
                
            # Format might be a list of active day indices
            elif isinstance(shift.active_days, list):
                self.logger.debug(f"[DIAGNOSTIC] Found active_days as list: {shift.active_days}")
                active_days = weekday in shift.active_days or str(weekday) in shift.active_days
                
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
        if active_days is None and hasattr(shift, "valid_days"):
            self.logger.debug(f"[DIAGNOSTIC] Falling back to valid_days: {shift.valid_days}")
            
            if isinstance(shift.valid_days, dict):
                active_days = shift.valid_days.get(str(weekday), False)
            elif isinstance(shift.valid_days, list):
                active_days = weekday in shift.valid_days or str(weekday) in shift.valid_days
            elif isinstance(shift.valid_days, str) and shift.valid_days:
                active_day_strings = shift.valid_days.split(",")
                active_days = str(weekday) in active_day_strings
        
        # Alternative: Check specific day_of_week field 
        if active_days is None and hasattr(shift, "day_of_week"):
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
        if active_days is None:
            self.logger.warning(f"[DIAGNOSTIC] Could not determine active days for shift {shift.id}. Assuming active for all days.")
            active_days = True
            
        self.logger.info(f"[DIAGNOSTIC] Shift {shift.id} applies to {check_date}: {active_days}")
        return active_days

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
