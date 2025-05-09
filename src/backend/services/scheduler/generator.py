"""Schedule generation service for Schichtplan."""
"""Schedule generation service for Schichtplan."""
from datetime import date, datetime, timedelta
import logging
from typing import Dict, List, Any, Optional, TYPE_CHECKING, Union
import sys
import os
import uuid # Import uuid for session ID generation
from collections import defaultdict # ADDED defaultdict

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
from .config import SchedulerConfig # Generator's own runtime config
from .constraints import ConstraintChecker
from .availability import AvailabilityChecker
from .distribution import DistributionManager
from .serialization import ScheduleSerializer
from .logging_utils import ProcessTracker # Renamed from LoggingManager
from .resources import ScheduleResources as RuntimeScheduleResources # Runtime alias
from .validator import ScheduleValidator
from .validator import ScheduleConfig as ValidatorRuntimeScheduleConfig # Runtime alias for validator's config

# --- Explicit Imports for Type Checking ---
if TYPE_CHECKING:
    from .resources import ScheduleResources as ActualScheduleResources
    from .config import SchedulerConfig as ActualSchedulerConfig # Generator's own config class for type hints
    from .validator import ScheduleConfig as ActualValidatorScheduleConfig # Validator's config class for type hints
    from backend.models.schedule import Schedule as ActualScheduleModel # The DB model for assignments/schedule entries

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
        date_val: date,
        shift_template: Any = None,
        availability_type: Optional[str] = None,
        status: str = "PENDING",
        version: int = 1,
    ):
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.date = date_val
        self.shift_template = shift_template
        self.availability_type = availability_type or (AvailabilityType.AVAILABLE.value if hasattr(AvailabilityType, 'AVAILABLE') else "AVL")
        self.status = status
        self.version = version
        self.start_time: Optional[str] = None
        self.end_time: Optional[str] = None
        if shift_template and hasattr(shift_template, 'start_time'):
            self.start_time = shift_template.start_time
        if shift_template and hasattr(shift_template, 'end_time'):
            self.end_time = shift_template.end_time


class ScheduleContainer:
    """Container class for schedule metadata"""

    def __init__(self, start_date: date, end_date: date, status="DRAFT", version=1):
        self.start_date = start_date
        self.end_date = end_date
        self.status = status
        self.version = version
        self.assignments: List[ScheduleAssignment] = []
        self.schedule_entries_by_date: Dict[date, List[ScheduleAssignment]] = defaultdict(list)
        self.id = None  # Add an ID field

    def get_schedule(self) -> List[ScheduleAssignment]:
        """Return self as this is the schedule container"""
        return self.assignments

    def get_assignments(self) -> List[ScheduleAssignment]:
        """Return the schedule entries"""
        return self.assignments

    def add_assignment(self, assignment: ScheduleAssignment):
        """Add an assignment to the schedule"""
        self.assignments.append(assignment)
        self.schedule_entries_by_date[assignment.date].append(assignment)

    def get_assignments_for_date(self, target_date: date) -> List[ScheduleAssignment]:
        """Get all assignments for a specific date"""
        return self.schedule_entries_by_date.get(target_date, [])


class ScheduleGenerator:
    """
    Main class for generating employee schedules.
    Coordinates the scheduling process using the specialized modules.
    """

    def __init__(self, resources: Optional[RuntimeScheduleResources] = None, passed_config: Optional[SchedulerConfig] = None):
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
        if TYPE_CHECKING:
            self.resources: ActualScheduleResources = resources if resources is not None else ActualScheduleResources()
            self.config: ActualSchedulerConfig = passed_config if passed_config is not None else ActualSchedulerConfig()
        else:
            self.resources = resources if resources is not None else RuntimeScheduleResources()
            self.config = passed_config if passed_config is not None else SchedulerConfig() # This is generator's .config.SchedulerConfig
        
        self.logger.debug(f"ScheduleGenerator initialized (Session: {self.session_id})")
        self.diagnostic_logger.debug(f"SchedulerConfig (Generator): {self.config.__dict__ if self.config and hasattr(self.config, '__dict__') else 'None'}")

        # Create a ValidatorScheduleConfig instance for ConstraintChecker
        # ValidatorRuntimeScheduleConfig is an alias for validator.ScheduleConfig
        # The from_settings method in validator.ScheduleConfig is used.
        # We attempt to pass the generator's config as a dictionary, or an empty dict if not suitable.
        validator_specific_config_settings = self.config.__dict__ if self.config and hasattr(self.config, '__dict__') else {}
        if not validator_specific_config_settings and self.config: # If config is not dict-like, maybe it *is* the settings
             validator_specific_config_settings = self.config 

        validator_specific_config = ValidatorRuntimeScheduleConfig.from_settings(validator_specific_config_settings)
        self.diagnostic_logger.debug(f"SchedulerConfig (Validator for ConstraintChecker): {validator_specific_config.__dict__ if validator_specific_config else 'None'}")

        # Initialize the specialized modules, passing the correct logger and configs
        self.constraint_checker = ConstraintChecker(self.resources, validator_specific_config, self.logger)
        self.availability_checker = AvailabilityChecker(self.resources, self.logger)
        self.distribution_manager = DistributionManager(
            self.resources,
            self.constraint_checker, # Gets the correctly typed config via ConstraintChecker
            self.availability_checker,
            self.config,  # DistributionManager itself receives the generator's config
            self.logger,
        )
        self.serializer = ScheduleSerializer(self.logger)

        # Schedule data
        if TYPE_CHECKING:
            self.schedule: Optional[ScheduleContainer] = None
        else:
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
        external_config_dict: Optional[Dict] = None,
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
        self.diagnostic_logger.info(f"Generation parameters: start={start_date}, end={end_date}, config={external_config_dict}, create_empty={create_empty_schedules}, version={version}")

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
            schedule_assignments_to_process: List[ScheduleAssignment] = []
            if self.schedule:
                schedule_assignments_to_process = self.schedule.get_assignments()
            
            # CONVERSION STEP: ScheduleAssignment to dict or ActualScheduleModel for serializer/validator
            # This is a placeholder; actual mapping fields would be needed.
            processed_for_downstream: List[Dict] = []
            if TYPE_CHECKING:
                 # For type hinting, this would be List[ActualScheduleModel]
                 # but the conversion logic to ActualScheduleModel instances is complex here.
                 # Using List[Dict] as a common intermediate form.
                 pass 
            
            for sa in schedule_assignments_to_process:
                processed_for_downstream.append({
                    "id": getattr(sa, 'id', None), # ScheduleAssignment might not have an ID yet
                    "employee_id": sa.employee_id,
                    "shift_id": sa.shift_id,
                    "date": sa.date.isoformat() if sa.date else None,
                    "start_time": sa.start_time,
                    "end_time": sa.end_time,
                    "status": sa.status,
                    "version": sa.version,
                    # Potentially other fields needed by ActualScheduleModel or serializer
                })

            serialized_result = self.serializer.serialize_schedule(processed_for_downstream) 
            metrics = self.distribution_manager.get_distribution_metrics()
            if metrics:
                serialized_result["metrics"] = metrics
                self.process_tracker.log_step_data("Distribution Metrics", metrics, level=logging.INFO)


            # Perform validation
            self.process_tracker.start_step("Schedule Validation")
            
            validator_config_arg: Optional[Union[ActualValidatorScheduleConfig, ValidatorRuntimeScheduleConfig]] = None
            if external_config_dict:
                if TYPE_CHECKING:
                    # validator_config_arg = ActualValidatorScheduleConfig.from_settings(external_config_dict) # Ideal
                    pass # Placeholder until from_settings is confirmed for ActualValidatorScheduleConfig
                else:
                    validator_config_arg = ValidatorRuntimeScheduleConfig.from_settings(external_config_dict)
            else: # Use self.config (generator's config)
                if TYPE_CHECKING:
                    # This assumes ActualSchedulerConfig is compatible with or convertible to ActualValidatorScheduleConfig
                    # If not, conversion logic or a more specific type is needed.
                    # validator_config_arg = convert_generator_config_to_validator_config(self.config)
                    pass # Placeholder
                else:
                    # At runtime, if ValidatorRuntimeScheduleConfig can take SchedulerConfig or has from_settings for it.
                    # validator_config_arg = ValidatorRuntimeScheduleConfig.from_generator_config(self.config)
                    pass # Placeholder; direct pass might cause issues if types differ
            
            # If no external_config_dict and no conversion, pass self.config (hoping for compatibility)
            if validator_config_arg is None: # Fallback if above blocks don't assign due to placeholders
                 # This was: validator_config_arg = self.config (which is the wrong type)
                 # Create ValidatorRuntimeScheduleConfig from self.config (generator's config) or default.
                 settings_for_validator = self.config.__dict__ if self.config and hasattr(self.config, '__dict__') else {}
                 if not settings_for_validator and self.config: # if self.config is not dict-like, maybe it *is* the settings obj
                     settings_for_validator = self.config
                 validator_config_arg = ValidatorRuntimeScheduleConfig.from_settings(settings_for_validator)

            validator = ScheduleValidator(self.resources)
            # validator.validate expects List[ActualScheduleModel] or List[Dict] that maps to it.
            validation_errors = validator.validate(processed_for_downstream, config=validator_config_arg)
            
            coverage_summary = validator.get_coverage_summary()
            self.process_tracker.end_step({
                "constraint_errors": len(validation_errors), 
                "coverage_total_intervals": coverage_summary.get("total_intervals_checked", 0)
            })
            
            # Add constraint violation details (as before)
            constraint_violation_details = validator.get_error_report()["errors"]

            serialized_result["validation"] = {
                "constraint_errors_count": len(validation_errors),
                "constraint_details": constraint_violation_details,
                # ADDED: Coverage summary
                "coverage_summary": coverage_summary
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
            "invalid_assignments": len(validation_errors), # Use count from validation_errors
        }
        if metrics:
            final_stats["metrics"] = metrics # Use already fetched metrics
        # ADDED: Include coverage summary in final stats if available
        if coverage_summary:
            final_stats["coverage_summary"] = coverage_summary

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
        """
        Generates shift assignments for a single date.
        This method will now:
        1. Create potential shift instances for the day.
        2. Delegate to DistributionManager to assign employees to these shifts
           based on interval-based coverage needs (to be implemented in DistributionManager).
        """
        date_str = current_date.isoformat()
        self.diagnostic_logger.debug(f"--- Generating assignments for date: {date_str} ---")
        self.process_tracker.log_info(f"Starting assignment generation for {date_str}")

        assignments_for_date: List[Dict] = []

        try:
            # Sub-step: Create Shift Instances
            self.process_tracker.start_step(f"Create Shift Instances for {date_str}")
            # These are shift *instances* (dicts), potential shifts for the day
            potential_daily_shifts = self._create_date_shifts(current_date)
            self.process_tracker.end_step({"shifts_created": len(potential_daily_shifts)})
            
            self.diagnostic_logger.info(f"DEBUG: Created {len(potential_daily_shifts)} potential shift instances for {date_str}")
            if potential_daily_shifts:
                self.diagnostic_logger.info(f"DEBUG: First potential shift instance: {potential_daily_shifts[0]}")
            
            if not potential_daily_shifts:
                self.logger.warning(f"No applicable shift templates found for {date_str}, cannot generate assignments.")
                self.process_tracker.log_warning(f"No shift templates for {date_str}", log_to_diag=True)
                # Ensure the daily processing step is properly closed if returning early
                self.process_tracker.end_step({"status": "no_shift_templates"})
                return []

            self.logger.info(f"Proceeding with {len(potential_daily_shifts)} potential shifts for {date_str} to DistributionManager.")
            self.process_tracker.log_step_data("Potential Daily Shifts for Distribution", len(potential_daily_shifts))
            
            # Sub-step: Distribute Employees (call to DistributionManager)
            self.process_tracker.start_step(f"Distribute Employees for {date_str}")
            # Log the input to this step
            self.process_tracker.log_step_data("Shift Instances for Distribution", potential_daily_shifts)
            
            self.diagnostic_logger.info(f"DEBUG: Before distribution call, parameters:")
            self.diagnostic_logger.info(f"  current_date: {current_date}")
            self.diagnostic_logger.info(f"  date_shifts (potential_daily_shifts): {len(potential_daily_shifts)}")
            self.diagnostic_logger.info(f"  constraint_checker: {self.constraint_checker is not None}")
            self.diagnostic_logger.info(f"  availability_checker: {self.availability_checker is not None}")
            self.diagnostic_logger.info(f"  resources: {self.resources is not None}")

            # Call to DistributionManager - this will be the new core logic
            assignments_for_date = self.distribution_manager.generate_assignments_for_day(
                current_date=current_date,
                potential_shifts=potential_daily_shifts,
                resources=self.resources, # For get_required_staffing_for_interval
                constraint_checker=self.constraint_checker,
                availability_checker=self.availability_checker
            )

            if assignments_for_date:
                self.logger.info(f"DistributionManager returned {len(assignments_for_date)} assignments for {date_str}")
                self.diagnostic_logger.debug(f"Assignments from DM for {date_str}: {assignments_for_date}")
            else:
                self.logger.warning(f"DistributionManager returned no assignments for {date_str}")
            
            self.process_tracker.end_step({"assignments_created": len(assignments_for_date)})

        except Exception as e:
            error_msg = f"Error generating assignments for date {date_str}: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            self.process_tracker.log_error(error_msg, exc_info=True)
            raise # Re-raise after logging
        finally:
            # Ensure the outer step for the date ends
            if self.process_tracker.current_step == f"Process Daily Assignments for {date_str}":
                self.process_tracker.end_step({"assignments_count": len(assignments_for_date)})

        return assignments_for_date


    def _create_empty_schedule_entries(self, current_date: date):
        """
        Creates empty schedule entries for a given date if no coverage or shifts are applicable.
        This ensures that every day in the range has some form of record.
        """
        self.logger.info(f"Creating empty schedule entry for {current_date} (Session: {self.session_id})")
        # Create a placeholder assignment indicating no work
        # Ensure employee_id and shift_id are placeholders that make sense, e.g., 0 or -1
        # Or use a specific 'NO_SHIFT' or 'NO_EMPLOYEE' marker if defined.
        no_work_assignment = ScheduleAssignment(
            employee_id=0,  # Placeholder for 'no employee'
            shift_id=0,  # Placeholder for 'no shift'
            date_val=current_date,
            status="EMPTY",  # Custom status to indicate this is a placeholder
            version=self.schedule.version if self.schedule else 1,
        )
        if self.schedule:
            self.schedule.add_assignment(no_work_assignment) # Use the add_assignment method
            # The line below was self.schedule.entries.append(no_work_assignment)
            # It's replaced by add_assignment which handles both self.assignments and self.schedule_entries_by_date

        self.process_tracker.log_info(f"Empty schedule entry created for {current_date}")

    def _save_to_database(self):
        """
        Placeholder for saving the generated schedule to the database.
        Actual implementation will involve creating/updating Schedule and Assignment records.
        """
        self.process_tracker.start_step("Database Save")
        self.logger.info(f"Attempting to save schedule to database (Session: {self.session_id})")

        if not self.schedule or not hasattr(self.schedule, "assignments") or not self.schedule.assignments:
            self.logger.warning(
                f"No schedule data or no assignments in schedule to save. (Session: {self.session_id})"
            )
            self.process_tracker.log_warning("No schedule data to save.", log_to_diag=True)
            self.process_tracker.end_step({"status": "skipped", "reason": "No data"})
            return

        try:
            # Example: Iterate through self.schedule.assignments and save them
            # This would involve mapping ScheduleAssignment to the SQLAlchemy Schedule model
            # and then adding them to the session and committing.
            saved_count = 0
            failed_count = 0
            from backend.models import db 
            from backend.models.schedule import Schedule as DbSchedule, ScheduleStatus

            for entry in self.schedule.assignments:
                try:
                    # Map ScheduleAssignment (entry) to DbSchedule model instance
                    current_status_str = entry.status
                    target_status_enum = ScheduleStatus.DRAFT # Default
                    if current_status_str == "CONFIRMED":
                        target_status_enum = ScheduleStatus.PUBLISHED
                    elif current_status_str == "ARCHIVED":
                        target_status_enum = ScheduleStatus.ARCHIVED
                    # Add other mappings if necessary, e.g., for PENDING, EMPTY
                    # For now, unmapped statuses from ScheduleAssignment default to DRAFT in DbSchedule

                    db_entry = DbSchedule(
                        employee_id=entry.employee_id,
                        shift_id=entry.shift_id,
                        date=entry.date,
                        status=target_status_enum,
                        version=entry.version,
                        break_start=getattr(entry, 'break_start', None),
                        break_end=getattr(entry, 'break_end', None),
                        notes=getattr(entry, 'notes', None),
                        availability_type=getattr(entry, 'availability_type', None),
                        shift_type=getattr(entry, 'shift_type', None)
                    )
                    db.session.add(db_entry)
                    saved_count += 1
                except Exception as e_item:
                    failed_count += 1
                    self.logger.error(f"Failed to prepare or add schedule entry {entry} for DB: {e_item}", exc_info=True)
                    self.process_tracker.log_error(f"DB Save Error for item: {e_item}") # Removed log_to_diag=True

            if saved_count > 0:
                db.session.commit()
                self.logger.info(f"Successfully saved {saved_count} schedule entries to the database.")
                self.process_tracker.log_step_data("Entries Saved", saved_count)
            if failed_count > 0:
                self.logger.error(f"Failed to save {failed_count} schedule entries.")
                self.process_tracker.log_step_data("Entries Failed to Save", failed_count)

            if saved_count == 0 and failed_count == 0:
                 self.logger.info("No new entries were processed for saving.")

            self.process_tracker.end_step({"status": "success" if failed_count == 0 else "partial_success"})

        except Exception as e:
            self.logger.error(f"Error saving schedule to database: {e}", exc_info=True)
            self.process_tracker.log_error(f"Database Save Error: {e}", exc_info=True)
            self.process_tracker.end_step({"status": "failed", "error": str(e)})
            # Depending on policy, might raise an error or just log
            # raise ScheduleGenerationError(f"Failed to save schedule: {str(e)}") from e
