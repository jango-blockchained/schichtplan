"""Schedule generation service for Schichtplan."""
"""Schedule generation service for Schichtplan."""
from datetime import date, datetime, timedelta
import logging
from typing import Dict, List, Any, Optional
import sys
import os
import uuid # Import uuid for session ID generation

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# --- Centralized Logger Import ---
# Import the global logger instance from utils
try:
    from utils.logger import logger as central_logger
    # Add a stream handler for console visibility during development/debugging if not already configured
    if not any(isinstance(h, logging.StreamHandler) for h in central_logger.schedule_logger.handlers):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO) # Or DEBUG
        console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        console_handler.setFormatter(console_formatter)
        central_logger.schedule_logger.addHandler(console_handler)
        central_logger.schedule_logger.info("Added console handler to schedule_logger for generator.")

except ImportError:
    print("Error: Could not import central logger from utils.logger. Falling back to basic logging.", file=sys.stderr)
    # Fallback basic configuration
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    # Create a dummy logger object that mimics the structure if needed
    class DummyLogger:
        def __init__(self):
            self.schedule_logger = logging.getLogger("schedule_fallback")
            self.diagnostic_logger = logging.getLogger("diagnostic_fallback")
            self.app_logger = logging.getLogger("app_fallback")
            self.error_logger = logging.getLogger("error_fallback")
            self.user_logger = logging.getLogger("user_fallback")
        def create_diagnostic_logger(self, session_id):
             # Return a named logger, but setup might be basic
             return logging.getLogger(f"diagnostic_{session_id}_fallback")
        def get_diagnostic_log_path(self, session_id):
            return f"fallback_diagnostic_{session_id}.log" # Placeholder path
    central_logger = DummyLogger()


# Import the extracted modules
from .config import SchedulerConfig
from .constraints import ConstraintChecker
from .availability import AvailabilityChecker
from .distribution import DistributionManager
from .serialization import ScheduleSerializer
from .logging_utils import ProcessTracker # Renamed from LoggingManager
from .resources import ScheduleResources

# Set up placeholder logger - REMOVED as we use central_logger now
# logger = logging.getLogger(__name__)

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
        central_logger.app_logger.debug(f"Successfully imported module: {module_name}")
        return module if class_name is None else getattr(module, class_name)
    except (ImportError, AttributeError) as e:
        central_logger.app_logger.warning(f"Failed to import {class_name or module_name}: {e}")
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

# Try to import logger - REMOVED, using direct import now
# utils_logger = try_import("utils.logger")
# if utils_logger is None:
#     utils_logger = try_import("backend.utils.logger")
# if utils_logger is None:
#     utils_logger = try_import("src.backend.utils.logger")

# Set up our classes based on successful imports or fallbacks
if employee_module and hasattr(employee_module, "AvailabilityType"):
    AvailabilityType = employee_module.AvailabilityType
else:
    AvailabilityType = _AvailabilityType
    central_logger.app_logger.warning("Using fallback AvailabilityType enum.")


if models_module:
    Employee = getattr(models_module, "Employee", _Employee)
    ShiftTemplate = getattr(models_module, "ShiftTemplate", _ShiftTemplate)
    Schedule = getattr(models_module, "Schedule", _Schedule)
else:
    Employee = _Employee
    ShiftTemplate = _ShiftTemplate
    Schedule = _Schedule
    central_logger.app_logger.warning("Using fallback data models (Employee, ShiftTemplate, Schedule).")


# if utils_logger: # REMOVED
#     logger = getattr(utils_logger, "logger", logger) # REMOVED


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
        # Use the centrally configured logger
        self.logger = central_logger.schedule_logger # Use the specific schedule logger
        self.app_logger = central_logger.app_logger # Use app logger for general info/debug

        # Generate a unique session ID for this generation run
        self.session_id = str(uuid.uuid4())[:8]

        # Create a specific diagnostic logger for this session
        self.diagnostic_logger = central_logger.create_diagnostic_logger(self.session_id)

        # Initialize the process tracker, passing the relevant loggers
        self.process_tracker = ProcessTracker(
            process_name=f"ScheduleGeneration_{self.session_id}",
            schedule_logger=self.logger,
            diagnostic_logger=self.diagnostic_logger
        )

        # Initialize resources and config
        self.resources = resources or ScheduleResources()
        self.config = config or SchedulerConfig()
        self.logger.debug(f"ScheduleGenerator initialized (Session: {self.session_id})")
        self.diagnostic_logger.debug(f"SchedulerConfig: {self.config.__dict__}")


        # Initialize the specialized modules, passing the correct logger
        # Decide which logger is most appropriate for each module
        # - ConstraintChecker: Needs details, maybe diagnostic? Or schedule? Let's use schedule logger for now.
        # - AvailabilityChecker: Schedule logger seems appropriate.
        # - DistributionManager: Needs detailed logs, pass diagnostic logger? Or schedule logger? Let's use schedule.
        # - Serializer: Schedule logger.
        self.constraint_checker = ConstraintChecker(
            self.resources, self.config, self.logger # Pass schedule logger
        )
        self.availability_checker = AvailabilityChecker(self.resources, self.logger) # Pass schedule logger
        self.distribution_manager = DistributionManager(
            self.resources,
            self.constraint_checker,
            self.availability_checker,
            self.config,
            self.logger, # Pass schedule logger
        )
        self.serializer = ScheduleSerializer(self.logger) # Pass schedule logger

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
        self.logger.info(f"Generating schedule from {start_date} to {end_date} (Session: {self.session_id})")
        self.diagnostic_logger.info(f"Generation parameters: start={start_date}, end={end_date}, config={config}, create_empty={create_empty_schedules}, version={version}")

        # Start the process tracking
        self.process_tracker.start_process()

        # Step 1: Resource Loading and Verification
        self.process_tracker.start_step("Resource Loading")
        try:
            self.resources.load()
            verification_result = self.resources.verify_loaded_resources()
            if not verification_result:
                error_msg = "Resource verification failed."
                self.logger.error(error_msg)
                self.process_tracker.log_error(error_msg)
                raise ScheduleGenerationError("Failed to load required resources")

            self.logger.info("Resources loaded and verified successfully.")
            self.process_tracker.log_step_data("Employees Loaded", len(self.resources.employees), level=logging.INFO)
            self.process_tracker.log_step_data("Shifts Loaded", len(self.resources.shifts), level=logging.INFO)
            self.process_tracker.log_step_data("Coverage Loaded", len(self.resources.coverage), level=logging.INFO)
            self.process_tracker.log_step_data("Availability Loaded", len(self.resources.availabilities), level=logging.INFO)

        except Exception as e:
            error_msg = f"Error during resource loading: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            self.process_tracker.log_error(error_msg, exc_info=True)
            # We might still want to end the step before raising
            self.process_tracker.end_step({"status": "failed", "error": str(e)})
            # End the process immediately on critical failure
            self.process_tracker.end_process({"status": "failed", "reason": "Resource loading error"})
            raise ScheduleGenerationError(f"Failed during resource loading: {str(e)}") from e
        finally:
            # Ensure step ends even if it succeeded but there was an issue before the raise
             if self.process_tracker.current_step == "Resource Loading":
                self.process_tracker.end_step({"status": "success"})


        # Initialize schedule container
        self.schedule = ScheduleContainer(
            start_date=start_date,
            end_date=end_date,
            version=version or 1,
        )

        # Step 2: Date Processing Loop
        self.process_tracker.start_step("Daily Assignment Generation Loop")
        current_date = start_date
        date_count = 0
        empty_dates = 0

        while current_date <= end_date:
            loop_date_str = current_date.isoformat()
            self.diagnostic_logger.debug(f"--- Processing date: {loop_date_str} ---")
            try:
                assignments = self._generate_assignments_for_date(current_date)

                if assignments:
                    self.logger.info(f"Generated {len(assignments)} assignments for {loop_date_str}")
                    date_count += 1
                elif create_empty_schedules:
                    self.logger.warning(f"No coverage or shifts applicable for {loop_date_str}. Creating empty entry.")
                    self.process_tracker.log_warning(f"Creating empty schedule entry for {loop_date_str}", log_to_diag=True)
                    self._create_empty_schedule_entries(current_date)
                    empty_dates += 1
                else:
                    self.logger.warning(f"No coverage, shifts, or assignable employees found for {loop_date_str}. Skipping date.")
                    self.process_tracker.log_warning(f"Skipping date {loop_date_str} due to lack of coverage/shifts/assignments.", log_to_diag=True)


                # Move to the next date
                current_date += timedelta(days=1)

            except Exception as e:
                error_msg = f"Error generating assignments for {loop_date_str}: {str(e)}"
                self.logger.error(error_msg, exc_info=True)
                self.process_tracker.log_error(error_msg, exc_info=True)
                # Optionally end the step/process here, or try to continue with the next date
                # For now, let's end the process on date-specific failure
                self.process_tracker.end_step({"status": "failed", "error_date": loop_date_str, "error": str(e)})
                self.process_tracker.end_process({"status": "failed", "reason": f"Error during assignment for {loop_date_str}"})
                raise ScheduleGenerationError(error_msg) from e

        # Finish date processing loop
        self.process_tracker.end_step(
            {
                "status": "success",
                "dates_processed": (end_date - start_date).days + 1,
                "dates_with_assignments": date_count,
                "dates_empty_created": empty_dates,
            }
        )

        # Step 3: Serialization & Validation
        self.process_tracker.start_step("Schedule Serialization and Validation")
        try:
            # Serialize first
            serialized_result = self.serializer.serialize_schedule(
                self.schedule.get_schedule()
            )
            self.process_tracker.log_step_data("Serialized Schedule Size", len(str(serialized_result)), level=logging.DEBUG)


            # Add metrics
            metrics = self.distribution_manager.get_distribution_metrics()
            if metrics:
                serialized_result["metrics"] = metrics
                self.process_tracker.log_step_data("Distribution Metrics", metrics, level=logging.INFO)


            # Perform validation
            valid_count = 0
            invalid_count = 0
            validation_details = {} # Store details per employee

            for assignment in self.schedule.get_assignments():
                # Skip empty schedule entries
                if isinstance(assignment, dict) and assignment.get("status") == "EMPTY":
                    continue

                # Get employee_id and shift_id based on type
                employee_id = (
                    assignment.get("employee_id")
                    if isinstance(assignment, dict)
                    else getattr(assignment, 'employee_id', None)
                )
                shift_id = (
                    assignment.get("shift_id")
                    if isinstance(assignment, dict)
                    else getattr(assignment, 'shift_id', None)
                )
                assignment_date_obj = (
                    assignment.get("date")
                    if isinstance(assignment, dict)
                    else getattr(assignment, 'date', None)
                )
                # Ensure date is a date object
                if isinstance(assignment_date_obj, str):
                    assignment_date_obj = date.fromisoformat(assignment_date_obj)


                if employee_id and shift_id and assignment_date_obj:
                    employee = self.resources.get_employee(employee_id)
                    shift = self.resources.get_shift(shift_id) # Should get template here

                    if employee and shift:
                        violations = self.constraint_checker.check_all_constraints(
                            employee, assignment_date_obj, shift, self.schedule_by_date
                        )
                        if not violations:
                            valid_count += 1
                        else:
                            invalid_count += 1
                            if employee_id not in validation_details:
                                validation_details[employee_id] = []
                            validation_details[employee_id].append({
                                "date": assignment_date_obj.isoformat(),
                                "shift_id": shift_id,
                                "violations": violations
                            })
                            self.diagnostic_logger.warning(f"Constraint violation for Emp {employee_id} on {assignment_date_obj}: {violations}")
                    else:
                         self.logger.warning(f"Could not find Employee ({employee_id}) or Shift ({shift_id}) during final validation.")


            serialized_result["validation"] = {
                "valid_assignments": valid_count,
                "invalid_assignments": invalid_count,
                "details": validation_details # Add violation details
            }
            self.process_tracker.log_step_data("Validation Results", serialized_result["validation"], level=logging.INFO)


            # Add additional schedule info
            serialized_result["schedule_info"] = {
                "session_id": self.session_id, # Add session ID
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "version": self.schedule.version,
                "total_dates": (end_date - start_date).days + 1,
                "dates_with_assignments": date_count,
                "empty_dates_created": empty_dates,
            }

            self.process_tracker.end_step({"status": "success"})

        except Exception as e:
            error_msg = f"Error during serialization/validation: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            self.process_tracker.log_error(error_msg, exc_info=True)
            self.process_tracker.end_step({"status": "failed", "error": str(e)})
            self.process_tracker.end_process({"status": "failed", "reason": "Serialization/Validation error"})
            raise ScheduleGenerationError(error_msg) from e


        # Prepare final stats for process end
        final_stats = {
            "status": "success",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_dates": (end_date - start_date).days + 1,
            "dates_with_assignments": date_count,
            "empty_dates_created": empty_dates,
            "valid_assignments": valid_count,
            "invalid_assignments": invalid_count,
        }
        if metrics:
            final_stats["metrics"] = metrics # Use already fetched metrics

        # End the overall process tracking
        self.process_tracker.end_process(final_stats)
        self.logger.info(f"Schedule generation finished. Session: {self.session_id}")
        self.diagnostic_logger.info(f"Diagnostic log path: {central_logger.get_diagnostic_log_path(self.session_id)}")


        return serialized_result

    def _validate_shift_durations(self):
        """
        Validate that all shift templates have durations
        Raises ScheduleGenerationError if validation fails
        """
        self.diagnostic_logger.debug("Starting shift duration validation.")
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
                    # Basic check: Ensure they are string representations of time
                    if isinstance(shift.start_time, str) and ":" in shift.start_time and \
                       isinstance(shift.end_time, str) and ":" in shift.end_time:
                        has_duration = True # Assume calculable, actual calculation happens elsewhere

            if not has_duration:
                shift_id = shift.id if hasattr(shift, "id") else "Unknown ID"
                self.diagnostic_logger.warning(f"Shift {shift_id} seems to be missing duration information.")
                missing_durations.append(shift_id)

        if missing_durations:
            error_msg = f"Shifts missing required duration information: {missing_durations}"
            self.logger.error(error_msg)
            self.process_tracker.log_error(error_msg) # Log via tracker too
            raise ScheduleGenerationError(f"Schichtdauer fehlt für Schichten: {missing_durations}")


        self.diagnostic_logger.debug(f"Shift duration validation completed. {len(missing_durations)} shifts possibly missing duration.")
        return not missing_durations # Return True if validation passes

    def _process_coverage(self, current_date: date) -> Dict[int, int]:
        """
        Process coverage records to determine staffing needs per shift for a date.
        Returns a dictionary mapping shift_id to the number of employees needed.
        """
        self.diagnostic_logger.debug(f"Processing coverage for date: {current_date}")
        shift_needs: Dict[int, int] = {}
        applicable_coverage_found = False

        self.diagnostic_logger.debug(f"Total available coverage records: {len(self.resources.coverage)}")
        self.process_tracker.log_step_data("Available Coverage Records", len(self.resources.coverage))

        # Find coverage records for this date or day of week
        for coverage in self.resources.coverage:
            cov_id = getattr(coverage, 'id', 'N/A')
            self.diagnostic_logger.debug(f"Checking coverage record {cov_id}")

            # Check if this coverage applies to this date
            if self._coverage_applies_to_date(coverage, current_date):
                applicable_coverage_found = True
                employees_needed = getattr(coverage, "min_employees", 0)
                # Fallback for older naming?
                if not employees_needed and hasattr(coverage, "employees_needed"):
                     employees_needed = coverage.employees_needed

                # Get the coverage start and end times for reference
                coverage_start = getattr(coverage, "start_time", None)
                coverage_end = getattr(coverage, "end_time", None)

                # Check if this is a valid coverage record with needed information
                if employees_needed > 0 and coverage_start and coverage_end:
                    # Instead of using shift_id, we'll use a generic key
                    # We'll create a "virtual" shift need using the coverage ID
                    # This allows us to track staffing needs without requiring shift_id in coverage
                    shift_needs[cov_id] = employees_needed
                    self.diagnostic_logger.info(
                        f"Applicable coverage {cov_id} from {coverage_start} to {coverage_end}: needs {employees_needed} employees."
                    )
                else:
                    self.diagnostic_logger.warning(
                        f"Applicable coverage record {cov_id} has invalid configuration: "
                        f"min_employees={employees_needed}, start={coverage_start}, end={coverage_end}"
                    )

        if not applicable_coverage_found:
             self.diagnostic_logger.warning(f"No applicable coverage records found for date {current_date}")
        else:
            self.diagnostic_logger.info(f"Final shift needs for {current_date}: {shift_needs}")

        self.process_tracker.log_step_data("Shift Needs Determined", shift_needs)
        return shift_needs


    def _coverage_applies_to_date(self, coverage, check_date: date) -> bool:
        """Check if a coverage record applies to the given date"""
        cov_id = getattr(coverage, 'id', 'N/A')
        self.diagnostic_logger.debug(f"Checking if coverage {cov_id} applies to {check_date}")

        # Check for specific date first (higher priority)
        if hasattr(coverage, "date") and coverage.date:
            coverage_date = coverage.date
            if isinstance(coverage_date, str):
                try:
                    coverage_date = date.fromisoformat(coverage_date.split('T')[0]) # Handle datetime strings
                except (ValueError, TypeError):
                    self.diagnostic_logger.warning(f"Coverage {cov_id} has invalid date string: {coverage.date}")
                    return False
            elif not isinstance(coverage_date, date):
                 self.diagnostic_logger.warning(f"Coverage {cov_id} has unexpected date type: {type(coverage.date)}")
                 return False

            applies = (coverage_date == check_date)
            self.diagnostic_logger.debug(f"Coverage {cov_id} has specific date {coverage_date}. Match with {check_date}: {applies}")
            return applies

        # Check for day of week if no specific date matches
        day_field = None
        if hasattr(coverage, "day_index"):
            day_field = coverage.day_index
        elif hasattr(coverage, "day_of_week"):
            day_field = coverage.day_of_week

        if day_field is not None:
            try:
                # Ensure day_field is an integer
                coverage_day_index = int(day_field)

                # System uses Monday=0 to Sunday=6 for weekday()
                check_weekday = check_date.weekday() # Monday is 0, Sunday is 6

                # Adjust our coverage_day_index if it uses a different standard (e.g., Sunday=0)
                # Assuming coverage uses Sunday=0, Monday=1, ..., Saturday=6
                # We need to match Python's Monday=0 standard.
                # If coverage_day_index is 0 (Sunday), it matches Python's 6.
                # If coverage_day_index is 1 (Monday), it matches Python's 0.
                # ...
                # If coverage_day_index is 6 (Saturday), it matches Python's 5.
                # Formula: python_weekday = (coverage_day_index - 1 + 7) % 7 # Not quite right
                # Let's try: coverage_matches_python = (check_weekday == (coverage_day_index -1 + 7) % 7) ? No.

                # Let's assume coverage.day_index uses 0=Sunday, 1=Monday, ..., 6=Saturday standard
                # Python check_date.weekday() uses 0=Monday, ..., 6=Sunday standard
                python_weekday_for_coverage_index = (coverage_day_index - 1 + 7) % 7
                applies = (check_weekday == python_weekday_for_coverage_index)

                # OR, maybe coverage uses 0=Monday..6=Sunday? Check data structure.
                # Let's ASSUME coverage.day_index aligns with python's weekday() [0=Mon, 6=Sun] for now.
                # If this assumption is wrong, this logic needs fixing based on actual Coverage model standard.
                # applies = (coverage_day_index == check_weekday)


                self.diagnostic_logger.debug(
                    f"Coverage {cov_id} day_index={coverage_day_index}. Check date {check_date} python_weekday={check_weekday}. Match: {applies}"
                )
                return applies
            except (ValueError, TypeError):
                 self.diagnostic_logger.warning(f"Coverage {cov_id} has invalid day_index/day_of_week: {day_field}")
                 return False


        self.diagnostic_logger.debug(f"Coverage {cov_id} has no specific date or applicable day of week. No match.")
        return False

    def _create_date_shifts(self, date_to_create: date) -> List[Dict]:
        """Create shift instances for a specific date based on shift templates"""
        date_shifts = []
        weekday = date_to_create.weekday() # 0 = Monday, 6 = Sunday
        
        self.logger.info(f"Creating shifts for date {date_to_create} (weekday {weekday})")
        
        # Find all shift templates active on this day
        for shift_template in self.resources.shifts:
            shift_active_days = []
            
            # Handle both object and dictionary representations
            if hasattr(shift_template, 'active_days') and shift_template.active_days:
                if isinstance(shift_template.active_days, list):
                    shift_active_days = shift_template.active_days
                elif isinstance(shift_template.active_days, str):
                    # Parse JSON or comma-separated string
                    try:
                        import json
                        shift_active_days = json.loads(shift_template.active_days)
                    except (json.JSONDecodeError, ValueError):
                        # Try comma-separated format
                        try:
                            shift_active_days = [int(d.strip()) for d in shift_template.active_days.split(',') if d.strip()]
                        except ValueError:
                            self.logger.warning(f"Could not parse active_days for shift {shift_template.id}: {shift_template.active_days}")
                            continue
            
            # Skip if shift is not active on this day
            if not shift_active_days or weekday not in shift_active_days:
                continue
                
            # Extract shift details
            shift_id = getattr(shift_template, 'id', None)
            if not shift_id:
                self.logger.warning(f"Shift template has no ID, skipping: {shift_template}")
                continue
                
            # Get shift type - try multiple attributes
            shift_type = None
            if hasattr(shift_template, 'shift_type_id'):
                shift_type = shift_template.shift_type_id
            elif hasattr(shift_template, 'shift_type'):
                # Handle both string and enum values
                if hasattr(shift_template.shift_type, 'value'):
                    shift_type = shift_template.shift_type.value
                else:
                    shift_type = shift_template.shift_type
                    
            # Default to a shift type based on start time if none specified
            if not shift_type:
                start_time = getattr(shift_template, 'start_time', '09:00')
                try:
                    start_hour = int(start_time.split(':')[0])
                    if start_hour < 11:
                        shift_type = "EARLY"
                    elif start_hour >= 14:
                        shift_type = "LATE"
                    else:
                        shift_type = "MIDDLE"
                except (ValueError, IndexError):
                    shift_type = "MIDDLE"  # Default
            
            # Create shift instance
            shift_instance = {
                'id': shift_id,                        # Original shift template ID
                'shift_id': shift_id,                  # Duplicate for compatibility
                'date': date_to_create,
                'start_time': getattr(shift_template, 'start_time', '09:00'),
                'end_time': getattr(shift_template, 'end_time', '17:00'),
                'duration_hours': getattr(shift_template, 'duration_hours', 8.0),
                'shift_type': shift_type,
                'shift_type_id': getattr(shift_template, 'shift_type_id', shift_type),
                'requires_keyholder': getattr(shift_template, 'requires_keyholder', False),
                'active_days': shift_active_days
            }
            
            self.logger.info(f"Created shift instance: ID={shift_id}, type={shift_type}, time={shift_instance['start_time']}-{shift_instance['end_time']}")
            date_shifts.append(shift_instance)
        
        self.logger.info(f"Created {len(date_shifts)} shift instances for {date_to_create}")
        return date_shifts


    def _generate_assignments_for_date(self, current_date: date) -> List[Dict]:
        """Generate assignments for a specific date"""
        date_str = current_date.isoformat()
        self.diagnostic_logger.info(f"--- Generating assignments for {date_str} ---")
        # Use ProcessTracker to manage sub-steps within this daily generation
        self.process_tracker.start_step(f"Process Daily Assignments for {date_str}")
        assignments = []
        try:
            # Sub-step: Process Coverage
            self.process_tracker.start_step(f"Process Coverage for {date_str}")
            shift_needs = self._process_coverage(current_date)
            self.process_tracker.end_step({"shift_needs": shift_needs})
            
            self.diagnostic_logger.info(f"DEBUG: Coverage needs result: {shift_needs}")
            
            if not shift_needs:
                self.logger.warning(f"No coverage requirements found for {date_str}, cannot generate assignments.")
                return [] # Return early if no staff needed


            # Sub-step: Create Shifts
            self.process_tracker.start_step(f"Create Shift Instances for {date_str}")
            date_shifts = self._create_date_shifts(current_date) # These are shift *instances* (dicts)
            self.process_tracker.end_step({"shifts_created": len(date_shifts)})
            
            self.diagnostic_logger.info(f"DEBUG: Created shift instances: {len(date_shifts)}")
            if date_shifts:
                self.diagnostic_logger.info(f"DEBUG: First shift instance: {date_shifts[0]}")
            
            if not date_shifts:
                self.logger.warning(f"No applicable shift templates found for {date_str}, cannot generate assignments.")
                return [] # Return early if no shifts are defined/active


            self.logger.info(f"Needs for {date_str}: {shift_needs}. Available shift instances: {len(date_shifts)}")
            self.diagnostic_logger.debug(f"Shift Instances for {date_str}: {date_shifts}") # Log the actual instances

            # REMOVED CONSTRAINT: No longer filtering shifts to only those with exact ID matches in coverage
            # Instead, use all active shifts for the day
            needed_shift_instances = date_shifts
            
            # If we have no shifts, return early
            if not needed_shift_instances:
                self.logger.warning(f"No active shifts for {date_str}. Cannot generate assignments.")
                return []

            self.diagnostic_logger.info(f"Using {len(needed_shift_instances)} shift instances for {date_str}")
            self.process_tracker.log_step_data("Shift Instances Used", needed_shift_instances)


            # Sub-step: Distribute Employees
            self.process_tracker.start_step(f"Distribute Employees for {date_str}")
            
            self.diagnostic_logger.info(f"DEBUG: Before distribution call, parameters:")
            self.diagnostic_logger.info(f"DEBUG: current_date: {current_date}")
            self.diagnostic_logger.info(f"DEBUG: needed_shift_instances count: {len(needed_shift_instances)}")
            self.diagnostic_logger.info(f"DEBUG: shift_needs: {shift_needs}")
            
            self.diagnostic_logger.info(f"DEBUG: Calling distribution_manager.assign_employees_with_distribution")
            assignments = self.distribution_manager.assign_employees_with_distribution(
                 current_date, needed_shift_instances, shift_needs
            )
            self.diagnostic_logger.info(f"DEBUG: Distribution call returned {len(assignments)} assignments")
            
            # Note: assign_employees_with_distribution should return ScheduleAssignment objects or compatible dicts
            self.process_tracker.end_step({"assignments_generated": len(assignments)})


            if not assignments:
                self.logger.warning(f"DistributionManager failed to generate any assignments for {date_str}")
                # No need to return [], assignment list is empty

            self.logger.info(f"Generated {len(assignments)} assignments for {date_str}")
            self.process_tracker.log_step_data("Generated Assignments", assignments)


            # Add assignments to main schedule container and daily cache
            for assignment in assignments:
                 # Ensure assignment is in a consistent format (e.g., ScheduleAssignment object)
                 # If distribution_manager returns dicts, convert them or ensure consistency
                 if isinstance(assignment, dict):
                      # Minimal check, assumes dict structure matches ScheduleAssignment needs
                      self.schedule.add_assignment(assignment)
                 elif isinstance(assignment, ScheduleAssignment):
                      self.schedule.add_assignment(assignment)
                 else:
                      self.logger.error(f"Unexpected assignment type from DistributionManager: {type(assignment)}")
                      continue # Skip invalid assignment type

                 if current_date not in self.schedule_by_date:
                    self.schedule_by_date[current_date] = []
                 self.schedule_by_date[current_date].append(assignment)
                 self.diagnostic_logger.debug(f"Added assignment to schedule & daily cache: {assignment}")


            # Sub-step: Validate Assignments (using constraints checker)
            self.process_tracker.start_step(f"Validate Assignments for {date_str}")
            valid_count = 0
            invalid_count = 0
            for assignment in assignments:
                employee_id = getattr(assignment, 'employee_id', assignment.get('employee_id'))
                shift_id = getattr(assignment, 'shift_id', assignment.get('shift_id'))
                shift_template = getattr(assignment, 'shift_template', assignment.get('shift_template')) # Need template for constraints


                if employee_id and shift_id and shift_template:
                    employee = self.resources.get_employee(employee_id)
                    # We need the shift *template* for constraint checking, not just the ID
                    shift = shift_template # Assuming shift_template is the actual template object

                    if employee and shift:
                        self.diagnostic_logger.debug(f"Validating assignment: Emp {employee_id}, Shift {shift_id}, Date {date_str}")
                        # Pass schedule_by_date for context-aware constraints
                        violations = self.constraint_checker.check_all_constraints(employee, current_date, shift, self.schedule_by_date)
                        if not violations:
                            valid_count += 1
                            self.diagnostic_logger.debug(f"Assignment VALID for Emp {employee_id}")
                        else:
                            invalid_count += 1
                            self.logger.warning(
                                f"Assignment for employee {employee_id} on {date_str} (Shift {shift_id}) "
                                f"has constraint violations: {violations}"
                            )
                            self.diagnostic_logger.warning(f"Assignment INVALID for Emp {employee_id}: {violations}")
                    else:
                        self.logger.warning(f"Could not find Employee ({employee_id}) or Shift Template ({shift_id}) for validation.")
                else:
                     self.logger.warning(f"Skipping validation for incomplete assignment data: {assignment}")


            self.logger.info(
                f"Assignment validation for {date_str}: "
                f"{valid_count} valid, {invalid_count} invalid"
            )
            self.process_tracker.end_step({
                "Valid Assignments": valid_count,
                "Invalid Assignments": invalid_count
            })


            return assignments # Return the list of generated assignments for this date

        except Exception as e:
            error_msg = f"Error generating assignments for date {date_str}: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            self.process_tracker.log_error(error_msg, exc_info=True)
            raise # Re-raise after logging
        finally:
            # Ensure the outer step for the date ends
            if self.process_tracker.current_step == f"Process Daily Assignments for {date_str}":
                self.process_tracker.end_step({"assignments_count": len(assignments)})


    def _create_empty_schedule_entries(self, current_date: date):
        """Create empty schedule entries for a specific date"""
        self.diagnostic_logger.debug(f"Creating empty schedule entry structure for date: {current_date}")
        # Use a structure consistent with serialized output if possible
        empty_assignment = {
            "date": current_date.isoformat(), # Use ISO format string
            "employee_id": None,
            "shift_id": None,
            "start_time": None,
            "end_time": None,
            "shift_name": None,
            "status": "EMPTY", # Specific status for empty days
            "version": self.schedule.version, # Match schedule version
            "employee_name": None,
        }
        # Add directly to the schedule's entries list
        self.schedule.entries.append(empty_assignment)
        # Also add to the daily cache for consistency during generation
        if current_date not in self.schedule_by_date:
             self.schedule_by_date[current_date] = []
        self.schedule_by_date[current_date].append(empty_assignment)
        self.process_tracker.log_step_data(f"Empty Entry Created for {current_date}", empty_assignment, level=logging.DEBUG)

    def _save_to_database(self):
        """
        Save the generated schedules to the database
        This method is called by the API endpoint after generation.
        """
        try:
            self.logger.info(f"Saving generated schedules to database (session {self.session_id})")
            self.diagnostic_logger.info("Starting database save operation")
            
            if not self.schedule or not hasattr(self.schedule, "entries") or not self.schedule.entries:
                self.logger.error("No schedule entries to save")
                return False
                
            # Import database model
            from sqlalchemy.exc import SQLAlchemyError
            from models import db, Schedule as DbSchedule
            
            # Record stats for logging
            new_entries = 0
            updated_entries = 0
            errors = 0
            
            # Use a single transaction for efficiency
            try:
                for entry in self.schedule.entries:
                    try:
                        # Skip empty schedule entries
                        if isinstance(entry, dict) and entry.get("status") == "EMPTY":
                            continue
                            
                        # Extract data based on entry type (dict or object)
                        if isinstance(entry, dict):
                            employee_id = entry.get("employee_id")
                            shift_id = entry.get("shift_id")
                            entry_date = entry.get("date")
                            version = entry.get("version", self.schedule.version)
                            break_start = entry.get("break_start")
                            break_end = entry.get("break_end")
                            notes = entry.get("notes")
                            availability_type = entry.get("availability_type")
                        else:
                            # Assuming ScheduleAssignment object
                            employee_id = getattr(entry, "employee_id", None)
                            shift_id = getattr(entry, "shift_id", None)
                            entry_date = getattr(entry, "date", None)
                            version = getattr(entry, "version", self.schedule.version)
                            break_start = getattr(entry, "break_start", None)
                            break_end = getattr(entry, "break_end", None)
                            notes = getattr(entry, "notes", None)
                            availability_type = getattr(entry, "availability_type", None)
                        
                        # Ensure date is in the correct format
                        if isinstance(entry_date, str):
                            from datetime import datetime
                            entry_date = datetime.fromisoformat(entry_date.split('T')[0]).date()
                        
                        if not employee_id or not entry_date:
                            self.logger.warning(f"Skipping entry with missing data: employee_id={employee_id}, date={entry_date}")
                            continue
                            
                        # Check if this schedule entry already exists
                        existing = DbSchedule.query.filter_by(
                            employee_id=employee_id,
                            date=entry_date,
                            version=version
                        ).first()
                        
                        if existing:
                            # Update existing entry
                            existing.shift_id = shift_id
                            if break_start:
                                existing.break_start = break_start
                            if break_end:
                                existing.break_end = break_end
                            if notes:
                                existing.notes = notes
                            if availability_type:
                                existing.availability_type = availability_type
                            updated_entries += 1
                            self.diagnostic_logger.debug(
                                f"Updated existing schedule: emp={employee_id}, date={entry_date}, shift={shift_id}"
                            )
                        else:
                            # Create new entry
                            new_entry = DbSchedule(
                                employee_id=employee_id,
                                shift_id=shift_id,
                                date=entry_date,
                                version=version,
                                break_start=break_start,
                                break_end=break_end,
                                notes=notes,
                                availability_type=availability_type
                            )
                            db.session.add(new_entry)
                            new_entries += 1
                            self.diagnostic_logger.debug(
                                f"Created new schedule: emp={employee_id}, date={entry_date}, shift={shift_id}"
                            )
                    except Exception as e:
                        self.logger.error(f"Error processing schedule entry {entry}: {str(e)}")
                        errors += 1
                        continue  # Continue with next entry
                
                # Commit all changes
                db.session.commit()
                self.logger.info(
                    f"Successfully saved schedules to database: {new_entries} new, {updated_entries} updated, {errors} errors"
                )
                self.process_tracker.log_step_data(
                    "Database Save Results", 
                    {"new": new_entries, "updated": updated_entries, "errors": errors},
                    level=logging.INFO
                )
                return True
                
            except SQLAlchemyError as e:
                db.session.rollback()
                self.logger.error(f"Database error while saving schedules: {str(e)}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to save schedules to database: {str(e)}", exc_info=True)
            return False
