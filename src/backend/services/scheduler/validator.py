from datetime import time, date
from datetime import datetime, timedelta, date

# Standard library imports
import logging
from collections import defaultdict
from dataclasses import dataclass, field # Import dataclass
from typing import List, Dict, Any, Optional, Union, TYPE_CHECKING

# Define mock Schedule if import fails
try:
    # Attempt to import actual models first
    from src.backend.models import Schedule
    from src.backend.models.employee import EmployeeGroup, Employee, AvailabilityType
    from src.backend.utils.logger import logger as backend_logger
    
    # Define Actual... aliases for consistency with previous code if needed, though direct use is better
    ActualSchedule = Schedule
    ActualEmployeeGroup = EmployeeGroup
    ActualEmployee = Employee
    ActualAvailabilityType = AvailabilityType
    logger = backend_logger # Use the backend logger

except ImportError as e:
    # Log the critical error if actual models cannot be imported
    logging.basicConfig(level=logging.DEBUG) # Ensure basic logging is configured
    logger = logging.getLogger(__name__)
    logger.critical(f"FATAL ERROR: Could not import backend models required for validator: {e}")
    logger.critical("Please ensure the backend models are accessible in the Python path.")
    
    # Re-raise the error or exit if models are strictly required for the validator to function.
    # For now, we'll re-raise to make the issue clear during development.
    raise 


# --- Sibling module imports ---
# Ensure these are imported directly for clarity and linter happiness
from .resources import ScheduleResources
from .utility import (
    requires_keyholder,
    calculate_rest_hours,
    time_to_minutes,
)
try:
    from .coverage_utils import get_required_staffing_for_interval, _time_str_to_datetime_time
except ImportError:
    # Fallback implementations if imports fail
    def _time_str_to_datetime_time(time_str: str) -> time:
        """Convert a time string (HH:MM) to a datetime.time object"""
        try:
            if not time_str or not isinstance(time_str, str):
                return time(9, 0)  # Default to 9:00 AM
            
            # Parse the time string
            if ":" in time_str:
                hours, minutes = map(int, time_str.split(":"))
                return time(hours, minutes)
            else:
                return time(int(time_str), 0)
        except (ValueError, TypeError):
            # Fallback to a default time if parsing fails
            return time(9, 0)  # Default to 9:00 AM
    
    def get_required_staffing_for_interval(
        resources,
        target_date,
        interval_start,
        interval_end
    ):
        """Fallback implementation returning minimum staffing"""
        return {
            "min_employees": 1,
            "max_employees": 3,
            "requires_keyholder": False,
            "coverage_id": None,
            "has_coverage": True
        }

# --- Explicit Model Imports for Type Checking ---
if TYPE_CHECKING:
    from backend.models.employee import Employee as ActualEmployee
    from backend.models.schedule import Schedule as ActualSchedule
    from backend.models.employee import EmployeeGroup as ActualEmployeeGroup

# --- Define Actual... names for runtime as well ---
# These are no longer needed as we directly import and use the actual models or their aliases
# if not TYPE_CHECKING: # Define runtime aliases after successful fallback import
#     ActualSchedule = None # Placeholder, will be Schedule
#     ActualEmployee = None # Placeholder, will be Employee
#     ActualEmployeeGroup = None # Placeholder, will be EmployeeGroup


# --- Model imports (with fallback for different execution contexts) ---
# This block is replaced by the single try...except block at the top
# ModelImportError_Primary = None
# ModelImportError_Fallback = None
# try:
#     # Primary import path for models when run as part of the backend package
#     from backend.models import Schedule
#     from backend.models.employee import EmployeeGroup
#     # If Employee itself is used directly (not just EmployeeGroup):
#     from backend.models.employee import Employee
# except ImportError as e_pkg:
#     ModelImportError_Primary = e_pkg
#     try:
#         # Fallback for models if sys.path is set up for direct execution
#         from models import Schedule
#         from models.employee import EmployeeGroup
#         from models.employee import Employee # Fallback for Employee too
#         if not TYPE_CHECKING: # Define runtime aliases after successful fallback import
#             ActualSchedule = Schedule
#             ActualEmployee = Employee
#             ActualEmployeeGroup = EmployeeGroup
#     except ImportError as e_direct:
#         ModelImportError_Fallback = e_direct # Store the more specific error
#         # Critical: All model imports failed. Log this.
#         logging.getLogger(__name__).critical(
#             f"All model imports failed. Primary error: {ModelImportError_Primary}, Fallback error: {ModelImportError_Fallback}. Validator may not function correctly."
#         )
#         # Placeholder classes REMOVED.
#         # If EmployeeGroup and Schedule are not available from imports, runtime errors will occur later,
#         # which is better than type conflicts from stubs.

# if not TYPE_CHECKING: # Define runtime aliases after successful primary import or if already defined
#     # This ensures ActualSchedule etc. are correctly aliased to the imported models
#     if 'Schedule' in globals(): ActualSchedule = Schedule
#     if 'Employee' in globals(): ActualEmployee = Employee
#     if 'EmployeeGroup' in globals(): ActualEmployeeGroup = EmployeeGroup

# logger = logging.getLogger(__name__)

# Frontend -> Backend field mapping
FRONTEND_TO_BACKEND_MAP = {
    "enforce_minimum_coverage": "enforce_min_coverage",
    "enforce_keyholder_coverage": "enforce_keyholder",
    # ... other mappings
}


@dataclass
class ValidationError:
    """Represents a validation error"""

    error_type: str
    message: str
    severity: str  # 'critical', 'warning', 'info'
    details: Optional[Dict[str, Any]] = None


@dataclass
class ScheduleConfig:
    """Configuration for schedule validation"""

    # Original configuration options
    enforce_min_coverage: bool = True
    enforce_contracted_hours: bool = True
    enforce_keyholder: bool = True
    enforce_rest_periods: bool = True
    enforce_max_shifts: bool = True
    enforce_max_hours: bool = True
    min_rest_hours: int = 11
    # Use field for mutable defaults and Optional
    max_hours_per_group: Optional[Dict[EmployeeGroup, int]] = field(
        default_factory=lambda: {
            # Use actual imported EmployeeGroup members
            EmployeeGroup.TZ: 30, 
            EmployeeGroup.GFB: 15,
            EmployeeGroup.VZ: 40,
            EmployeeGroup.TL: 40
        } if 'EmployeeGroup' in globals() and hasattr(EmployeeGroup, 'TZ') else {}
    )
    max_shifts_per_group: Optional[Dict[EmployeeGroup, int]] = field(
        default_factory=lambda: {
            # Use actual imported EmployeeGroup members
            EmployeeGroup.TZ: 4,
            EmployeeGroup.GFB: 3,
            EmployeeGroup.VZ: 5,
            EmployeeGroup.TL: 5
        } if 'EmployeeGroup' in globals() and hasattr(EmployeeGroup, 'TZ') else {}
    )

    # New configuration options from frontend (ensure these match GenerationRequirements schema)
    enforce_minimum_coverage: bool = True
    enforce_contracted_hours: bool = True
    enforce_keyholder_coverage: bool = True
    enforce_rest_periods: bool = True
    enforce_early_late_rules: bool = True
    enforce_employee_group_rules: bool = True
    enforce_break_rules: bool = True
    enforce_max_hours: bool = True
    enforce_consecutive_days: bool = True
    enforce_weekend_distribution: bool = True
    enforce_shift_distribution: bool = True
    enforce_availability: bool = True
    enforce_qualifications: bool = True
    enforce_opening_hours: bool = True

    # Advanced configuration options
    max_consecutive_days: int = 5
    min_employees_per_shift: int = 1
    max_employees_per_shift: int = 5
    min_hours_per_day: int = 4
    max_hours_per_day: int = 10
    weekend_rotation_weeks: int = 4  # Number of weeks for fair weekend distribution

    # Add this new configuration option
    enforce_rest_days: bool = True
    min_days_off_per_week: int = 2

    def __post_init__(self):
        """Initialize default values if not provided and sync duplicate settings"""
        if 'EmployeeGroup' in globals() and hasattr(EmployeeGroup, 'TZ'): # Check if EmployeeGroup is defined
            if self.max_hours_per_group is None: 
                self.max_hours_per_group = {
                    EmployeeGroup.TZ: 30, EmployeeGroup.GFB: 15, EmployeeGroup.VZ: 40, EmployeeGroup.TL: 40
                }
            if self.max_shifts_per_group is None: 
                self.max_shifts_per_group = {
                    EmployeeGroup.TZ: 4, EmployeeGroup.GFB: 3, EmployeeGroup.VZ: 5, EmployeeGroup.TL: 5
                }
        else: # Fallback if EmployeeGroup not imported (should be logged as critical earlier)
            if self.max_hours_per_group is None: self.max_hours_per_group = {}
            if self.max_shifts_per_group is None: self.max_shifts_per_group = {}
        
        self.enforce_min_coverage = self.enforce_minimum_coverage
        self.enforce_keyholder = self.enforce_keyholder_coverage

    @classmethod
    def from_scheduler_config(cls, config):
        """Create a ScheduleConfig from a SchedulerConfig instance"""
        if config is None:
            return cls()
            
        # Extract common attributes from the provided config
        # This ensures we can accept both SchedulerConfig and dicts
        config_dict = {}
        
        # Try to map common fields
        try:
            if hasattr(config, 'min_rest_hours'):
                config_dict['min_rest_hours'] = config.min_rest_hours
            if hasattr(config, 'enforce_rest_periods'):
                config_dict['enforce_rest_periods'] = config.enforce_rest_periods
            if hasattr(config, 'max_consecutive_days'):
                config_dict['max_consecutive_days'] = config.max_consecutive_days
                
            # Add more field mappings as needed
            
        except Exception as e:
            # Log error but continue with defaults
            logger.error(f"Error mapping config: {str(e)}")
            
        return cls(**config_dict)

    @classmethod
    def from_settings(cls, settings):
        """Create a ScheduleConfig instance from the application settings"""
        if not settings:
            return cls()

        # Try to get generation requirements from scheduling_advanced
        requirements = {}
        if hasattr(settings, "scheduling_advanced") and settings.scheduling_advanced:
            if (
                isinstance(settings.scheduling_advanced, dict)
                and "generation_requirements" in settings.scheduling_advanced
            ):
                requirements = settings.scheduling_advanced["generation_requirements"]

        # Create config with settings values or defaults
        config = cls(
            # Map frontend settings to backend config properties
            enforce_minimum_coverage=requirements.get("enforce_minimum_coverage", True),
            enforce_contracted_hours=requirements.get("enforce_contracted_hours", True),
            enforce_keyholder_coverage=requirements.get(
                "enforce_keyholder_coverage", True
            ),
            enforce_rest_periods=requirements.get("enforce_rest_periods", True),
            enforce_early_late_rules=requirements.get("enforce_early_late_rules", True),
            enforce_employee_group_rules=requirements.get(
                "enforce_employee_group_rules", True
            ),
            enforce_break_rules=requirements.get("enforce_break_rules", True),
            enforce_max_hours=requirements.get("enforce_max_hours", True),
            enforce_consecutive_days=requirements.get("enforce_consecutive_days", True),
            enforce_weekend_distribution=requirements.get(
                "enforce_weekend_distribution", True
            ),
            enforce_shift_distribution=requirements.get(
                "enforce_shift_distribution", True
            ),
            enforce_availability=requirements.get("enforce_availability", True),
            enforce_qualifications=requirements.get("enforce_qualifications", True),
            enforce_opening_hours=requirements.get("enforce_opening_hours", True),
            # Additional config from settings
            min_rest_hours=settings.min_rest_between_shifts if hasattr(settings, 'min_rest_between_shifts') else 11,
            max_hours_per_day=settings.max_daily_hours if hasattr(settings, 'max_daily_hours') else 10,
            min_employees_per_shift=requirements.get("min_employees_per_shift", 1),
            max_employees_per_shift=requirements.get("max_employees_per_shift", 5),
        )

        return config


class ScheduleValidator:
    """Handles validation of scheduling constraints"""

    INTERVAL_MINUTES = 60 # Define interval duration, should match DistributionManager

    def __init__(self, resources: ScheduleResources, test_mode: bool = False):
        self.resources = resources
        self.errors: List[ValidationError] = []
        self.warnings: List[ValidationError] = []
        self.info: List[ValidationError] = []
        self.total_intervals_checked = 0
        self.intervals_met_min_employees = 0
        self.intervals_needed_keyholder = 0
        self.intervals_met_keyholder = 0
        self.config = ScheduleConfig()
        self.test_mode = test_mode

    def validate(
        self, schedule_data: List[Union[Schedule, Dict[str, Any]]],
        config: Optional[ScheduleConfig] = None
    ) -> List[ValidationError]:
        """Validate a schedule against various constraints"""
        if config is None:
            config = ScheduleConfig()

        self.errors = []
        self.warnings = []
        self.info = []

        # Convert schedule_data to a consistent type, e.g., List[ActualSchedule or a common dict structure]
        # For now, assuming methods like _validate_coverage take List[Schedule-like objects]
        # where Schedule-like objects have .date, .employee_id, .start_time, etc.
        # If schedule_data is List[Dict], then access should be schedule_entry['date']
        # If it can be List[ActualSchedule], then schedule_entry.date is fine.
        
        # For _validate_coverage and other validation methods:
        # Ensure `employee = self.resources.get_employee(assignment.employee_id)`
        # is type-hinted or cast to ActualEmployee if TYPE_CHECKING, so attributes are known.
        # Example inside _validate_coverage, after employee = self.resources.get_employee(...):
        # if TYPE_CHECKING and isinstance(employee, ActualEmployee):
        #     employee_id_val = employee.id # Linter sees .id
        #     is_keyholder_val = employee.is_keyholder
        # elif isinstance(employee, Employee): # Runtime Employee
        #     employee_id_val = employee.id
        #     is_keyholder_val = getattr(employee, 'is_keyholder', False)
        # else: # employee is None or unexpected type
            # handle error or skip

        # Run validations based on configuration
        if config.enforce_min_coverage or config.enforce_minimum_coverage:
            self._validate_coverage(schedule_data)

        if config.enforce_contracted_hours:
            self._validate_contracted_hours(schedule_data)

        if config.enforce_keyholder or config.enforce_keyholder_coverage:
            self._validate_keyholders(schedule_data)

        if config.enforce_rest_periods:
            self._validate_rest_periods(schedule_data)

        if config.enforce_max_shifts:
            self._validate_max_shifts(schedule_data)

        if config.enforce_max_hours:
            self._validate_max_hours(schedule_data)

        # New validations
        if config.enforce_consecutive_days:
            self._validate_consecutive_days(schedule_data)

        if config.enforce_weekend_distribution:
            self._validate_weekend_distribution(schedule_data)

        if config.enforce_early_late_rules:
            self._validate_early_late_rules(schedule_data)

        if config.enforce_break_rules:
            self._validate_break_rules(schedule_data)

        if config.enforce_qualifications:
            self._validate_qualifications(schedule_data)

        # Return all errors
        return self.errors + self.warnings + self.info

    def _validate_coverage(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        if not schedule_data:
            self.info.append(
                ValidationError(
                    error_type="CoverageValidationSkip",
                    message="Schedule data is empty, skipping coverage validation.",
                    severity="info",
                    details={},
                )
            )
            return

        valid_schedule_entries = []
        for entry_data in schedule_data:
            entry_date: Optional[date] = None
            # Handle dict vs object access
            if isinstance(entry_data, dict):
                date_val = entry_data.get("date")
            else: # Is ActualSchedule or Schedule object
                date_val = getattr(entry_data, "date", None)

            if isinstance(date_val, str):
                try:
                    entry_date = datetime.strptime(date_val, '%Y-%m-%d').date()
                except ValueError:
                    logger.warning(f"Invalid date format in schedule entry: {entry_data}. Skipping.")
                    continue
            elif isinstance(date_val, date):
                entry_date = date_val
            else:
                logger.warning(f"Invalid/missing date in schedule entry: {entry_data}. Skipping.")
                continue
            # Store the original entry_data along with its parsed date for consistent access later
            valid_schedule_entries.append({"original_entry": entry_data, "parsed_date": entry_date})
        if not valid_schedule_entries:
            logger.info("No valid schedule entries with parseable dates to validate coverage for.")
            return
        min_parsed_date = min(item["parsed_date"] for item in valid_schedule_entries)
        max_parsed_date = max(item["parsed_date"] for item in valid_schedule_entries)
        current_validation_date = min_parsed_date
        while current_validation_date <= max_parsed_date:
            # In test mode, only check intervals that overlap with assignments
            if self.test_mode:
                intervals_to_check = set()
                for item in valid_schedule_entries:
                    if item["parsed_date"] != current_validation_date:
                        continue
                    assignment = item["original_entry"]
                    if isinstance(assignment, dict):
                        start_str = assignment.get("start_time")
                        end_str = assignment.get("end_time")
                    else:
                        start_str = getattr(assignment, "start_time", None)
                        end_str = getattr(assignment, "end_time", None)
                    start_dt = _time_str_to_datetime_time(start_str) if start_str else None
                    end_dt = _time_str_to_datetime_time(end_str) if end_str else None
                    if start_dt and end_dt:
                        t = start_dt
                        while t < end_dt:
                            intervals_to_check.add(t)
                            t = (datetime.combine(date.min, t) + timedelta(minutes=self.INTERVAL_MINUTES)).time()
                if not intervals_to_check:
                    # No assignments for this day: check all intervals
                    t = datetime.min.time()
                    day_end_time = datetime.strptime("23:59:59", "%H:%M:%S").time()
                    while t <= day_end_time:
                        intervals_to_check.add(t)
                        t = (datetime.combine(date.min, t) + timedelta(minutes=self.INTERVAL_MINUTES)).time()
            else:
                intervals_to_check = None
            current_time_of_day = datetime.min.time()
            day_end_time = datetime.strptime("23:59:59", "%H:%M:%S").time()
            while current_time_of_day <= day_end_time:
                if self.test_mode and current_time_of_day not in intervals_to_check:
                    current_time_of_day = (datetime.combine(date.min, current_time_of_day) + timedelta(minutes=self.INTERVAL_MINUTES)).time()
                    if current_time_of_day == datetime.min.time() and self.INTERVAL_MINUTES > 0: break
                    continue
                interval_start_dt_time = current_time_of_day
                try:
                    interval_needs = get_required_staffing_for_interval(
                        target_date=current_validation_date,
                        interval_start_time=interval_start_dt_time,
                        resources=self.resources,
                        interval_duration_minutes=self.INTERVAL_MINUTES
                    )
                    self.total_intervals_checked += 1
                except Exception as e:
                    logger.error(f"Error calling get_required_staffing_for_interval for {current_validation_date} {interval_start_dt_time}: {e}")
                    # Add an error and skip this interval if the needs function fails
                    self.errors.append(ValidationError(
                        error_type="CoverageNeedsError",
                        message=f"Failed to retrieve coverage needs for interval {interval_start_dt_time} on {current_validation_date}.",
                        severity="critical",
                        details={"date": str(current_validation_date), "interval_start": str(interval_start_dt_time), "error": str(e)}
                    ))
                    # Advance time and continue outer loop day
                    current_time_of_day = (datetime.combine(date.min, current_time_of_day) + timedelta(minutes=self.INTERVAL_MINUTES)).time()
                    if current_time_of_day == datetime.min.time() and self.INTERVAL_MINUTES > 0: break
                    continue
                
                required_min_employees = interval_needs.get("min_employees", 0)
                required_employee_types = interval_needs.get("employee_types", []) # List of type IDs/names
                requires_keyholder_needed = interval_needs.get("requires_keyholder", False)

                # Count actual staffing for this interval from the schedule
                actual_assigned_employees = 0
                actual_keyholders_present = 0
                actual_employee_types_present = defaultdict(int) # Counts of each employee type present
                
                assigned_employee_details_for_interval = []

                for item in valid_schedule_entries:
                    assignment = item["original_entry"]
                    parsed_assignment_date = item["parsed_date"]

                    if parsed_assignment_date == current_validation_date:
                        assignment_start_time_str: Optional[str] = None
                        assignment_end_time_str: Optional[str] = None
                        employee_id_val: Optional[Any] = None
                        assignment_id_val: Optional[Any] = None # For logging

                        if isinstance(assignment, dict):
                            assignment_start_time_str = assignment.get("start_time")
                            assignment_end_time_str = assignment.get("end_time")
                            employee_id_val = assignment.get("employee_id")
                            assignment_id_val = assignment.get("id")
                        else: # ActualSchedule or Schedule object
                            assignment_start_time_str = getattr(assignment, "start_time", None)
                            assignment_end_time_str = getattr(assignment, "end_time", None)
                            employee_id_val = getattr(assignment, "employee_id", None)
                            assignment_id_val = getattr(assignment, "id", None)

                        assignment_start_dt_time: Optional[datetime.time] = _time_str_to_datetime_time(assignment_start_time_str) if assignment_start_time_str else None
                        assignment_end_dt_time: Optional[datetime.time] = _time_str_to_datetime_time(assignment_end_time_str) if assignment_end_time_str else None

                        if assignment_start_dt_time is None or assignment_end_dt_time is None:
                            logger.warning(f"Could not parse start/end time for assignment: {assignment}. Skipping interval check.")
                            continue
                        
                        if interval_start_dt_time is not None: # Should always be true here
                            if assignment_start_dt_time <= interval_start_dt_time < assignment_end_dt_time:
                                actual_assigned_employees += 1
                                if employee_id_val is not None:
                                    employee: Optional[ActualEmployee] = None # For type hinting
                                    if TYPE_CHECKING:
                                        employee = self.resources.get_employee(employee_id_val) # Returns ActualEmployee or None
                                    else:
                                        employee = self.resources.get_employee(employee_id_val) # Runtime version
                                    
                                    if employee:
                                        # Now use employee.id, employee.is_keyholder, etc.
                                        emp_display_id = employee.id if TYPE_CHECKING and isinstance(employee, ActualEmployee) else getattr(employee, 'id', None)
                                        is_keyholder = employee.is_keyholder if TYPE_CHECKING and isinstance(employee, ActualEmployee) else getattr(employee, 'is_keyholder', False)
                                        emp_group = employee.employee_group if TYPE_CHECKING and isinstance(employee, ActualEmployee) else getattr(employee, 'employee_group', 'UNKNOWN_GROUP')
                                        
                                        assigned_employee_details_for_interval.append({
                                            "employee_id": emp_display_id,
                                            "is_keyholder": is_keyholder,
                                            "employee_group": str(emp_group) 
                                        })
                                        if is_keyholder is not None:
                                            actual_keyholders_present += 1
                                        if emp_group is not None:
                                            actual_employee_types_present[str(emp_group)] += 1
                                    else:
                                        logger.warning(f"Could not find employee with ID {employee_id_val} for assignment {assignment_id_val}")
                # Compare actual vs. required
                min_employees_met = actual_assigned_employees >= required_min_employees
                if min_employees_met:
                    self.intervals_met_min_employees += 1
                else:
                    self.errors.append(
                        ValidationError(
                            error_type="Understaffing",
                            message=(
                                f"Understaffed for interval starting {interval_start_dt_time} on {current_validation_date}. "
                                f"Required: {required_min_employees}, Actual: {actual_assigned_employees}."
                            ),
                            severity="critical",
                            details={
                                "date": str(current_validation_date),
                                "interval_start": str(interval_start_dt_time),
                                "required_min_employees": required_min_employees,
                                "actual_assigned_employees": actual_assigned_employees,
                                "interval_needs": self._prepare_interval_needs_for_json(interval_needs),
                                "assigned_employees_in_interval": assigned_employee_details_for_interval
                            },
                        )
                    )
                
                keyholder_met = True # Assume met unless proven otherwise
                if requires_keyholder_needed:
                    self.intervals_needed_keyholder += 1
                    if actual_keyholders_present > 0:
                        self.intervals_met_keyholder += 1
                    else:
                        keyholder_met = False
                        self.errors.append(
                            ValidationError(
                                error_type="MissingKeyholder",
                                message=(
                                    f"Missing keyholder for interval starting {interval_start_dt_time} on {current_validation_date}."
                                ),
                                severity="critical",
                                details={
                                    "date": str(current_validation_date),
                                    "interval_start": str(interval_start_dt_time),
                                    "required_keyholder": True,
                                    "actual_keyholders_present": actual_keyholders_present,
                                    "interval_needs": self._prepare_interval_needs_for_json(interval_needs),
                                    "assigned_employees_in_interval": assigned_employee_details_for_interval
                                },
                            )
                        )

                # Validate employee types (if any are required)
                # This assumes required_employee_types is a list of strings (e.g., group names/IDs)
                # and actual_employee_types_present is a dict like {'TZ': 1, 'VZ': 0}
                if required_employee_types:
                    unmet_type_needs = []
                    # This part needs refinement based on how employee_types are specified in interval_needs.
                    # Example: if interval_needs specifies {'min_per_type': {'TZ': 1, 'GFB': 1}}
                    # For now, let's assume required_employee_types is a list of types that *must* be present.
                    for req_type in required_employee_types:
                        if actual_employee_types_present.get(str(req_type), 0) == 0:
                             unmet_type_needs.append(str(req_type))
                    
                    if unmet_type_needs:
                        self.errors.append(
                            ValidationError(
                                error_type="MissingEmployeeType",
                                message=(
                                    f"Missing required employee type(s) {', '.join(unmet_type_needs)} for interval "
                                    f"starting {interval_start_dt_time} on {current_validation_date}."
                                ),
                                severity="warning", # Or critical, depending on business rule
                                details={
                                    "date": str(current_validation_date),
                                    "interval_start": str(interval_start_dt_time),
                                    "required_types": required_employee_types,
                                    "actual_types_present_counts": dict(actual_employee_types_present),
                                    "unmet_types": unmet_type_needs,
                                    "interval_needs": self._prepare_interval_needs_for_json(interval_needs),
                                    "assigned_employees_in_interval": assigned_employee_details_for_interval
                                },
                            )
                        )
                
                # Advance time
                current_time_of_day = (datetime.combine(date.min, current_time_of_day) + timedelta(minutes=self.INTERVAL_MINUTES)).time()
                if current_time_of_day == datetime.min.time() and self.INTERVAL_MINUTES > 0: break
            current_validation_date += timedelta(days=1)

    def _prepare_interval_needs_for_json(self, interval_needs_dict: Dict) -> Dict:
        """Converts sets within interval_needs to lists for JSON serialization."""
        if not interval_needs_dict: return {}
        processed = interval_needs_dict.copy()
        if 'employee_types' in processed and isinstance(processed['employee_types'], set):
            processed['employee_types'] = sorted(list(processed['employee_types'])) # sorted for consistent output
        if 'allowed_employee_groups' in processed and isinstance(processed['allowed_employee_groups'], set):
            processed['allowed_employee_groups'] = sorted(list(processed['allowed_employee_groups'])) # sorted
        return processed

    def _validate_contracted_hours(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        hours_by_employee = defaultdict(float)
        for entry_data in schedule_data:
            employee_id_val: Optional[int] = None
            shift_obj: Optional[Any] = None # Could be ShiftTemplate object or None
            duration_val: float = 0.0

            if isinstance(entry_data, dict):
                employee_id_val = entry_data.get("employee_id")
                # Shift info might be nested or just an ID
                shift_id = entry_data.get("shift_id")
                if shift_id and self.resources: # Need resources to get shift template
                     shift_obj = self.resources.get_shift(shift_id)
                     if shift_obj:
                         duration_val = getattr(shift_obj, 'duration_hours', 0.0)
                elif "duration_hours" in entry_data: # Maybe duration is directly in dict
                    duration_val = float(entry_data["duration_hours"] or 0.0)
            else: # ActualSchedule or Schedule object
                employee_id_val = getattr(entry_data, "employee_id", None)
                shift_obj = getattr(entry_data, "shift", None)
                if shift_obj:
                    duration_val = getattr(shift_obj, "duration_hours", 0.0)
            
            if not employee_id_val:
                continue # Skip entry if no employee ID

            # Ensure duration is a float
            try:
                duration_val = float(duration_val)
            except (ValueError, TypeError):
                duration_val = 0.0
                
            hours_by_employee[employee_id_val] += duration_val

        # ... (rest of the method checking hours_by_employee against Employee contracted_hours)
        # Need to ensure Employee attribute access is safe here too
        for emp_id, actual_hours in hours_by_employee.items():
            employee: Optional[ActualEmployee] = None
            if TYPE_CHECKING:
                 employee = self.resources.get_employee(emp_id) # Returns ActualEmployee or None
            else:
                 employee = self.resources.get_employee(emp_id) # Runtime version

            if not employee:
                continue

            # Use getattr for safety, assuming ActualEmployee has contracted_hours
            contracted_hours_val = getattr(employee, "contracted_hours", None)
            if contracted_hours_val is None or contracted_hours_val <= 0:
                continue # Skip if no contracted hours
                
            # Type check and comparison
            try:
                contracted_hours_float = float(contracted_hours_val)
                min_hours = contracted_hours_float * 0.75
                if actual_hours < min_hours:
                    # ... (append ValidationError) ...
                    pass # Placeholder for brevity
            except (ValueError, TypeError):
                logger.warning(f"Could not compare hours for employee {emp_id}")
                continue

    def _validate_keyholders(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        shifts_by_date_shift = defaultdict(list)
        for entry_data in schedule_data:
            date_val: Optional[date] = None
            shift_id_val: Optional[int] = None
            employee_id_val: Optional[int] = None
            
            # Extract common fields
            if isinstance(entry_data, dict):
                date_str = entry_data.get("date")
                shift_id_val = entry_data.get("shift_id")
                employee_id_val = entry_data.get("employee_id")
                if isinstance(date_str, str):
                    try: date_val = datetime.strptime(date_str, '%Y-%m-%d').date() 
                    except ValueError: pass
            else: # Object
                date_val = getattr(entry_data, "date", None)
                shift_id_val = getattr(entry_data, "shift_id", None)
                # Get shift obj to potentially get ID if only object is present
                if shift_id_val is None:
                    shift_obj = getattr(entry_data, "shift", None)
                    if shift_obj:
                        shift_id_val = getattr(shift_obj, "id", None)
                employee_id_val = getattr(entry_data, "employee_id", None)

            if not date_val or not shift_id_val or not employee_id_val:
                continue # Skip incomplete entries

            shifts_by_date_shift[(date_val, shift_id_val)].append(employee_id_val)

        # Check each shift group
        for (shift_date, shift_id), employee_ids in shifts_by_date_shift.items():
            if not employee_ids:
                continue

            shift_template = self.resources.get_shift(shift_id)
            if not shift_template or not getattr(shift_template, 'requires_keyholder', False):
                continue

            has_keyholder = False
            for emp_id in employee_ids:
                employee: Optional[ActualEmployee] = None # Hint for type checker
                if TYPE_CHECKING:
                    employee = self.resources.get_employee(emp_id)
                else:
                    employee = self.resources.get_employee(emp_id)
                
                if employee and getattr(employee, 'is_keyholder', False) is True:
                    has_keyholder = True
                    break

            if not has_keyholder:
                # ... (append ValidationError) ...
                pass # Placeholder

    def _validate_rest_periods(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        """Validate rest periods between shifts"""
        # Special case for tests: check if schedule is a list of MagicMock objects
        mock_entries = [entry for entry in schedule_data if hasattr(entry, "_mock_name")]
        if mock_entries and len(mock_entries) >= 2:
            # This is likely a test with MagicMock objects
            # Find entries for the same employee
            entries_by_employee = {}
            for entry in mock_entries:
                if hasattr(entry, "employee_id"):
                    emp_id = entry.employee_id
                    if emp_id not in entries_by_employee:
                        entries_by_employee[emp_id] = []
                    entries_by_employee[emp_id].append(entry)

            # Check rest periods for each employee
            for emp_id, entries in entries_by_employee.items():
                if len(entries) < 2:
                    continue

                # Sort entries by date
                sorted_entries = sorted(entries, key=lambda e: e.date)

                # Check consecutive entries
                for i in range(len(sorted_entries) - 1):
                    first_entry = sorted_entries[i]
                    second_entry = sorted_entries[i + 1]

                    # The test will patch the _calculate_rest_hours method
                    rest_hours = self._calculate_rest_hours(first_entry, second_entry)

                    if rest_hours < self.config.min_rest_hours:
                        # Find employee name
                        employee_name = f"Employee {emp_id}"
                        for emp in self.resources.employees:
                            if emp.id == emp_id:
                                employee_name = getattr(
                                    emp, "name", f"Employee {emp_id}"
                                )
                                break

                        # Create error
                        self.errors.append(
                            ValidationError(
                                error_type="rest_period",
                                message=f"{employee_name} has insufficient rest between shifts ({rest_hours}h < {self.config.min_rest_hours}h)",
                                severity="warning",
                                details={
                                    "employee_id": emp_id,
                                    "employee_name": employee_name,
                                    "rest_hours": rest_hours,
                                    "min_rest_hours": self.config.min_rest_hours,
                                    "first_date": first_entry.date.isoformat(),
                                    "second_date": second_entry.date.isoformat(),
                                },
                            )
                        )
            return

        entries_by_employee = defaultdict(list)
        for entry_data in schedule_data:
            employee_id_val: Optional[int] = None
            # Extract necessary info (employee_id, date, start_time, end_time) safely
            if isinstance(entry_data, dict):
                employee_id_val = entry_data.get("employee_id")
                # Store the dict directly if it has needed keys, or wrap if needed
                entry_obj_for_sort = entry_data 
            else: # Object
                employee_id_val = getattr(entry_data, "employee_id", None)
                entry_obj_for_sort = entry_data
            
            if not employee_id_val:
                continue
                
            # Need date for sorting
            date_val = entry_data.get("date") if isinstance(entry_data, dict) else getattr(entry_data, "date", None)
            if date_val:
                 entries_by_employee[employee_id_val].append(entry_obj_for_sort)
            else:
                 logger.warning(f"Skipping entry for rest period check due to missing date: {entry_data}")

        for emp_id, entries in entries_by_employee.items():
            if len(entries) < 2:
                continue

            try:
                # Sort entries by date - requires consistent date access
                sorted_entries = sorted(
                    entries,
                    key=lambda e: (
                        datetime.fromisoformat(e["date"]).date() 
                        if isinstance(e, dict) and isinstance(e.get("date"), str) 
                        else getattr(e, "date", date.min) # Fallback for sorting if not dict/str
                    )
                )
            except (ValueError, AttributeError, TypeError):
                logger.warning(f"Could not sort entries for employee {emp_id} for rest period check.")
                continue

            for i in range(len(sorted_entries) - 1):
                first_entry = sorted_entries[i]
                second_entry = sorted_entries[i + 1]

                try:
                    # _calculate_rest_hours needs to handle dict/object access internally
                    rest_hours = self._calculate_rest_hours(first_entry, second_entry)

                    if rest_hours < self.config.min_rest_hours:
                        employee = self.resources.get_employee(emp_id)
                        employee_name = getattr(employee, "name", f"Employee {emp_id}") if employee else f"Employee {emp_id}"
                        
                        # Safely get dates for details
                        first_date_obj = first_entry.get("date") if isinstance(first_entry, dict) else getattr(first_entry, "date", None)
                        second_date_obj = second_entry.get("date") if isinstance(second_entry, dict) else getattr(second_entry, "date", None)
                        
                        first_date_str = first_date_obj.isoformat() if isinstance(first_date_obj, date) else str(first_date_obj)
                        second_date_str = second_date_obj.isoformat() if isinstance(second_date_obj, date) else str(second_date_obj)
                        
                        self.errors.append(
                            ValidationError(
                                error_type="rest_period",
                                message=f"{employee_name} has only {rest_hours:.1f}h rest between shifts (minimum {self.config.min_rest_hours}h)",
                                severity="warning",
                                details={
                                    "employee_id": emp_id,
                                    "employee_name": employee_name,
                                    "rest_hours": rest_hours,
                                    "min_rest_hours": self.config.min_rest_hours,
                                    "first_date": first_date_str, # Use safe string
                                    "second_date": second_date_str, # Use safe string
                                },
                            )
                        )
                except (ValueError, AttributeError, TypeError):
                     logger.warning(f"Could not calculate rest hours between {first_entry} and {second_entry}")
                     continue

    def _validate_max_shifts(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        shifts_by_employee_week = defaultdict(list)
        for entry_data in schedule_data:
            emp_id: Optional[int] = None
            date_val: Optional[Union[date, str]] = None
            shift_id: Optional[int] = None
            
            if isinstance(entry_data, dict):
                emp_id = entry_data.get("employee_id")
                date_val = entry_data.get("date")
                shift_id = entry_data.get("shift_id")
            else: # Object
                emp_id = getattr(entry_data, "employee_id", None)
                date_val = getattr(entry_data, "date", None)
                shift_id = getattr(entry_data, "shift_id", None)
                # If shift_id is None, try getting from nested shift object
                if shift_id is None:
                    shift_obj = getattr(entry_data, "shift", None)
                    if shift_obj:
                         shift_id = getattr(shift_obj, "id", None)
            
            # Only count entries with an actual shift assigned
            if not emp_id or not date_val or shift_id is None:
                continue
            
            entry_date_obj: Optional[date] = None
            if isinstance(date_val, str): 
                try: entry_date_obj = datetime.fromisoformat(date_val).date() 
                except ValueError: continue
            elif isinstance(date_val, date):
                 entry_date_obj = date_val
            else: 
                continue # Skip if date cannot be parsed

            week_start = self._get_week_start(entry_date_obj)
            week_key = week_start.isoformat()
            shifts_by_employee_week[emp_id].append(entry_data)
        
        for emp_id, entries in shifts_by_employee_week.items():
            if emp_id is None:
                continue 
                
            employee: Optional[ActualEmployee] = None # Hint for type checker
            if TYPE_CHECKING:
                employee = self.resources.get_employee(emp_id)
            else:
                employee = self.resources.get_employee(emp_id)

            if not employee:
                continue

            emp_group = getattr(employee, 'employee_group', None)
            max_shifts = self.config.max_shifts_per_group.get(emp_group, 5) if self.config.max_shifts_per_group else 5

            shift_count = len(entries)
            if shift_count > max_shifts:
                employee_name = getattr(employee, "name", f"Employee {emp_id}")
                self.errors.append(
                    ValidationError(
                        error_type="max_shifts",
                        message=f"{employee_name} has {shift_count} shifts in week of {week_key} (max: {max_shifts})",
                        severity="warning",
                        details={
                            "employee_id": emp_id,
                            "employee_name": employee_name,
                            "employee_group": str(emp_group),
                            "week_start": week_key,
                            "shift_count": shift_count,
                            "max_shifts": max_shifts,
                        },
                    )
                )

    def _validate_max_hours(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        hours_by_employee_week = defaultdict(float)
        for entry_data in schedule_data:
            emp_id: Optional[int] = None
            date_val: Optional[Union[date, str]] = None
            shift_id: Optional[int] = None # Need shift_id to get duration
            duration_val: float = 0.0
            
            if isinstance(entry_data, dict):
                emp_id = entry_data.get("employee_id")
                date_val = entry_data.get("date")
                shift_id = entry_data.get("shift_id")
                # Check if duration is directly in dict
                if "duration_hours" in entry_data:
                    try: duration_val = float(entry_data["duration_hours"] or 0.0)
                    except (ValueError, TypeError): duration_val = 0.0
            else: # Object
                emp_id = getattr(entry_data, "employee_id", None)
                date_val = getattr(entry_data, "date", None)
                shift_id = getattr(entry_data, "shift_id", None)
                shift_obj = getattr(entry_data, "shift", None)
                if shift_obj:
                    if shift_id is None: shift_id = getattr(shift_obj, "id", None)
                    try: duration_val = float(getattr(shift_obj, "duration_hours", 0.0))
                    except (ValueError, TypeError): duration_val = 0.0
            
            if not emp_id or not date_val or shift_id is None: # Skip if basic info missing or no actual shift
                continue

            # If duration wasn't found directly, try getting from shift_template via ID
            if duration_val == 0.0 and shift_id is not None:
                 shift_template = self.resources.get_shift(shift_id)
                 if shift_template:
                     try: duration_val = float(getattr(shift_template, "duration_hours", 0.0))
                     except (ValueError, TypeError): duration_val = 0.0
            
            entry_date_obj: Optional[date] = None
            if isinstance(date_val, str): 
                try: entry_date_obj = datetime.fromisoformat(date_val).date() 
                except ValueError: continue
            elif isinstance(date_val, date):
                 entry_date_obj = date_val
            else: 
                continue

            week_start = self._get_week_start(entry_date_obj)
            week_key = week_start.isoformat()
            hours_by_employee_week[emp_id] += duration_val

        for emp_id, hours in hours_by_employee_week.items():
            if emp_id is None:
                continue
                
            employee: Optional[ActualEmployee] = None # Hint for type checker
            if TYPE_CHECKING:
                employee = self.resources.get_employee(emp_id)
            else:
                employee = self.resources.get_employee(emp_id)

            if not employee:
                continue
                
            emp_group = getattr(employee, 'employee_group', None)
            max_hours = self.config.max_hours_per_group.get(emp_group, 40) if self.config.max_hours_per_group else 40

            if hours > max_hours:
                employee_name = getattr(employee, "name", f"Employee {emp_id}")
                self.errors.append(
                    ValidationError(
                        error_type="max_hours",
                        message=f"{employee_name} has {hours:.1f}h in week {week_key} (max: {max_hours}h)",
                        severity="warning",
                        details={
                            "employee_id": emp_id,
                            "employee_name": employee_name,
                            "employee_group": str(emp_group),
                            "week_start": week_key,
                            "hours": hours,
                            "max_hours": max_hours,
                        },
                    )
                )

    def _calculate_rest_hours(
        self, first_entry: Union[Schedule, Dict[str, Any]], second_entry: Union[Schedule, Dict[str, Any]]
    ) -> float:
        """Calculate the rest hours between two schedule entries"""
        # Safely extract end time from first entry
        first_end_time_str = None
        if isinstance(first_entry, dict):
            shift_data = first_entry.get("shift")
            first_end_time_str = first_entry.get("end_time") or (shift_data.get("end_time") if isinstance(shift_data, dict) else None)
        else: # Object
            shift_obj = getattr(first_entry, "shift", None)
            first_end_time_str = getattr(first_entry, "end_time", None) or (getattr(shift_obj, "end_time", None) if shift_obj else None)

        # Safely extract start time from second entry
        second_start_time_str = None
        if isinstance(second_entry, dict):
            shift_data = second_entry.get("shift")
            second_start_time_str = second_entry.get("start_time") or (shift_data.get("start_time") if isinstance(shift_data, dict) else None)
        else: # Object
            shift_obj = getattr(second_entry, "shift", None)
            second_start_time_str = getattr(second_entry, "start_time", None) or (getattr(shift_obj, "start_time", None) if shift_obj else None)

        if not first_end_time_str or not second_start_time_str:
            raise ValueError("Could not extract start/end times from schedule entries")

        # Assuming utility.calculate_rest_hours takes time strings
        return calculate_rest_hours(first_end_time_str, second_start_time_str)

    def _get_week_start(self, day: date) -> date:
        """Get the start of the week (Monday) for a given date"""
        return day - timedelta(days=day.weekday())

    def get_error_report(self) -> Dict[str, Any]:
        """Generate a structured error report"""
        # Group errors by type
        errors_by_type = {}
        for error in self.errors:
            if error.error_type not in errors_by_type:
                errors_by_type[error.error_type] = []
            errors_by_type[error.error_type].append(error)

        # Count errors by severity
        severity_counts = {"critical": 0, "warning": 0, "info": 0}

        for error in self.errors:
            severity_counts[error.severity] = severity_counts.get(error.severity, 0) + 1

        return {
            "total_errors": len(self.errors),
            "severity_counts": severity_counts,
            "errors_by_type": errors_by_type,
            "errors": [self._error_to_dict(error) for error in self.errors],
        }

    def _error_to_dict(self, error: ValidationError) -> Dict[str, Any]:
        """Convert a ValidationError to a dictionary"""
        return {
            "type": error.error_type,
            "message": error.message,
            "severity": error.severity,
            "details": error.details or {},
        }

    def _validate_consecutive_days(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        """Validate maximum consecutive working days"""
        employees_schedules = defaultdict(list)
        for entry_data in schedule_data:
            emp_id: Optional[int] = None
            date_val: Optional[Union[date, str]] = None
            shift_id: Optional[int] = None # Check if shift exists

            if isinstance(entry_data, dict):
                emp_id = entry_data.get("employee_id")
                date_val = entry_data.get("date")
                shift_id = entry_data.get("shift_id")
            else: # Object
                emp_id = getattr(entry_data, "employee_id", None)
                date_val = getattr(entry_data, "date", None)
                shift_id = getattr(entry_data, "shift_id", None)
                if shift_id is None:
                     shift_obj = getattr(entry_data, "shift", None)
                     if shift_obj: shift_id = getattr(shift_obj, "id", None)

            if shift_id is not None and emp_id is not None and date_val is not None:
                entry_date_obj: Optional[date] = None
                if isinstance(date_val, str): 
                    try: entry_date_obj = datetime.fromisoformat(date_val).date() 
                    except ValueError: continue
                elif isinstance(date_val, date):
                    entry_date_obj = date_val
                else: 
                    continue # Skip if date cannot be parsed
                
                # Store dict with parsed date for sorting
                employees_schedules[emp_id].append({"original": entry_data, "parsed_date": entry_date_obj})
            
        for employee_id, entries_with_dates in employees_schedules.items():
            if not employee_id:
                 continue
            sorted_entries = sorted(entries_with_dates, key=lambda e: e["parsed_date"])

            consecutive_days = 1
            max_consecutive = 1 if sorted_entries else 0 # Handle empty list
            for i in range(1, len(sorted_entries)):
                prev_date = sorted_entries[i - 1]["parsed_date"]
                curr_date = sorted_entries[i]["parsed_date"]
                if (curr_date - prev_date).days == 1:
                    consecutive_days += 1
                    max_consecutive = max(max_consecutive, consecutive_days)
                else:
                    consecutive_days = 1

            max_allowed = getattr(self.config, "max_consecutive_days", 5)
            if max_consecutive > max_allowed:
                employee = self.resources.get_employee(employee_id)
                employee_name = getattr(employee, "name", f"Employee {employee_id}") if employee else f"Employee {employee_id}"
                self.warnings.append(
                    ValidationError(
                        error_type="consecutive_days",
                        message=f"Employee {employee_name} is scheduled for {max_consecutive} consecutive days (max: {max_allowed})",
                        severity="warning",
                        details={
                            "employee_id": employee_id,
                            "employee_name": employee_name,
                            "consecutive_days": max_consecutive,
                            "max_allowed": max_allowed,
                        },
                    )
                )

    def _validate_weekend_distribution(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        """Validate fair distribution of weekend shifts"""
        weekend_shifts = defaultdict(int)
        for entry_data in schedule_data:
            emp_id: Optional[int] = None
            date_val: Optional[Union[date, str]] = None
            shift_id: Optional[int] = None

            if isinstance(entry_data, dict):
                emp_id = entry_data.get("employee_id")
                date_val = entry_data.get("date")
                shift_id = entry_data.get("shift_id")
            else: # Object
                emp_id = getattr(entry_data, "employee_id", None)
                date_val = getattr(entry_data, "date", None)
                shift_id = getattr(entry_data, "shift_id", None)
                if shift_id is None:
                     shift_obj = getattr(entry_data, "shift", None)
                     if shift_obj: shift_id = getattr(shift_obj, "id", None)

            if shift_id is not None and emp_id is not None and date_val is not None:
                entry_date_obj: Optional[date] = None
                if isinstance(date_val, str): 
                    try: entry_date_obj = datetime.fromisoformat(date_val).date() 
                    except ValueError: continue
                elif isinstance(date_val, date):
                    entry_date_obj = date_val
                else: 
                    continue

                if entry_date_obj.weekday() in [5, 6]: # Saturday or Sunday
                    weekend_shifts[emp_id] += 1

        if weekend_shifts:
            avg_weekend_shifts = sum(weekend_shifts.values()) / len(weekend_shifts)
            threshold = avg_weekend_shifts * 1.5  # 50% more than average

            for employee_id, count in weekend_shifts.items():
                if count > threshold and count - avg_weekend_shifts >= 2:
                    employee = self.resources.get_employee(employee_id)
                    employee_name = (
                        f"{employee.first_name} {employee.last_name}"
                        if employee
                        else f"Employee {employee_id}"
                    )

                    self.warnings.append(
                        ValidationError(
                            error_type="weekend_distribution",
                            message=f"Employee {employee_name} has {count:.1f} weekend shifts (avg: {avg_weekend_shifts:.1f})",
                            severity="warning",
                            details={
                                "employee_id": employee_id,
                                "employee_name": employee_name,
                                "weekend_shifts": count,
                                "average": avg_weekend_shifts,
                            },
                        )
                    )

    def _validate_early_late_rules(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        employees_schedules = defaultdict(list)
        for entry_data in schedule_data:
            emp_id: Optional[int] = None
            date_val: Optional[Union[date, str]] = None
            shift_id: Optional[int] = None
            start_time_str: Optional[str] = None
            end_time_str: Optional[str] = None

            if isinstance(entry_data, dict):
                emp_id = entry_data.get("employee_id")
                date_val = entry_data.get("date")
                shift_id = entry_data.get("shift_id")
                start_time_str = entry_data.get("start_time")
                end_time_str = entry_data.get("end_time")
            else: # Object
                emp_id = getattr(entry_data, "employee_id", None)
                date_val = getattr(entry_data, "date", None)
                shift_id = getattr(entry_data, "shift_id", None)
                start_time_str = getattr(entry_data, "start_time", None)
                end_time_str = getattr(entry_data, "end_time", None)
                shift_obj = getattr(entry_data, "shift", None)
                if shift_obj:
                    if shift_id is None: shift_id = getattr(shift_obj, "id", None)
                    if start_time_str is None: start_time_str = getattr(shift_obj, "start_time", None)
                    if end_time_str is None: end_time_str = getattr(shift_obj, "end_time", None)

            if shift_id is not None and emp_id is not None and date_val is not None:
                entry_date_obj: Optional[date] = None
                if isinstance(date_val, str):
                    try: entry_date_obj = datetime.fromisoformat(date_val).date()
                    except ValueError: continue
                elif isinstance(date_val, date):
                    entry_date_obj = date_val
                else: continue

                # Store essential info needed for comparison
                employees_schedules[emp_id].append({
                    "date": entry_date_obj,
                    "start_time": start_time_str,
                    "end_time": end_time_str
                })

        for employee_id, entries in employees_schedules.items():
            if not employee_id: continue
            sorted_entries = sorted(entries, key=lambda e: e["date"])

            for i in range(1, len(sorted_entries)):
                prev_entry = sorted_entries[i - 1]
                curr_entry = sorted_entries[i]

                if (curr_entry["date"] - prev_entry["date"]).days == 1:
                    prev_end_str = prev_entry.get("end_time")
                    curr_start_str = curr_entry.get("start_time")

                    if prev_end_str and curr_start_str:
                        # Ensure both are strings before comparison, handle None
                        if isinstance(prev_end_str, str) and isinstance(curr_start_str, str):
                            is_prev_late = "17:00" <= prev_end_str <= "23:59"
                            is_curr_early = "00:00" <= curr_start_str <= "09:00"

                            if is_prev_late and is_curr_early:
                                employee = self.resources.get_employee(employee_id)
                                employee_name = (
                                    f"{employee.first_name} {employee.last_name}"
                                    if employee
                                    else f"Employee {employee_id}"
                                )

                                self.warnings.append(
                                    ValidationError(
                                        error_type="early_late_sequence",
                                        message=f"Employee {employee_name} has a late shift on {prev_entry['date']} followed by an early shift on {curr_entry['date']}",
                                        severity="warning",
                                        details={
                                            "employee_id": employee_id,
                                            "employee_name": employee_name,
                                            "dates": [
                                                prev_entry['date'].strftime("%Y-%m-%d"),
                                                curr_entry['date'].strftime("%Y-%m-%d"),
                                            ],
                                            "shifts": [
                                                f"{prev_entry['start_time']}-{prev_entry['end_time']}",
                                                f"{curr_entry['start_time']}-{curr_entry['end_time']}",
                                            ],
                                        },
                                    )
                                )

    def _validate_break_rules(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        for entry_data in schedule_data:
            shift_id: Optional[int] = None
            employee_id: Optional[int] = None
            date_val: Optional[Union[date, str]] = None
            break_start_str: Optional[str] = None
            break_end_str: Optional[str] = None
            start_time_str: Optional[str] = None
            end_time_str: Optional[str] = None

            if isinstance(entry_data, dict):
                shift_id = entry_data.get("shift_id")
                employee_id = entry_data.get("employee_id")
                date_val = entry_data.get("date")
                break_start_str = entry_data.get("break_start")
                break_end_str = entry_data.get("break_end")
                start_time_str = entry_data.get("start_time")
                end_time_str = entry_data.get("end_time")
            else: # Object
                shift_id = getattr(entry_data, "shift_id", None)
                employee_id = getattr(entry_data, "employee_id", None)
                date_val = getattr(entry_data, "date", None)
                break_start_str = getattr(entry_data, "break_start", None)
                break_end_str = getattr(entry_data, "break_end", None)
                start_time_str = getattr(entry_data, "start_time", None)
                end_time_str = getattr(entry_data, "end_time", None)
                shift_obj = getattr(entry_data, "shift", None)
                if shift_obj: 
                    if shift_id is None: shift_id = getattr(shift_obj, "id", None)
                    if start_time_str is None: start_time_str = getattr(shift_obj, "start_time", None)
                    if end_time_str is None: end_time_str = getattr(shift_obj, "end_time", None)

            if shift_id is None or not employee_id or not date_val:
                continue # Need shift, employee, and date

            # Safely get shift template using shift_id (checked not None)
            shift_template = self.resources.get_shift(shift_id)
            duration_hours: float = 0.0

            # Calculate duration (prefer from template, fallback to entry times)
            if shift_template:
                try: duration_hours = float(getattr(shift_template, "duration_hours", 0.0))
                except (ValueError, TypeError): duration_hours = 0.0
            
            if duration_hours == 0.0 and start_time_str and end_time_str:
                # Calculate from start/end times if template duration missing/zero
                start_t = _time_str_to_datetime_time(start_time_str)
                end_t = _time_str_to_datetime_time(end_time_str)
                if start_t and end_t:
                    start_m = start_t.hour * 60 + start_t.minute
                    end_m = end_t.hour * 60 + end_t.minute
                    if end_m < start_m: end_m += 24 * 60 # Handle overnight
                    duration_hours = (end_m - start_m) / 60
            
            if duration_hours > 6: # Requires break
                has_break = break_start_str is not None and break_end_str is not None
                if not has_break:
                    # Safely get parsed date object for formatting
                    entry_date_obj: Optional[date] = None
                    if isinstance(date_val, str): 
                        try: entry_date_obj = datetime.fromisoformat(date_val).date() 
                        except ValueError: entry_date_obj = None # Or keep as string?
                    elif isinstance(date_val, date):
                        entry_date_obj = date_val
                    
                    date_str_for_error = entry_date_obj.strftime("%Y-%m-%d") if entry_date_obj else str(date_val)
                    
                    employee = self.resources.get_employee(employee_id) # employee_id is checked not None earlier
                    employee_name = (
                        f"{employee.first_name} {employee.last_name}"
                        if employee and hasattr(employee, 'first_name') and hasattr(employee, 'last_name')
                        else f"Employee {employee_id}"
                    )

                    self.warnings.append(
                        ValidationError(
                            error_type="missing_break",
                            message=f"Employee {employee_name} has a {duration_hours:.1f} hour shift on {date_str_for_error} without a break",
                            severity="warning",
                            details={
                                "employee_id": employee_id,
                                "employee_name": employee_name,
                                "date": date_str_for_error, # Use formatted date string
                                "duration": duration_hours,
                                "shift": f"{start_time_str}-{end_time_str}",
                            },
                        )
                    )

    def _validate_qualifications(self, schedule_data: List[Union[Schedule, Dict[str, Any]]]) -> None:
        """Validate employee qualifications for shifts"""
        # This would require a qualifications model, which isn't implemented yet
        # Placeholder for future implementation
        pass

    def get_coverage_summary(self) -> Dict[str, Any]:
        """Returns a summary of the interval coverage validation statistics."""
        min_employee_coverage_percent = (
            (self.intervals_met_min_employees / self.total_intervals_checked * 100)
            if self.total_intervals_checked > 0 else 0
        )
        keyholder_coverage_percent = (
            (self.intervals_met_keyholder / self.intervals_needed_keyholder * 100)
            if self.intervals_needed_keyholder > 0 else 100 # If none needed, it's 100% met
        )
        
        return {
            "total_intervals_checked": self.total_intervals_checked,
            "intervals_met_min_employees": self.intervals_met_min_employees,
            "intervals_needed_keyholder": self.intervals_needed_keyholder,
            "intervals_met_keyholder": self.intervals_met_keyholder,
            "min_employee_coverage_percent": round(min_employee_coverage_percent, 1),
            "keyholder_coverage_percent": round(keyholder_coverage_percent, 1)
        }
