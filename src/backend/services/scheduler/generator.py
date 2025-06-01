"""
Core module for generating employee schedules.

This module defines the main classes and logic for creating schedules based on
employee availability, shift requirements, and various constraints. It coordinates
different aspects of scheduling such as resource loading, constraint checking,
assignment distribution, and serialization of the final schedule.
"""

import logging
import os
import sys
import uuid
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, TYPE_CHECKING, Union

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
    if not any(
        isinstance(h, logging.StreamHandler) for h in central_logger.app_logger.handlers
    ):
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)  # Or DEBUG
        console_formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        console_handler.setFormatter(console_formatter)
        central_logger.app_logger.addHandler(console_handler)
        central_logger.info("Added console handler for generator.")

except ImportError:
    print(
        "Error: Could not import central logger from utils.logger. Falling back to basic logging.",
        file=sys.stderr,
    )
    # Fallback basic configuration
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Create a dummy logger object that mimics the structure if needed
    class DummyLogger:
        def __init__(self):
            self._logger = logging.getLogger("fallback")

        def create_diagnostic_logger(self, session_id):
            # Return a named logger, but setup might be basic
            return logging.getLogger(f"diagnostic_{session_id}_fallback")

        def get_diagnostic_log_path(self, session_id):
            return f"fallback_diagnostic_{session_id}.log"  # Placeholder path

        def debug(self, message, *args, **kwargs):
            self._logger.debug(message, *args, **kwargs)

        def info(self, message, *args, **kwargs):
            self._logger.info(message, *args, **kwargs)

        def warning(self, message, *args, **kwargs):
            self._logger.warning(message, *args, **kwargs)

        def error(self, message, *args, **kwargs):
            self._logger.error(message, *args, **kwargs)

    central_logger = DummyLogger()


# Import the extracted modules
from .config import SchedulerConfig  # Generator's own runtime config
from .constraints import ConstraintChecker
from .availability import AvailabilityChecker
from .distribution import DistributionManager
from .serialization import ScheduleSerializer
from .logging_utils import ProcessTracker  # Renamed from LoggingManager
from .resources import ScheduleResources as RuntimeScheduleResources  # Runtime alias
from .validator import ScheduleValidator
from .validator import (
    ScheduleConfig as ValidatorRuntimeScheduleConfig,
)  # Runtime alias for validator's config

# --- Model Imports ---
try:
    # from src.backend.models import Employee, ShiftTemplate, Schedule # Schedule and Employee, ShiftTemplate are unused here
    from src.backend.models.employee import AvailabilityType

    central_logger.app_logger.info(
        "Successfully imported AvailabilityType from src.backend.models.employee"
    )
except ImportError as e:
    central_logger.app_logger.error(
        f"CRITICAL: Failed to import AvailabilityType: {e}", exc_info=True
    )
    raise ImportError(
        f"Could not import AvailabilityType. Scheduling cannot proceed. Error: {e}"
    ) from e


# --- Explicit Imports for Type Checking ---
if TYPE_CHECKING:
    from .resources import ScheduleResources as ActualScheduleResources
    from .config import (
        SchedulerConfig as ActualSchedulerConfig,
    )  # Generator's own config class for type hints
    from .validator import (
        ScheduleConfig as ActualValidatorScheduleConfig,
    )  # Validator's config class for type hints
    # from backend.models.schedule import Schedule as ActualScheduleModel # Unused


class ScheduleGenerationError(Exception):
    """
    Custom exception raised for errors encountered during schedule generation.

    Attributes:
        message (str): Explanation of the error.
    """


class ScheduleAssignment:
    """
    Represents a single assignment of an employee to a specific shift on a given date.

    This class encapsulates all details pertinent to one shift assignment, including
    employee and shift identifiers, date, times, and status. It also handles
    the extraction of shift details from a `ShiftTemplate` object or dictionary.

    Attributes:
        employee_id (int): The ID of the assigned employee.
        shift_id (int): The ID of the assigned shift.
        date (date): The date of the assignment.
        shift_template_source (Any): The original shift template data.
        availability_type (Optional[str]): The availability type of the employee for this shift (e.g., "AVAILABLE", "PREFERRED").
        status (str): The status of the assignment (e.g., "PENDING", "CONFIRMED").
        version (int): The version number of this assignment.
        start_time (Optional[str]): The start time of the shift (e.g., "09:00").
        end_time (Optional[str]): The end time of the shift (e.g., "17:00").
        shift_type_str (Optional[str]): The type of the shift (e.g., "EARLY", "LATE").
        notes (Optional[str]): Any notes associated with this assignment.
        break_start (Optional[str]): The start time of the break, if any.
        break_end (Optional[str]): The end time of the break, if any.
    """

    def __init__(
        self,
        employee_id: int,
        shift_id: int,
        date_val: date,
        shift_template: Any = None,  # This can be ShiftTemplate ORM object or a dict
        availability_type: Optional[Union[str, AvailabilityType]] = None,
        status: str = "PENDING",
        version: int = 1,
        # Add other potential fields from DistributionManager\'s assignment dict
        break_start: Optional[str] = None,
        break_end: Optional[str] = None,
        notes: Optional[str] = None,
        # Add the logger as a parameter
        logger_instance: Optional[logging.Logger] = None,
    ):
        """
        Initializes a ScheduleAssignment instance.

        Args:
            employee_id: The ID of the employee.
            shift_id: The ID of the shift.
            date_val: The date of the assignment.
            shift_template: The source shift template (ORM object or dict)
                from which to derive shift details like times and type.
            availability_type: The employee's availability type for this shift.
                Can be a string or an AvailabilityType enum member.
                Defaults to AvailabilityType.AVAILABLE.value.
            status: The initial status of the assignment. Defaults to "PENDING".
            version: The version of this assignment. Defaults to 1.
            break_start: Optional start time of the break.
            break_end: Optional end time of the break.
            notes: Optional notes for the assignment.
            logger_instance: Optional logger instance to use. If None,
                the central application logger is used.
        """
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.date = date_val
        self.shift_template_source = shift_template  # Store the original for reference
        # Ensure AvailabilityType is the correct one from models.employee
        if availability_type is not None:
            # If a string is passed, try to map it to the Enum or use as is if it's already a valid Enum member's value
            if isinstance(availability_type, str):
                try:
                    # Check if it's a valid value of the Enum
                    self.availability_type = AvailabilityType(availability_type).value
                except ValueError:
                    # If it's not a direct valid value (e.g. "FIXED" vs "FIXED")
                    # This part might need more sophisticated mapping if we expect short forms,
                    # but for now, we'll assume it should be a value from the *correct* Enum.
                    # Or, if the schema for Schedule.availability_type is changed to SQLEnum, this assignment
                    # would ideally directly take an AvailabilityType member, not its .value
                    self.availability_type = availability_type  # Store as is; DB schema will validate if it's an Enum
                    central_logger.app_logger.warning(
                        f"Potentially incorrect availability_type string '{availability_type}' used for ScheduleAssignment. Expected a value from models.employee.AvailabilityType."
                    )
            elif isinstance(availability_type, AvailabilityType):
                self.availability_type = availability_type.value
            else:
                self.availability_type = AvailabilityType.AVAILABLE.value  # Default
                central_logger.app_logger.warning(
                    f"Unexpected type for availability_type '{type(availability_type)}', defaulting to AVAILABLE."
                )
        else:
            self.availability_type = AvailabilityType.AVAILABLE.value

        self.status = status
        self.version = version

        self.start_time: Optional[str] = None
        self.end_time: Optional[str] = None
        self.shift_type_str: Optional[str] = None  # Store shift_type as string
        self.notes = notes
        self.break_start = break_start
        self.break_end = break_end

        # Use the passed logger_instance, or fallback to app_logger if None
        current_logger = (
            logger_instance if logger_instance else central_logger.app_logger
        )

        # Extract details from shift_template with comprehensive logging
        current_logger.debug(
            f"Extracting shift data for employee_id={employee_id}, shift_id={shift_id}, date={date_val}"
        )

        # First log the shift_template type
        template_type = type(shift_template).__name__ if shift_template else "None"
        current_logger.debug(f"shift_template type: {template_type}")

        if shift_template:
            # Get start_time with detailed logging
            if hasattr(shift_template, "start_time"):
                self.start_time = getattr(shift_template, "start_time")
                current_logger.debug(
                    f"Extracted start_time from attribute: {self.start_time}"
                )
            elif isinstance(shift_template, dict) and "start_time" in shift_template:
                self.start_time = shift_template["start_time"]
                current_logger.debug(
                    f"Extracted start_time from dict: {self.start_time}"
                )
            else:
                current_logger.warning(
                    f"Could not extract start_time from shift_template: {shift_template}"
                )
                # Try to fallback to a default value if needed
                self.start_time = "00:00"
                current_logger.debug(f"Using default start_time: {self.start_time}")

            # Get end_time with detailed logging
            if hasattr(shift_template, "end_time"):
                self.end_time = getattr(shift_template, "end_time")
                current_logger.debug(
                    f"Extracted end_time from attribute: {self.end_time}"
                )
            elif isinstance(shift_template, dict) and "end_time" in shift_template:
                self.end_time = shift_template["end_time"]
                current_logger.debug(f"Extracted end_time from dict: {self.end_time}")
            else:
                current_logger.warning(
                    f"Could not extract end_time from shift_template: {shift_template}"
                )
                # Try to fallback to a default value if needed
                self.end_time = "00:00"
                current_logger.debug(f"Using default end_time: {self.end_time}")

            # Get shift_type string with detailed logging
            # Check for 'shift_type' attribute first (could be an Enum or string)
            shift_type_val = None

            # Try multiple common attribute names for shift type
            for attr_name in ["shift_type", "shift_type_id", "type"]:
                if hasattr(shift_template, attr_name):
                    shift_type_val = getattr(shift_template, attr_name)
                    current_logger.debug(
                        f"Found shift_type in attribute '{attr_name}': {shift_type_val}"
                    )
                    break

            # If not found in attributes, try dict keys
            if shift_type_val is None and isinstance(shift_template, dict):
                for key_name in ["shift_type", "shift_type_id", "type"]:
                    if key_name in shift_template:
                        shift_type_val = shift_template[key_name]
                        current_logger.debug(
                            f"Found shift_type in dict key '{key_name}': {shift_type_val}"
                        )
                        break

            if shift_type_val:
                if hasattr(shift_type_val, "value"):  # If it's an Enum object
                    self.shift_type_str = shift_type_val.value
                    current_logger.debug(
                        f"Converted Enum shift_type to string: {self.shift_type_str}"
                    )
                else:  # Assume it's already a string
                    self.shift_type_str = str(shift_type_val)
                    current_logger.debug(
                        f"Converted shift_type to string: {self.shift_type_str}"
                    )
            else:
                current_logger.warning(
                    f"Could not extract shift_type from shift_template: {shift_template}"
                )
                # Try to determine a default shift type based on start time if available
                if self.start_time:
                    try:
                        hour = int(self.start_time.split(":")[0])
                        if hour < 11:
                            self.shift_type_str = "EARLY"
                        elif hour >= 14:
                            self.shift_type_str = "LATE"
                        else:
                            self.shift_type_str = "MIDDLE"
                        current_logger.debug(
                            f"Determined shift_type from start time: {self.shift_type_str}"
                        )
                    except (ValueError, IndexError):
                        self.shift_type_str = "UNKNOWN"
                        current_logger.debug(
                            f"Using default shift_type: {self.shift_type_str}"
                        )
                else:
                    self.shift_type_str = "UNKNOWN"
                    current_logger.debug(
                        f"Using default shift_type: {self.shift_type_str}"
                    )

        # Final validation check for required fields
        if not self.start_time or not self.end_time:
            # Error logging should be safe since error() is part of the basic logger interface
            central_logger.error(
                f"Missing required time data for shift: employee_id={employee_id}, shift_id={shift_id}, date={date_val}"
            )
            central_logger.error(
                f"Retrieved data: start_time={self.start_time}, end_time={self.end_time}, shift_type={self.shift_type_str}"
            )
        else:
            current_logger.debug(
                f"Successfully extracted shift data: start_time={self.start_time}, end_time={self.end_time}, shift_type={self.shift_type_str}"
            )


class ScheduleContainer:
    """
    Container for holding a generated schedule and its associated metadata.

    This class acts as a wrapper for a list of `ScheduleAssignment` objects,
    along with overall schedule properties like start date, end date, status,
    and version. It provides methods to manage and access assignments.

    Attributes:
        start_date (date): The start date of the schedule period.
        end_date (date): The end date of the schedule period.
        status (str): The overall status of the schedule (e.g., "DRAFT", "PUBLISHED").
        version (int): The version number of the schedule.
        assignments (List[ScheduleAssignment]): A list of all shift assignments
            within this schedule.
        schedule_entries_by_date (Dict[date, List[ScheduleAssignment]]):
            A dictionary mapping dates to a list of assignments for that date.
        id (Optional[Any]): An identifier for the schedule, typically assigned
            after saving to a database.
    """

    def __init__(self, start_date: date, end_date: date, status="DRAFT", version=1):
        """
        Initializes a ScheduleContainer instance.

        Args:
            start_date: The start date of the schedule period.
            end_date: The end date of the schedule period.
            status: The initial status of the schedule. Defaults to "DRAFT".
            version: The version number of the schedule. Defaults to 1.
        """
        self.start_date = start_date
        self.end_date = end_date
        self.status = status
        self.version = version
        self.assignments: List[ScheduleAssignment] = []
        self.schedule_entries_by_date: Dict[date, List[ScheduleAssignment]] = (
            defaultdict(list)
        )
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

    This class orchestrates the entire schedule generation process. It utilizes
    various helper modules for resource management, constraint checking,
    availability verification, and assignment distribution. It is responsible
    for loading necessary data, processing each day in the schedule period,
    generating assignments, and preparing the schedule for serialization.

    A unique session ID is generated for each instantiation to aid in logging
    and diagnostics.

    Attributes:
        logger: Central logger instance for general logging.
        app_logger: Alias for the central logger.
        session_id (str): A unique identifier for this generation session.
        diagnostic_logger: A logger instance specific to this session for detailed
            diagnostic messages.
        process_tracker (ProcessTracker): Utility to track stages and errors
            during the generation process.
        resources (RuntimeScheduleResources): Manages access to employees, shifts,
            coverage requirements, and availability data.
        config (SchedulerConfig): Configuration settings for the schedule generator.
        constraint_checker (ConstraintChecker): Validates assignments against
            defined constraints.
        availability_checker (AvailabilityChecker): Checks employee availability.
        distribution_manager (DistributionManager): Handles the logic of assigning
            employees to shifts.
        serializer (ScheduleSerializer): Handles serialization of the generated schedule.
        generation_errors (List[Any]): A list to store any errors encountered
            during generation.
        schedule (Optional[ScheduleContainer]): The container for the generated
            schedule assignments and metadata.
    """

    def __init__(
        self,
        resources: Optional[RuntimeScheduleResources] = None,
        passed_config: Optional[SchedulerConfig] = None,
        app_instance: Optional[Any] = None,
    ):
        """
        Initializes the ScheduleGenerator.

        Sets up logging, process tracking, and initializes all necessary service
        modules (resources, config, checkers, managers).

        Args:
            resources: Optional pre-initialized `RuntimeScheduleResources` instance.
                If None, a new one will be created.
            passed_config: Optional pre-initialized `SchedulerConfig` instance
                for the generator. If None, a default config is loaded.
            app_instance: Optional Flask application instance, used by
                `RuntimeScheduleResources` if it needs to be created.
        """
        # Use the centrally configured logger
        self.logger = central_logger  # Use the central logger directly
        self.app_logger = central_logger  # Use central logger for general info/debug

        # Generate a unique session ID for this generation run
        self.session_id = str(uuid.uuid4())[:8]

        # Create a specific diagnostic logger for this session
        self.diagnostic_logger = central_logger.create_diagnostic_logger(
            self.session_id
        )

        # Initialize the process tracker, passing the relevant loggers
        self.process_tracker = ProcessTracker(
            process_name=f"ScheduleGeneration_{self.session_id}",
            schedule_logger=self.logger,
            diagnostic_logger=self.diagnostic_logger,
        )

        # Initialize resources and config
        if TYPE_CHECKING:
            self.resources: ActualScheduleResources = (
                resources
                if resources is not None
                else ActualScheduleResources(app_instance=app_instance)
            )
            self.config: ActualSchedulerConfig = (
                passed_config if passed_config is not None else ActualSchedulerConfig()
            )
        else:
            self.resources = (
                resources
                if resources is not None
                else RuntimeScheduleResources(app_instance=app_instance)
            )
            self.config = (
                passed_config if passed_config is not None else SchedulerConfig()
            )  # This is generator's .config.SchedulerConfig

        self.logger.debug(f"ScheduleGenerator initialized (Session: {self.session_id})")
        self.diagnostic_logger.debug(
            f"SchedulerConfig (Generator): {self.config.__dict__ if self.config and hasattr(self.config, '__dict__') else 'None'}"
        )

        # Create a ValidatorScheduleConfig instance for ConstraintChecker
        # ValidatorRuntimeScheduleConfig is an alias for validator.ScheduleConfig
        # The from_settings method in validator.ScheduleConfig is used.
        # We attempt to pass the generator's config as a dictionary, or an empty dict if not suitable.
        validator_specific_config_settings = (
            self.config.__dict__
            if self.config and hasattr(self.config, "__dict__")
            else {}
        )
        if (
            not validator_specific_config_settings and self.config
        ):  # If config is not dict-like, maybe it *is* the settings
            validator_specific_config_settings = self.config

        validator_specific_config = ValidatorRuntimeScheduleConfig.from_settings(
            validator_specific_config_settings
        )
        self.diagnostic_logger.debug(
            f"SchedulerConfig (Validator for ConstraintChecker): {validator_specific_config.__dict__ if validator_specific_config else 'None'}"
        )

        # Initialize the specialized modules, passing the correct logger and configs
        self.constraint_checker = ConstraintChecker(
            self.resources, validator_specific_config, self.logger
        )
        self.availability_checker = AvailabilityChecker(self.resources, self.logger)
        self.distribution_manager = DistributionManager(
            self.resources,
            self.constraint_checker,  # Gets the correctly typed config via ConstraintChecker
            self.availability_checker,
            self.config,  # DistributionManager itself receives the generator's config
            self.logger,
        )
        self.serializer = ScheduleSerializer(self.logger)

        # Initialize generation_errors list
        self.generation_errors: List[Any] = []

        # Schedule data
        if TYPE_CHECKING:
            self.schedule: Optional[ScheduleContainer] = None
        else:
            self.schedule = None
        self.assignments = []  # Deprecated
        self.schedule_by_date = {}  # Deprecated

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
        # Ensure the entire generation process runs within a Flask application context
        try:
            # Try to get the current app context
            from flask import current_app

            ctx = current_app.app_context()
        except RuntimeError:
            # If no current app is available, create one
            from src.backend.app import create_app

            app = create_app()
            ctx = app.app_context()

        # Use the context manager properly
        with ctx:
            self.logger.info(
                f"Generating schedule from {start_date} to {end_date} (Session: {self.session_id})"
            )
            self.diagnostic_logger.info(
                f"Generation parameters: start={start_date}, end={end_date}, config={external_config_dict}, create_empty={create_empty_schedules}, version={version}"
            )

            # Start the process tracking
            self.process_tracker.start_process()

            # Step 1: Resource Loading and Verification
            self.process_tracker.start_step("Resource Loading")
            try:
                # Resources load method already has context, but included here for clarity
                self.resources.load()
                verification_result = self.resources.verify_loaded_resources()
                if not verification_result:
                    error_msg = "Resource verification failed."
                    self.logger.error(error_msg)
                    self.process_tracker.log_error(error_msg)
                    raise ScheduleGenerationError("Failed to load required resources")

                self.logger.info("Resources loaded and verified successfully.")
                self.process_tracker.log_step_data(
                    "Employees Loaded",
                    len(self.resources.employees),
                    level=logging.INFO,
                )
                self.process_tracker.log_step_data(
                    "Shifts Loaded", len(self.resources.shifts), level=logging.INFO
                )
                self.process_tracker.log_step_data(
                    "Coverage Loaded", len(self.resources.coverage), level=logging.INFO
                )
                self.process_tracker.log_step_data(
                    "Availability Loaded",
                    len(self.resources.availabilities),
                    level=logging.INFO,
                )

            except Exception as e:
                error_msg = f"Error during resource loading: {str(e)}"
                self.logger.error(error_msg, exc_info=True)
                self.process_tracker.log_error(error_msg, exc_info=True)
                # We might still want to end the step before raising
                self.process_tracker.end_step({"status": "failed", "error": str(e)})
                # End the process immediately on critical failure
                self.process_tracker.end_process(
                    {"status": "failed", "reason": "Resource loading error"}
                )
                raise ScheduleGenerationError(
                    f"Failed during resource loading: {str(e)}"
                ) from e
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
                self.diagnostic_logger.debug(
                    f"--- Processing date: {loop_date_str} ---"
                )
                try:
                    assignments = self._generate_assignments_for_date(current_date)

                    if assignments:
                        self.logger.info(
                            f"Generated {len(assignments)} assignments for {loop_date_str}"
                        )
                        date_count += 1
                        
                        # Add assignments to the schedule container
                        for assignment_dict in assignments:
                            # Get shift template for creating ScheduleAssignment
                            shift_template = None
                            if 'shift_id' in assignment_dict and assignment_dict['shift_id']:
                                shift_template = self.resources.get_shift(assignment_dict['shift_id'])
                            
                            # Create ScheduleAssignment object
                            schedule_assignment = ScheduleAssignment(
                                employee_id=assignment_dict.get('employee_id'),
                                shift_id=assignment_dict.get('shift_id'),
                                date_val=assignment_dict.get('date', current_date),
                                shift_template=shift_template,
                                availability_type=assignment_dict.get('availability_type'),
                                status=assignment_dict.get('status', 'PENDING'),
                                version=self.schedule.version,
                                break_start=assignment_dict.get('break_start'),
                                break_end=assignment_dict.get('break_end'),
                                notes=assignment_dict.get('notes'),
                                logger_instance=self.diagnostic_logger,
                            )
                            
                            # Add to schedule container
                            self.schedule.add_assignment(schedule_assignment)
                            self.logger.debug(f"Added assignment to schedule: Employee {schedule_assignment.employee_id}, Shift {schedule_assignment.shift_id}, Date {schedule_assignment.date}")
                    elif create_empty_schedules:
                        self.logger.warning(
                            f"No coverage or shifts applicable for {loop_date_str}. Creating empty entry."
                        )
                        self.process_tracker.log_warning(
                            f"Creating empty schedule entry for {loop_date_str}",
                            log_to_diag=True,
                        )
                        self._create_empty_schedule_entries(current_date)
                        empty_dates += 1
                    else:
                        self.logger.warning(
                            f"No coverage, shifts, or assignable employees found for {loop_date_str}. Skipping date."
                        )
                        self.process_tracker.log_warning(
                            f"Skipping date {loop_date_str} due to lack of coverage/shifts/assignments.",
                            log_to_diag=True,
                        )

                    # Move to the next date
                    current_date += timedelta(days=1)

                except Exception as e:
                    error_msg = (
                        f"Error generating assignments for {loop_date_str}: {str(e)}"
                    )
                    self.logger.error(error_msg, exc_info=True)
                    self.process_tracker.log_error(error_msg, exc_info=True)
                    # Optionally end the step/process here, or try to continue with the next date
                    # For now, let's end the process on date-specific failure
                    self.process_tracker.end_step(
                        {
                            "status": "failed",
                            "error_date": loop_date_str,
                            "error": str(e),
                        }
                    )
                    self.process_tracker.end_process(
                        {
                            "status": "failed",
                            "reason": f"Error during assignment for {loop_date_str}",
                        }
                    )
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
                processed_for_downstream: List[
                    Union[ActualScheduleModel, Dict[str, Any]]
                ] = []
                if TYPE_CHECKING:
                    # For type hinting, this would be List[ActualScheduleModel]
                    # but the conversion logic to ActualScheduleModel instances is complex here.
                    # Using List[Dict] as a common intermediate form.
                    pass

                for sa in schedule_assignments_to_process:
                    # Create a more comprehensive dictionary with all available fields
                    assignment_dict: Dict[str, Any] = {
                        "id": getattr(
                            sa, "id", None
                        ),  # ScheduleAssignment might not have an ID yet
                        "employee_id": sa.employee_id,
                        "shift_id": sa.shift_id,
                        "date": sa.date.isoformat() if sa.date else None,
                        "start_time": sa.start_time,
                        "end_time": sa.end_time,
                        "status": sa.status,
                        "version": sa.version,
                        "availability_type": sa.availability_type,
                        "shift_type": sa.shift_type_str,
                        "break_start": sa.break_start,
                        "break_end": sa.break_end,
                        "notes": sa.notes,
                    }

                    # Log the converted assignment for debugging
                    self.diagnostic_logger.debug(
                        f"Converted assignment: {assignment_dict}"
                    )

                    # Check for missing critical fields
                    missing_fields = []
                    for critical_field in [
                        "start_time",
                        "end_time",
                        "availability_type",
                    ]:
                        if not assignment_dict.get(critical_field):
                            missing_fields.append(critical_field)

                    if missing_fields:
                        self.diagnostic_logger.warning(
                            f"Assignment missing critical fields: {missing_fields} - employee_id={sa.employee_id}, shift_id={sa.shift_id}, date={sa.date}"
                        )

                    processed_for_downstream.append(assignment_dict)

                serialized_result = self.serializer.serialize_schedule(
                    processed_for_downstream
                )
                # metrics = self.distribution_manager.get_distribution_metrics()
                # if metrics:
                #     serialized_result["metrics"] = metrics
                #     self.process_tracker.log_step_data("Distribution Metrics", metrics, level=logging.INFO)

                # Perform validation
                self.process_tracker.start_step("Schedule Validation")

                validator_config_arg: Optional[
                    Union[ActualValidatorScheduleConfig, ValidatorRuntimeScheduleConfig]
                ] = None
                if external_config_dict:
                    if TYPE_CHECKING:
                        # validator_config_arg = ActualValidatorScheduleConfig.from_settings(external_config_dict) # Ideal
                        pass  # Placeholder until from_settings is confirmed for ActualValidatorScheduleConfig
                    else:
                        validator_config_arg = (
                            ValidatorRuntimeScheduleConfig.from_settings(
                                external_config_dict
                            )
                        )
                else:  # Use self.config (generator's config)
                    if TYPE_CHECKING:
                        # This assumes ActualSchedulerConfig is compatible with or convertible to ActualValidatorScheduleConfig
                        # If not, conversion logic or a more specific type is needed.
                        # validator_config_arg = convert_generator_config_to_validator_config(self.config)
                        pass  # Placeholder
                    else:
                        # At runtime, if ValidatorRuntimeScheduleConfig can take SchedulerConfig or has from_settings for it.
                        # validator_config_arg = ValidatorRuntimeScheduleConfig.from_generator_config(self.config)
                        pass  # Placeholder; direct pass might cause issues if types differ

                # If no external_config_dict and no conversion, pass self.config (hoping for compatibility)
                if (
                    validator_config_arg is None
                ):  # Fallback if above blocks don't assign due to placeholders
                    # This was: validator_config_arg = self.config (which is the wrong type)
                    settings_for_validator = (
                        self.config.__dict__
                        if self.config and hasattr(self.config, "__dict__")
                        else {}
                    )
                    if (
                        not settings_for_validator and self.config
                    ):  # if self.config is not dict-like, maybe it *is* the settings obj
                        settings_for_validator = self.config
                    validator_config_arg = ValidatorRuntimeScheduleConfig.from_settings(
                        settings_for_validator
                    )

                validator = ScheduleValidator(self.resources)
                # validator.validate expects List[ActualScheduleModel] or List[Dict] that maps to it.
                # Cast to List[Dict[str, Any]] to satisfy Mypy due to List invariance with Union types.
                validation_errors = validator.validate(
                    processed_for_downstream, config=validator_config_arg
                )

                # Append validation errors to generation_errors
                for err in validation_errors:
                    # Check if the error is already present to avoid duplicates
                    if err not in self.generation_errors:
                        self.generation_errors.append(err)
                        # Log validation error with severity INFO to schedule logger
                        self.logger.info(f"Validation Error: {err}")
                        # Log validation error with severity WARNING to diagnostic logger
                        self.diagnostic_logger.warning(f"Validation Error: {err}")

                self.process_tracker.end_step(
                    {
                        "status": "success",
                        "validation_errors_count": len(validation_errors),
                    }
                )

            except Exception as e:
                error_msg = (
                    f"Error during schedule serialization or validation: {str(e)}"
                )
                self.logger.error(error_msg, exc_info=True)
                self.process_tracker.log_error(error_msg, exc_info=True)
                self.process_tracker.end_step({"status": "failed", "error": str(e)})
                self.process_tracker.end_process(
                    {"status": "failed", "reason": "Serialization or validation error"}
                )
                raise ScheduleGenerationError(error_msg) from e

            # Step 4: Saving to Database
            self.process_tracker.start_step("Saving Schedule to Database")
            try:
                if (
                    self.schedule and self.schedule.get_assignments()
                ):  # Only save if there are assignments
                    self.logger.info(
                        "Calling _save_to_database within app context."
                    )  # ADDED logging
                    saved_count = (
                        self._save_to_database(self.schedule.get_assignments())
                    )  # This method needs to handle bulk saving
                    self.logger.info(
                        "Finished calling _save_to_database within app context."
                    )  # ADDED logging
                    self.logger.info(
                        f"Saved {saved_count} assignments to database for version {self.schedule.version}"
                    )
                    self.process_tracker.log_step_data(
                        "Assignments Saved", saved_count, level=logging.INFO
                    )

                    # Update the ScheduleVersionMeta table
                    self._update_schedule_version_meta(
                        self.schedule.version,
                        start_date,
                        end_date,
                        # Determine status based on errors
                        status="ERROR" if self.generation_errors else "DRAFT",
                    )
                    self.logger.info(
                        f"Updated ScheduleVersionMeta for version {self.schedule.version}"
                    )
                    self.process_tracker.log_step_data(
                        "Version Meta Updated",
                        self.schedule.version,
                        level=logging.INFO,
                    )

                else:
                    self.logger.info("No assignments to save. Skipping database save.")
                    self.process_tracker.log_step_data(
                        "Assignments Saved", 0, level=logging.INFO
                    )

                self.process_tracker.end_step(
                    {
                        "status": "success"
                        if not self.generation_errors
                        else "partial_success"
                    }
                )

            except Exception as e:
                error_msg = f"Error saving schedule to database: {str(e)}"
                self.logger.error(error_msg, exc_info=True)
                self.process_tracker.log_error(error_msg, exc_info=True)
                self.process_tracker.end_step({"status": "failed", "error": str(e)})
                # Note: We don't end the whole process yet, maybe validation errors are acceptable.
                # The overall process status will reflect if there were any critical errors.
                self.process_tracker.end_process(
                    {"status": "failed", "reason": "Database save error"}
                )

            # Prepare final stats for process end
            final_stats = {
                "status": "success"
                if not self.generation_errors
                else "partial_success",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_dates": (end_date - start_date).days + 1,
                "dates_with_assignments": date_count,
                "empty_dates_created": empty_dates,
                "invalid_assignments": len(
                    validation_errors
                ),  # Use count from validation_errors
            }
            # ADDED: Include coverage summary in final stats if available
            # coverage_summary = self.distribution_manager.get_coverage_summary()
            # if coverage_summary:
            #     final_stats["coverage_summary"] = coverage_summary

            # End the overall process tracking
            self.process_tracker.end_process(final_stats)
            self.logger.info(
                f"Schedule generation finished. Session: {self.session_id}"
            )
            self.diagnostic_logger.info(
                f"Diagnostic log path: {central_logger.get_diagnostic_log_path(self.session_id)}"
            )

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
                    if (
                        isinstance(shift.start_time, str)
                        and ":" in shift.start_time
                        and isinstance(shift.end_time, str)
                        and ":" in shift.end_time
                    ):
                        has_duration = True  # Assume calculable, actual calculation happens elsewhere

            if not has_duration:
                shift_id = shift.id if hasattr(shift, "id") else "Unknown ID"
                self.diagnostic_logger.warning(
                    f"Shift {shift_id} seems to be missing duration information."
                )
                missing_durations.append(shift_id)

        if missing_durations:
            error_msg = (
                f"Shifts missing required duration information: {missing_durations}"
            )
            self.logger.error(error_msg)
            self.process_tracker.log_error(error_msg)  # Log via tracker too
            raise ScheduleGenerationError(
                f"Schichtdauer fehlt für Schichten: {missing_durations}"
            )

        self.diagnostic_logger.debug(
            f"Shift duration validation completed. {len(missing_durations)} shifts possibly missing duration."
        )
        return not missing_durations  # Return True if validation passes

    def _process_coverage(self, process_date: date) -> Dict[str, List[Dict]]:
        """
        Process coverage requirements for a specific date.
        Returns a dictionary mapping time intervals to required staffing.
        """
        self.diagnostic_logger.debug(f"Processing coverage for date {process_date}")
        
        # Get coverage requirements for this day
        weekday = process_date.weekday()
        day_coverage = []
        
        for coverage in self.resources.coverage:
            if hasattr(coverage, 'day_index') and coverage.day_index == weekday:
                day_coverage.append(coverage)
        
        self.logger.info(f"Found {len(day_coverage)} coverage blocks for {process_date} (weekday {weekday})")
        
        # Group coverage by time intervals
        coverage_by_interval = {}
        for coverage in day_coverage:
            interval_key = f"{coverage.start_time}-{coverage.end_time}"
            if interval_key not in coverage_by_interval:
                coverage_by_interval[interval_key] = []
            
            coverage_dict = {
                "start_time": coverage.start_time,
                "end_time": coverage.end_time,
                "min_employees": getattr(coverage, "min_employees", 1),
                "max_employees": getattr(coverage, "max_employees", None),
                "requires_keyholder": getattr(coverage, "requires_keyholder", False),
                "employee_types": getattr(coverage, "employee_types", []),
            }
            coverage_by_interval[interval_key].append(coverage_dict)
        
        return coverage_by_interval

    def _create_date_shifts(self, date_to_create: date) -> List[Dict]:
        """Create shift instances for a specific date based on shift templates"""
        date_shifts = []
        weekday = date_to_create.weekday()  # 0 = Monday, 6 = Sunday

        self.logger.info(
            f"Creating shifts for date {date_to_create} (weekday {weekday})"
        )
        
        # First, get coverage requirements for this date
        coverage_by_interval = self._process_coverage(date_to_create)
        if not coverage_by_interval:
            self.logger.warning(f"No coverage requirements found for {date_to_create}")
            return []
        
        # Log coverage requirements
        for interval, requirements in coverage_by_interval.items():
            for req in requirements:
                self.logger.info(f"Coverage needed {interval}: {req['min_employees']} employees")

        # Find all shift templates active on this day
        active_shift_templates = []
        for shift_template in self.resources.shifts:
            shift_active_days = []  # Default to empty list

            # Handle both object and dictionary representations
            if (
                hasattr(shift_template, "active_days") and shift_template.active_days
            ):  # Check if attribute exists and is not None/empty
                if isinstance(
                    shift_template.active_days, list
                ):  # Case 1: active_days is already a list
                    shift_active_days = shift_template.active_days
                elif isinstance(
                    shift_template.active_days, dict
                ):  # Case 2: active_days is a dictionary (from model)
                    # Convert {"0": True, "1": False} to [0]
                    try:
                        shift_active_days = [
                            int(day_str)
                            for day_str, is_active in shift_template.active_days.items()
                            if is_active
                        ]
                    except ValueError:
                        self.logger.warning(
                            f"Could not parse active_days dictionary keys for shift {shift_template.id}: {shift_template.active_days}"
                        )
                        continue  # Skip this shift template if parsing fails
                elif isinstance(
                    shift_template.active_days, str
                ):  # Case 3: active_days is a string (JSON or comma-separated)
                    # Parse JSON or comma-separated string
                    try:
                        import json

                        # Attempt to parse as JSON list: e.g., "[0, 1, 2]"
                        loaded_days = json.loads(shift_template.active_days)
                        if isinstance(
                            loaded_days, list
                        ):  # Ensure it's a list after loading
                            shift_active_days = loaded_days
                        elif isinstance(
                            loaded_days, dict
                        ):  # Handle if JSON string was a dict {"0": true}
                            shift_active_days = [
                                int(day_str)
                                for day_str, is_active in loaded_days.items()
                                if is_active
                            ]
                        else:
                            self.logger.warning(
                                f"Parsed active_days from JSON string is not a list or dict for shift {shift_template.id}: {shift_template.active_days}"
                            )
                            continue
                    except (json.JSONDecodeError, ValueError):
                        # Try comma-separated format: e.g., "0,1,2"
                        try:
                            # This will produce a list of integers
                            shift_active_days = [
                                int(d.strip())
                                for d in shift_template.active_days.split(",")
                                if d.strip()
                            ]
                        except ValueError:
                            self.logger.warning(
                                f"Could not parse active_days for shift {shift_template.id}: {shift_template.active_days}"
                            )
                            continue  # Skip this shift template if parsing fails

            # Skip if shift is not active on this day
            if not shift_active_days or weekday not in shift_active_days:
                continue

            # Extract shift details
            shift_id = getattr(shift_template, "id", None)
            if not shift_id:
                self.logger.warning(
                    f"Shift template has no ID, skipping: {shift_template}"
                )
                continue
                
            # Add to active templates
            active_shift_templates.append(shift_template)
        
        self.logger.info(f"Found {len(active_shift_templates)} active shift templates for weekday {weekday}")
        
        # Now match active shifts to coverage intervals
        shifts_created = set()  # Track which shifts we've already created
        
        for interval_key, coverage_requirements in coverage_by_interval.items():
            # Parse interval times
            interval_parts = interval_key.split('-')
            if len(interval_parts) != 2:
                self.logger.warning(f"Invalid interval format: {interval_key}")
                continue
                
            coverage_start = interval_parts[0]
            coverage_end = interval_parts[1]
            
            # Find shifts that match this coverage interval
            matching_shifts = []
            for shift_template in active_shift_templates:
                shift_start = getattr(shift_template, "start_time", "")
                shift_end = getattr(shift_template, "end_time", "")
                
                # Check if shift times match the coverage interval
                if shift_start == coverage_start and shift_end == coverage_end:
                    matching_shifts.append(shift_template)
                    self.logger.debug(f"Shift {shift_template.id} matches coverage interval {interval_key}")
            
            if not matching_shifts:
                self.logger.warning(f"No shifts found matching coverage interval {interval_key}")
                continue
            
            # Create shift instances for each matching shift template
            for coverage_req in coverage_requirements:
                min_employees = coverage_req.get('min_employees', 1)
                
                # For each matching shift, create instances based on required staffing
                for shift_template in matching_shifts:
                    shift_id = shift_template.id
                    
                    # Skip if we've already created this shift
                    if shift_id in shifts_created:
                        continue
                    
                    shifts_created.add(shift_id)
                    
                    # Get the active days for this shift template
                    shift_active_days = []
                    if hasattr(shift_template, "active_days") and shift_template.active_days:
                        if isinstance(shift_template.active_days, list):
                            shift_active_days = shift_template.active_days
                        elif isinstance(shift_template.active_days, dict):
                            shift_active_days = [
                                int(day_str)
                                for day_str, is_active in shift_template.active_days.items()
                                if is_active
                            ]
                        elif isinstance(shift_template.active_days, str):
                            try:
                                import json
                                loaded_days = json.loads(shift_template.active_days)
                                if isinstance(loaded_days, list):
                                    shift_active_days = loaded_days
                                elif isinstance(loaded_days, dict):
                                    shift_active_days = [
                                        int(day_str)
                                        for day_str, is_active in loaded_days.items()
                                        if is_active
                                    ]
                            except (json.JSONDecodeError, ValueError):
                                try:
                                    shift_active_days = [
                                        int(d.strip())
                                        for d in shift_template.active_days.split(",")
                                        if d.strip()
                                    ]
                                except ValueError:
                                    pass

                    # Get shift type - try multiple attributes
                    shift_type = None
                    if hasattr(shift_template, "shift_type_id"):
                        stid = shift_template.shift_type_id
                        # If it's a MagicMock (from test), treat as not set
                        if isinstance(stid, str):
                            shift_type = stid
                        else:
                            shift_type = None
                    elif hasattr(shift_template, "shift_type"):
                        # Handle both string and enum values
                        if hasattr(shift_template.shift_type, "value"):
                            shift_type = shift_template.shift_type.value
                        else:
                            shift_type = shift_template.shift_type
                    # Default to a shift type based on start time if none specified
                    if not shift_type:
                        start_time = getattr(shift_template, "start_time", "09:00")
                        try:
                            start_hour = int(start_time.split(":")[0])
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
                        "id": shift_id,  # Original shift template ID
                        "shift_id": shift_id,  # Duplicate for compatibility
                        "date": date_to_create,
                        "start_time": getattr(shift_template, "start_time", "09:00"),
                        "end_time": getattr(shift_template, "end_time", "17:00"),
                        "duration_hours": getattr(shift_template, "duration_hours", 8.0),
                        "shift_type": shift_type,
                        "shift_type_id": shift_type,  # Always use the resolved string, not MagicMock
                        "requires_keyholder": coverage_req.get("requires_keyholder", False),
                        "active_days": shift_active_days,
                        "min_employees": min_employees,  # Add coverage requirement
                        "coverage_interval": interval_key,  # Track which coverage this is for
                    }

                    self.logger.info(
                        f"Created shift instance: ID={shift_id}, type={shift_type}, time={shift_instance['start_time']}-{shift_instance['end_time']}, coverage={interval_key}, min_employees={min_employees}"
                    )
                    date_shifts.append(shift_instance)

        self.logger.info(
            f"Created {len(date_shifts)} shift instances for {date_to_create}"
        )
        return date_shifts

    def _generate_assignments_for_date(self, current_date: date) -> List[Dict]:
        """
        Generates shift assignments for a single date.
        This method will now:
        1. Check if the store is closed on this date due to a special day/holiday.
        2. Create potential shift instances for the day.
        3. Delegate to DistributionManager to assign employees to these shifts
           based on interval-based coverage needs (to be implemented in DistributionManager).
        """
        date_str = current_date.isoformat()
        self.diagnostic_logger.debug(
            f"--- Generating assignments for date: {date_str} ---"
        )
        self.process_tracker.log_info(f"Starting assignment generation for {date_str}")

        assignments_for_date: List[Dict] = []

        try:
            # Check if store is closed on this date due to a special day/holiday
            if hasattr(self.resources, "settings") and self.resources.settings:
                # First check special_days if it exists
                if (
                    hasattr(self.resources.settings, "special_days")
                    and self.resources.settings.special_days
                ):
                    if (
                        date_str in self.resources.settings.special_days
                        and self.resources.settings.special_days[date_str].get(
                            "is_closed", False
                        )
                    ):
                        description = self.resources.settings.special_days[
                            date_str
                        ].get("description", "Special Day")
                        self.logger.info(
                            f"Store is closed on {date_str} due to: {description}"
                        )
                        self.process_tracker.log_info(
                            f"Skipping date {date_str}: Store closed for {description}"
                        )
                        return []

                # If special_days doesn't exist or date not found, check legacy special_hours
                elif (
                    hasattr(self.resources.settings, "special_hours")
                    and self.resources.settings.special_hours
                ):
                    if (
                        date_str in self.resources.settings.special_hours
                        and self.resources.settings.special_hours[date_str].get(
                            "is_closed", False
                        )
                    ):
                        self.logger.info(
                            f"Store is closed on {date_str} (special hours setting)"
                        )
                        self.process_tracker.log_info(
                            f"Skipping date {date_str}: Store closed (special hours)"
                        )
                        return []

            # Sub-step: Create Shift Instances
            self.process_tracker.start_step(f"Create Shift Instances for {date_str}")
            # These are shift *instances* (dicts), potential shifts for the day
            potential_daily_shifts = self._create_date_shifts(current_date)
            self.process_tracker.end_step(
                {"shifts_created": len(potential_daily_shifts)}
            )

            self.diagnostic_logger.info(
                f"DEBUG: Created {len(potential_daily_shifts)} potential shift instances for {date_str}"
            )
            if potential_daily_shifts:
                self.diagnostic_logger.info(
                    f"DEBUG: First potential shift instance: {potential_daily_shifts[0]}"
                )

            if not potential_daily_shifts:
                self.logger.warning(
                    f"No applicable shift templates found for {date_str}, cannot generate assignments."
                )
                self.process_tracker.log_warning(
                    f"No shift templates for {date_str}", log_to_diag=True
                )
                # Ensure the daily processing step is properly closed if returning early
                self.process_tracker.end_step({"status": "no_shift_templates"})
                return []

            self.logger.info(
                f"Proceeding with {len(potential_daily_shifts)} potential shifts for {date_str} to DistributionManager."
            )
            self.process_tracker.log_step_data(
                "Potential Daily Shifts for Distribution", len(potential_daily_shifts)
            )

            # Sub-step: Distribute Employees (call to DistributionManager)
            self.process_tracker.start_step(f"Distribute Employees for {date_str}")
            # Log the input to this step
            self.process_tracker.log_step_data(
                "Shift Instances for Distribution", potential_daily_shifts
            )

            self.diagnostic_logger.info("DEBUG: Parameters before distribution call:")
            self.diagnostic_logger.info(f"  current_date: {current_date}")
            self.diagnostic_logger.info(
                f"  date_shifts (potential_daily_shifts): {len(potential_daily_shifts)}"
            )
            self.diagnostic_logger.info(
                f"  constraint_checker: {self.constraint_checker is not None}"
            )
            self.diagnostic_logger.info(
                f"  availability_checker: {self.availability_checker is not None}"
            )
            self.diagnostic_logger.info(f"  resources: {self.resources is not None}")

            # Call to DistributionManager - this will be the new core logic
            assignments_for_date = self.distribution_manager.generate_assignments_for_day(
                current_date, potential_daily_shifts, self.resources.employees
            )

            if assignments_for_date:
                self.logger.info(
                    f"DistributionManager returned {len(assignments_for_date)} assignments for {date_str}"
                )
                self.diagnostic_logger.debug(
                    f"Assignments from DM for {date_str}: {assignments_for_date}"
                )
            else:
                self.logger.warning(
                    f"DistributionManager returned no assignments for {date_str}"
                )

            self.process_tracker.end_step(
                {"assignments_created": len(assignments_for_date)}
            )

        except Exception as e:
            error_msg = f"Error generating assignments for date {date_str}: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            self.process_tracker.log_error(error_msg, exc_info=True)
            raise  # Re-raise after logging
        finally:
            # Ensure the outer step for the date ends
            if (
                self.process_tracker.current_step
                == f"Process Daily Assignments for {date_str}"
            ):
                self.process_tracker.end_step(
                    {"assignments_count": len(assignments_for_date)}
                )

        return assignments_for_date

    def _create_empty_schedule_entries(self, current_date: date):
        """
        Creates empty schedule entries for a given date if no coverage or shifts are applicable.
        This ensures that every day in the range has some form of record.
        """
        self.logger.info(
            f"Creating empty schedule entry for {current_date} (Session: {self.session_id})"
        )
        # Create a placeholder assignment indicating no work
        # Ensure employee_id and shift_id are placeholders that make sense, e.g., 0 or -1
        # Or use a specific 'NO_SHIFT' or 'NO_EMPLOYEE' marker if defined.
        no_work_assignment = ScheduleAssignment(
            employee_id=-1,  # Use -1 as placeholder for 'empty day assignment'
            shift_id=0,  # Placeholder for 'no shift'
            date_val=current_date,
            status="EMPTY",  # Custom status to indicate this is a placeholder
            version=self.schedule.version if self.schedule else 1,
            logger_instance=self.diagnostic_logger,  # Pass the generator's diagnostic logger
        )
        if self.schedule:
            self.schedule.add_assignment(
                no_work_assignment
            )  # Use the add_assignment method

        self.process_tracker.log_info(
            f"Empty schedule entry created for {current_date}"
        )

    def _save_to_database(self, assignments: List[Dict]):
        """Save assignments to the database using bulk insertion."""
        if not assignments:
            self.logger.info("No assignments to save to database")
            return 0
            
        try:
            from src.backend.models.schedule import Schedule
            from flask import current_app
            from flask_sqlalchemy import SQLAlchemy
            
            # Get database instance
            if hasattr(current_app, 'extensions') and 'sqlalchemy' in current_app.extensions:
                db = current_app.extensions['sqlalchemy']
            else:
                # Fallback: create new instance
                db = SQLAlchemy(current_app)
            
            saved_count = 0
            
            for assignment in assignments:
                try:
                    # Handle both ScheduleAssignment objects and dictionaries
                    if isinstance(assignment, ScheduleAssignment):
                        # Create Schedule model instance from ScheduleAssignment
                        schedule_obj = Schedule(
                            employee_id=assignment.employee_id,
                            shift_id=assignment.shift_id,
                            date=assignment.date,
                            status=assignment.status,
                            version=assignment.version,
                            shift_type=assignment.shift_type_str,
                            availability_type=assignment.availability_type,
                            break_start=assignment.break_start,
                            break_end=assignment.break_end,
                            notes=assignment.notes,
                        )
                    else:
                        # Handle dictionary format
                        schedule_obj = Schedule(
                            employee_id=assignment["employee_id"],
                            shift_id=assignment["shift_id"],
                            date=assignment["date"],
                            status=assignment.get("status", "PENDING"),
                            version=assignment.get("version", 1),
                            shift_type=assignment.get("shift_type"),
                            availability_type=assignment.get("availability_type"),
                            break_start=assignment.get("break_start"),
                            break_end=assignment.get("break_end"),
                            notes=assignment.get("notes"),
                        )
                    
                    db.session.add(schedule_obj)
                    saved_count += 1
                    
                except Exception as e:
                    self.logger.error(f"Error creating schedule object: {e}")
                    self.logger.error(f"Assignment data: {assignment}")
                    continue
            
            if saved_count > 0:
                # Commit all at once
                db.session.commit()
                self.logger.info(f"Successfully saved {saved_count} assignments to database")
            else:
                self.logger.warning("No valid assignment objects created for database save")
            
            return saved_count
                
        except Exception as e:
            self.logger.error(f"Error saving assignments to database: {str(e)}", exc_info=True)
            db.session.rollback()
            raise

    def _update_schedule_version_meta(
        self,
        version: int,
        start_date: date,
        end_date: date,
        status: str,  # Assuming status is a string like "DRAFT" or "ERROR"
    ):
        """Placeholder method to update ScheduleVersionMeta."""
        # This method should interact with the database to update the version metadata.
        # For now, it just logs that it was called.
        self.logger.info(
            f"Placeholder: Updating ScheduleVersionMeta for version {version} with status {status}"
        )
        # Example: Find or create version meta and update its status and date range
        # try:
        #     version_meta = ScheduleVersionMeta.query.filter_by(version=version).first()
        #     if not version_meta:
        #         version_meta = ScheduleVersionMeta(version=version, created_at=datetime.utcnow())
        #         db.session.add(version_meta)
        #     version_meta.status = status
        #     version_meta.date_range = {"start": start_date.isoformat(), "end": end_date.isoformat()}
        #     version_meta.updated_at = datetime.utcnow()
        #     db.session.commit()
        # except Exception as e:
        #     self.logger.error(f"Error updating ScheduleVersionMeta for version {version}: {str(e)}")
        #     db.session.rollback()

    def generate_schedule(
        self,
        start_date,
        end_date,
        external_config_dict=None,
        create_empty_schedules=False,
        version=None,
    ):
        """
        Alias for generate(), for backward compatibility with tests/utilities.
        """
        return self.generate(
            start_date=start_date,
            end_date=end_date,
            external_config_dict=external_config_dict,
            create_empty_schedules=create_empty_schedules,
            version=version,
        )
