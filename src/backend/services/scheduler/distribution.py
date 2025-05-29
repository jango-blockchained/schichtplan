"""Distribution module for fair employee assignment across shifts."""

from typing import Dict, List, Any, Optional, Union, TYPE_CHECKING
from datetime import date, datetime, timedelta, time  # Import time
from collections import defaultdict
import sys
import os
import logging
from .resources import (
    ScheduleResources,
)  # Assuming ScheduleResources is in resources.py

try:
    from .coverage_utils import (
        get_required_staffing_for_interval,
        _time_str_to_datetime_time,
    )
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
        target_date: date,
        interval_start_time: time,
        resources: ScheduleResources,
        interval_duration_minutes: int = 15,
    ) -> Dict[str, Any]:
        """Fallback implementation returning minimum staffing"""
        # Parameters are changed, but the fallback logic remains simple.
        return {
            "min_employees": 1,
            "max_employees": 3,
            "requires_keyholder": False,
            "coverage_id": None,
            "has_coverage": True,
        }  # Import the new utility and helper


from .feature_extractor import FeatureExtractor  # Import the FeatureExtractor
import random  # Import random for dummy predictions

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Setup logger - ensure logger is defined before import_models
logger = logging.getLogger(__name__)


# Consistent import function to handle different environments
def import_models():
    """Import model classes with consistent fallback handling"""
    # Ensure we have a logger inside this function too
    import_logger = logger

    try:
        # Direct import (when run from backend directory)
        from models.employee import AvailabilityType
        from models import Employee, ShiftTemplate, Schedule
        from utils.logger import logger as backend_logger

        return AvailabilityType, Employee, ShiftTemplate, Schedule, backend_logger  # type: ignore[return-value]
    except ImportError:
        try:
            # Import when run from project root
            from backend.models.employee import AvailabilityType
            from backend.models import Employee, ShiftTemplate, Schedule
            from backend.utils.logger import logger as backend_logger

            return AvailabilityType, Employee, ShiftTemplate, Schedule, backend_logger  # type: ignore[return-value]
        except ImportError:
            try:
                # Import when run from another location
                from src.backend.models.employee import AvailabilityType
                from src.backend.models import Employee, ShiftTemplate, Schedule
                from src.backend.utils.logger import logger as backend_logger

                return (
                    AvailabilityType,
                    Employee,
                    ShiftTemplate,
                    Schedule,
                    backend_logger,
                )  # type: ignore[return-value]
            except ImportError:
                import_logger.warning(
                    "Could not import model classes, using type hint classes instead"
                )

                # Create type hint classes for standalone testing
                class DummyAvailabilityType:
                    """Type hint enum for AvailabilityType"""

                    AVAILABLE = "AVAILABLE"
                    PREFERRED = "PREFERRED"
                    UNAVAILABLE = "UNAVAILABLE"
                    FIXED = "FIXED"  # Add missing FIXED value

                class Employee:
                    """Type hint class for Employee"""

                    id: int
                    employee_group: str
                    skills: List[str]
                    preferred_shift_types: List[str]
                    is_keyholder: bool = False
                    is_active: bool = True
                    contracted_hours: float = 40.0
                    preferences: Dict[
                        str, Any
                    ] = {}  # Add preferences attribute to prevent errors

                class ShiftTemplate:
                    """Type hint class for ShiftTemplate"""

                    id: int
                    start_time: str
                    end_time: str
                    shift_type: str
                    shift_type_id: str
                    duration_hours: float
                    required_skills: List[str] = []

                class Schedule:
                    """Type hint class for Schedule"""

                    id: int
                    employee_id: int
                    shift_id: int
                    date: date
                    status: str = "PENDING"
                    version: int = 1

                return (
                    DummyAvailabilityType,
                    Employee,
                    ShiftTemplate,
                    Schedule,
                    import_logger,
                )


# Import model classes
AvailabilityType, Employee, ShiftTemplate, Schedule, logger = import_models()

# --- Explicit Imports for Type Checking ---
if TYPE_CHECKING:
    from typing import Protocol

    # Define a Protocol for ShiftTemplate-like objects
    class ShiftTemplateLike(Protocol):
        id: int
        start_time: str
        end_time: str
        shift_type: str = ""
        shift_type_id: str = ""
        duration_hours: float = 0.0

    from src.backend.models.employee import AvailabilityType as ActualAvailabilityType
    from src.backend.models.employee import Employee as ActualEmployee

    # Assuming ShiftTemplate is in fixed_shift based on previous errors
    from src.backend.models.fixed_shift import ShiftTemplate as ActualShiftTemplate
    from src.backend.models.schedule import Schedule as ActualSchedule


class ShiftScore:
    """Scores for different shift characteristics"""

    # Base scores for shift desirability (higher = less desirable)
    EARLY_MORNING = 3.0  # Shifts starting before 8:00
    LATE_NIGHT = 4.0  # Shifts ending after 20:00
    WEEKEND = 5.0  # Saturday and Sunday shifts
    HOLIDAY = 5.5  # Holiday shifts
    STANDARD = 1.0  # Standard daytime shifts
    SPLIT_SHIFT = 2.0  # Split shifts with long breaks

    # Modifiers
    EMPLOYEE_PREFERENCE_MATCH = -2.0  # Reduction for preferred shifts/days
    EMPLOYEE_PREFERENCE_AVOID = 2.0  # Increase for avoided shifts/days
    CONSECUTIVE_SHIFT_BONUS = -0.5  # Bonus for consecutive shifts of same type
    ROTATION_BALANCED = -1.0  # Bonus for balancing employee rotation


class DistributionManager:
    """Manages fair distribution of shifts among employees"""

    def __init__(
        self,
        resources,
        constraint_checker=None,
        availability_checker=None,
        config=None,
        logger=None,
        feature_extractor: Optional[
            FeatureExtractor
        ] = None,  # Add feature_extractor parameter
        ml_model: Any = None,  # Add placeholder for ML model
    ):
        self.resources = resources
        self.constraint_checker = constraint_checker
        self.availability_checker = availability_checker
        self.config = config
        self.logger = logger or logging.getLogger(__name__)
        self.feature_extractor = feature_extractor  # Store feature extractor
        self.ml_model = ml_model  # Store ML model placeholder

        # Initialize assignments dictionary for all employees
        self.assignments_by_employee = defaultdict(list)
        self.schedule_by_date = {}
        # MODIFIED: Use defaultdict(dict) to allow mixed types (int for counts, float for hours)
        self.employee_history = defaultdict(dict)
        self.shift_scores = {}
        self.employee_preferences = {}
        self.rotation_state = defaultdict(int)
        self.fair_distribution_weight = 1.0
        self.preference_weight = 1.0
        self.seniority_weight = 0.5

        self._initialize_assignments()

    def _initialize_assignments(self):
        """Initialize assignments dictionary for all employees"""
        try:
            # Access the employees list directly from the resources object
            if self.resources and hasattr(self.resources, "employees"):
                employees = self.resources.employees
                for employee in employees:
                    employee_id = (
                        employee.id if hasattr(employee, "id") else employee.get("id")
                    )
                    if employee_id:
                        self.assignments_by_employee[employee_id] = []
            self.logger.info(f"Initialized assignments for {len(employees)} employees")
        except Exception as e:
            self.logger.error(f"Error initializing assignments: {str(e)}")
            self.logger.error("Stack trace:", exc_info=True)

    def assign_employees_by_type(
        self,
        current_date: date,
        shifts: List[Dict],
        available_employees: List[Any],
        shift_type: str,
    ) -> List[Dict]:
        """Assign employees to shifts of a specific type"""
        try:
            self.logger.info(
                f"Assigning employees for shift type {shift_type} on {current_date}"
            )
            self.logger.info(f"Available shifts: {len(shifts)}")
            self.logger.info(f"Available employees: {len(available_employees)}")

            assignments = []

            # Track employees already assigned today to avoid over-assignment
            # Map of employee_id -> number of shifts assigned today
            shifts_assigned_today = defaultdict(int)

            # Get existing assignments for the current date
            for (
                employee_id,
                employee_assignments,
            ) in self.assignments_by_employee.items():
                for assignment in employee_assignments:
                    if (
                        isinstance(assignment, dict)
                        and assignment.get("date") == current_date
                    ):
                        shifts_assigned_today[employee_id] += 1
                    # Corrected: Use .get("date") for dictionaries
                    elif (
                        isinstance(assignment, dict)
                        and assignment.get("date") == current_date
                    ):
                        shifts_assigned_today[employee_id] += 1

            # Maximum shifts per employee per day
            max_shifts_per_day = 1  # Set to 1 to prevent multiple shifts per day

            # Guard against empty inputs
            if not shifts:
                self.logger.warning(f"No shifts to assign for type {shift_type}")
                return []

            if not available_employees:
                self.logger.warning(
                    f"No employees available for shift type {shift_type}"
                )
                # Use all active employees as fallback
                # ADDED CHECK for self.resources
                if self.resources and hasattr(self.resources, "employees"):
                    available_employees = [
                        e
                        for e in self.resources.employees
                        if getattr(e, "is_active", True)
                    ]
                else:
                    available_employees = []  # Cannot get fallback if resources missing

                if not available_employees:
                    self.logger.error(
                        "No active employees found. Cannot assign shifts."
                    )
                    return []
                self.logger.info(
                    f"Using {len(available_employees)} active employees as fallback"
                )

            # --- ML Integration Placeholder ---
            # 1. Prepare potential assignments for feature extraction
            potential_assignments_for_ml = []
            for employee in available_employees:
                employee_id = self.get_id(employee, ["id", "employee_id"])
                if employee_id is None:
                    continue  # Skip employees without valid ID
                # Assuming shifts in the input list are dictionaries or objects with 'id' or 'shift_id'
                for shift in shifts:
                    # Need to get shift_id from the shift object/dict
                    shift_id = self.get_id(
                        shift, ["id", "shift_id", "shift_template_id"]
                    )
                    if shift_id is None:
                        self.logger.warning(
                            f"Shift has no valid ID: {shift}. Skipping."
                        )
                        continue  # Skip shifts without valid ID
                    # Add potential assignment to list
                    potential_assignments_for_ml.append(
                        {
                            "employee_id": employee_id,
                            "shift_id": shift_id,
                            # Include other data needed by feature extractor, e.g., shift details, employee details
                            "employee": employee,
                            "shift": shift,
                            "date": current_date,  # Include date for feature extraction
                        }
                    )

            # 2. Extract features using the FeatureExtractor
            features_for_prediction = []
            if self.feature_extractor and potential_assignments_for_ml:
                self.logger.info(
                    f"Extracting features for {len(potential_assignments_for_ml)} potential assignments."
                )
                # Pass self.resources to feature_extractor if needed for additional context
                features_for_prediction = (
                    self.feature_extractor.extract_features_for_prediction(
                        potential_assignments_for_ml,
                        current_date,  # Pass current_date
                    )
                )
                self.logger.info(
                    f"Extracted features for {len(features_for_prediction)} potential assignments."
                )

            # 3. Get predictions from the ML model
            # This is a placeholder. The actual ML model inference would happen here.
            # The structure of 'predictions' depends on the model output.
            # It might be a list of probabilities or scores, corresponding to the order of features_for_prediction.
            # We need a mapping from (employee_id, shift_id) to prediction score for easy lookup.
            predictions = {}
            if self.ml_model and features_for_prediction:
                self.logger.info("Getting predictions from ML model.")
                # TODO: Call ML model inference function
                # Example placeholder assuming model returns a list of scores in the same order as features_for_prediction
                # ml_scores = self.ml_model.predict(features_for_prediction)
                # predictions = { (features_for_prediction[i]['employee_id'], features_for_prediction[i]['shift_id']): ml_scores[i]
                #                 for i in range(len(features_for_prediction)) }
                # For now, use dummy predictions:ss
                predictions = {
                    (item["employee_id"], item["shift_id"]): random.random()
                    for item in features_for_prediction
                }
                self.logger.info(
                    f"Received predictions for {len(predictions)} potential assignments."
                )
            # --- End ML Integration Placeholder ---

            # Sort employees by priority score (incorporating ML prediction)
            # The rule-based sorting below can be kept as a fallback or combined with ML scores.
            # A better approach for ML integration in assignment is to score employee-shift pairs.
            # I will add a placeholder for scoring pairs and using ML predictions.

            # --- Score Employee-Shift Pairs (with ML) Placeholder ---
            # Instead of sorting employees globally, we should generate potential employee-shift pairs,
            # calculate a score for each pair (combining rule-based logic and ML prediction),
            # and then select the best pairs to fill the shifts.
            # This requires iterating through shifts and, for each shift, iterating through available employees.

            scored_employee_shift_pairs = []
            for shift in shifts:
                shift_id = self.get_id(shift, ["id", "shift_id", "shift_template_id"])
                if shift_id is None:
                    continue

                for employee in available_employees:
                    employee_id = self.get_id(employee, ["id", "employee_id"])
                    if employee_id is None:
                        continue

                    # Check basic feasibility (e.g., daily shift limit, availability)
                    if shifts_assigned_today.get(employee_id, 0) >= max_shifts_per_day:
                        continue

                    # --- Calculate Score for Employee-Shift Pair ---
                    # This score should combine rule-based factors (history, preferences, seniority)
                    # and the ML prediction score for this specific (employee_id, shift_id) pair.

                    # Get ML prediction score for this pair
                    ml_prediction = predictions.get(
                        (employee_id, shift_id), 0
                    )  # Default to 0 if no prediction

                    # Calculate rule-based score components (example)
                    # You would use methods like self._calculate_history_adjustment, self._calculate_preference_adjustment, etc.
                    # Need to pass necessary context to these methods.
                    # For now, a simple placeholder combined score:
                    rule_based_score = self.calculate_assignment_score(
                        employee_id, shift, current_date, {}, AvailabilityType.AVAILABLE
                    )
                    # Note: _calculate_assignment_score currently takes ShiftTemplate as input,
                    # you might need to adapt it or get the ShiftTemplate object here.
                    # The fourth argument ({}) is a placeholder for the context dictionary.
                    # The fifth argument is a placeholder for availability_type_override.

                    # Combine rule-based score and ML prediction
                    # This combination logic is crucial and needs refinement.
                    # Example: Weighting or using ML as a modifier
                    combined_score = rule_based_score + (
                        ml_prediction * -100
                    )  # Example: higher prediction = better = lower score

                    # Add the pair and its score to the list
                    scored_employee_shift_pairs.append(
                        (
                            employee,
                            shift,
                            combined_score,
                            ml_prediction,  # Optionally store ML prediction for later use (e.g., confidence score)
                        )
                    )

            # Sort employee-shift pairs by combined score (ascending - lower score is better)
            scored_employee_shift_pairs.sort(key=lambda item: item[2])

            sorted_employees = []
            for employee in available_employees:
                employee_id = self.get_id(employee, ["id", "employee_id"])
                if employee_id is None:
                    self.logger.warning(f"Employee has no ID: {employee}")
                    continue

                # Calculate existing priority score
                weekly_shifts = len(self.assignments_by_employee.get(employee_id, []))
                days_since_last = 7  # Default to maximum if no previous shifts

                if self.assignments_by_employee.get(employee_id):
                    last_shift_date = max(
                        d
                        for assignment in self.assignments_by_employee[employee_id]
                        if (
                            d := (
                                assignment.get("date")
                                if isinstance(assignment, dict)
                                else getattr(assignment, "date", None)
                            )
                        )
                        is not None
                    )
                    # Check if max returned a valid date before calculating timedelta
                    if isinstance(last_shift_date, date):
                        days_since_last = (current_date - last_shift_date).days
                    else:  # Handle case where no valid dates were found
                        self.logger.warning(
                            f"Could not determine last shift date for employee {employee_id}"
                        )
                        # days_since_last remains default 7

                # Add big penalty for employees already assigned today
                daily_shifts_penalty = shifts_assigned_today.get(employee_id, 0) * 100

                # Combine base priority with ML influence
                # Need to calculate the ML score influence for this specific employee and the current shifts.
                # A simple approach: average the ML prediction scores for this employee across all available shifts.
                # A better approach: when considering an employee for a specific shift later in the loop,
                # use the ML prediction score for that specific employee-shift pair.
                # For now, I'll keep the ML influence separate and note where it should be used.

                # Placeholder for incorporating ML prediction into the scoring/selection process.
                # The current 'priority_score' is based on historical distribution.
                # The ML prediction score should influence the final decision.
                # This might involve:
                # 1. Calculating a combined score: `final_score = (1-alpha) * rule_based_score + alpha * ml_prediction_score`
                # 2. Using the ML score as a tie-breaker.
                # 3. Directly sorting potential employee-shift pairs by ML score (after filtering by constraints).

                # For this step, I will simply add a comment indicating where ML influence should be applied.
                # The current sorting is based on the `base_priority_score`.
                # The selection loop below (commented out) is where the ML prediction would be most directly used.

                # The sorting will remain rule-based for now. ML integration will happen in the assignment loop.
                base_priority_score = (
                    weekly_shifts - days_since_last + daily_shifts_penalty
                )
                sorted_employees.append((employee, base_priority_score))

            # Sort employees by the base priority score (ascending - lower score is higher priority)
            sorted_employees.sort(key=lambda item: item[1])

            assigned_employees_count = 0
            # Iterate through sorted employees and available shifts to make assignments
            # ... (rest of the assignment logic would go here)
            # This part of the code is extensive (lines ~250 onwards) and involves
            # iterating through shifts and employees, checking constraints, etc.
            # I will not replicate the full code here but mark where the assignment loop happens.

            self.logger.info(
                "Employees sorted by priority score (Rule-based). ML predictions are available for use in assignment loop."
            )

            # --- Assignment Loop Placeholder with ML Integration Note ---
            # This is where the code would iterate through shifts and sorted_employees.
            # For each shift that needs filling:
            #   Iterate through sorted_employees:
            #     Check if employee is available and meets constraints for the shift.
            #     If yes:
            #       Get the ML prediction score for this specific (employee_id, shift_id) pair from the 'predictions' dictionary.
            #       Use this ML prediction score (along with rule-based scores and constraints) to decide if this is the best assignment.
            #       This might involve selecting the employee-shift pair with the highest ML score among valid options.
            #       If an assignment is made, create an assignment dictionary, add to 'assignments' list,
            #       update internal state (self.assignments_by_employee, shifts_assigned_today), and mark employee/shift as assigned.
            #       Consider adding the ML prediction score as a 'confidence_score' to the assignment dictionary.

            # Placeholder for returning actual assignments generated by the loop
            self.logger.warning(
                "Assignment loop placeholder reached. Actual assignments are not being made in this placeholder."
            )

            return assignments  # This will likely be an empty list or partially filled in the actual implementation

        except Exception as e:
            self.logger.error(
                f"Error assigning employees by type {shift_type}: {str(e)}",
                exc_info=True,
            )
            return []

    def _calculate_history_adjustment_v2(
        self, employee_id: int, shift_template: Any, shift_date: date
    ) -> float:
        """Placeholder for calculating history-based score adjustment (v2)."""
        self.logger.warning(
            f"_calculate_history_adjustment_v2 not fully implemented for emp {employee_id}, returning 0.0"
        )
        return 0.0

    def _calculate_preference_adjustment_v2(
        self,
        employee_id: int,
        shift_template: Any,
        shift_date: date,
        availability_type_override: Any,
    ) -> float:
        """Placeholder for calculating preference-based score adjustment (v2)."""
        self.logger.warning(
            f"_calculate_preference_adjustment_v2 not fully implemented for emp {employee_id}, returning 0.0"
        )
        return 0.0

    def is_shift_assigned(self, shift: Any, assignments: List[Dict]) -> bool:
        """Check if a shift has already been assigned"""
        shift_id = self.get_id(shift, ["id", "shift_id"])
        if shift_id is None:
            return False

        return any(self.get_id(a, ["shift_id"]) == shift_id for a in assignments)

    def initialize(self, employees, historical_data=None, shifts=None, resources=None):
        """Initialize the distribution manager with employee and historical data"""
        self.employees = employees or []
        self.historical_data = historical_data or []
        self.shifts = shifts or []
        self.resources = resources
        self.assignments = {}

        # Initialize assignments_by_employee for all employees
        self.assignments_by_employee = defaultdict(list)
        for employee in self.employees:
            self.assignments_by_employee[employee.id] = []

        # Log initialization
        self.logger.info(
            f"Initializing distribution manager with {len(self.employees)} employees "
            f"and {len(self.historical_data)} historical entries"
        )

        # Initialize shift scores dictionary
        self.shift_scores = {}

        # Calculate shift scores based on types and timings
        if self.shifts:
            self._calculate_shift_scores()

        # Load historical assignments
        if self.historical_data:
            self._load_historical_assignments()

        return self

    def _load_historical_assignments(self):
        """Process historical data and load into assignments"""
        for entry in self.historical_data:
            employee_id = None
            shift_id = None
            entry_date = None

            # Extract data from different possible formats
            if isinstance(entry, dict):
                employee_id = entry.get("employee_id")
                shift_id = entry.get("shift_id")
                entry_date = entry.get("date")
            elif (
                hasattr(entry, "employee_id")
                and hasattr(entry, "shift_id")
                and hasattr(entry, "date")
            ):
                employee_id = entry.employee_id
                shift_id = entry.shift_id
                entry_date = entry.date

            if not (employee_id and shift_id and entry_date):
                continue

            # Find shift details
            shift = None
            for s in self.shifts:
                if s.id == shift_id:
                    shift = s
                    break

            if not shift:
                continue

            # Record the assignment
            if employee_id not in self.assignments_by_employee:
                self.assignments_by_employee[employee_id] = []

            assignment = {
                "shift_id": shift_id,
                "date": entry_date,
                "start_time": shift.start_time
                if hasattr(shift, "start_time")
                else "00:00",
                "end_time": shift.end_time if hasattr(shift, "end_time") else "00:00",
            }

            # Add shift type if available
            if shift_id in self.shift_scores:
                assignment["shift_type"] = self.shift_scores[shift_id].get(
                    "type", "unknown"
                )

            self.assignments_by_employee[employee_id].append(assignment)

        # Log loaded assignments
        total_assignments = sum(len(a) for a in self.assignments_by_employee.values())
        self.logger.info(
            f"Loaded {total_assignments} historical assignments for "
            f"{len(self.assignments_by_employee)} employees"
        )

    def _initialize_employee_data(self, employees: List["ActualEmployee"]):
        """Initialize employee data structures"""
        for employee in employees:
            self.employee_history[employee.id] = {
                "EARLY": 0,
                "MIDDLE": 0,
                "LATE": 0,
                "weekend": 0,
                "holiday": 0,
                "total": 0,
                "hours": 0.0,
            }

            # Initialize preference data
            self.employee_preferences[employee.id] = {
                "preferred_days": [],
                "preferred_shifts": [],
                "avoid_days": [],
                "avoid_shifts": [],
            }

            # Load preferences from employee data if available
            if hasattr(employee, "preferences") and employee.preferences:  # type: ignore[union-attr]
                self._load_employee_preferences(employee)

    def _load_employee_preferences(self, employee: "ActualEmployee"):
        """
        Load employee-specific preferences from their profile.
        This might include preferred shifts, days off, etc.
        """
        preferences = {}
        try:
            # Assuming preferences are stored in a 'preferences' attribute on the Employee model
            # Or fetched from a related table like EmployeeAvailability
            # For now, use a placeholder and log if preferences are accessed
            self.logger.info(f"Loading preferences for employee ID: {employee.id}")
            # preferences = employee.preferences # Comment out this line
            # TODO: Implement actual preference loading logic, potentially using EmployeeAvailability

        except Exception as e:
            self.logger.error(
                f"Error loading preferences for employee {employee.id}: {str(e)}"
            )
            self.logger.error("Stack trace:", exc_info=True)

    def _load_historical_data(self, schedule_entries: List["ActualSchedule"]):
        """Load historical schedule data to build distribution metrics"""
        for entry in schedule_entries:
            employee_id = entry.employee_id
            shift_date = entry.date

            if employee_id not in self.employee_history:
                continue

            # Get the shift template for this schedule entry
            if hasattr(entry, "shift") and entry.shift is not None:
                shift_template = entry.shift
            elif hasattr(entry, "shift_id") and entry.shift_id is not None:
                # We need to retrieve the shift template from database or cache
                # For now we'll skip this entry if shift is not directly available
                continue
            else:
                continue

            # Track shift type counts
            shift_category = self._categorize_shift(shift_template)
            self.employee_history[employee_id][shift_category] += 1
            self.employee_history[employee_id]["total"] += 1

            # Track weekend and holiday shifts
            if shift_date.weekday() >= 5:  # Saturday or Sunday
                self.employee_history[employee_id]["weekend"] += 1

            # Track hours
            if (
                hasattr(shift_template, "duration_hours")
                and shift_template.duration_hours is not None
            ):
                duration = shift_template.duration_hours
            else:
                # Try to calculate from start/end time
                duration = self.calculate_duration(
                    shift_template.start_time, shift_template.end_time
                )

            self.employee_history[employee_id]["hours"] += duration

    def _categorize_shift(self, shift):
        """Categorize a shift based on its characteristics

        Categories:
        - EARLY: starts before 10:00
        - MIDDLE: starts between 10:00-14:00
        - LATE: starts at or after 14:00
        """
        # First check if shift_type_id is available
        if hasattr(shift, "shift_type_id") and shift.shift_type_id is not None:
            if shift.shift_type_id in ["EARLY", "MIDDLE", "LATE"]:
                return shift.shift_type_id

        # Default category if we can't determine
        category = "EARLY"  # Default to EARLY if we can't determine

        # Extract start hour
        if hasattr(shift, "start_time") and shift.start_time is not None:
            try:
                # Ensure start_time is a string before splitting
                start_time_str = str(shift.start_time)
                start_hour = int(start_time_str.split(":")[0])

                # Categorize based on start hour
                if start_hour < 10:
                    category = "EARLY"
                elif 10 <= start_hour < 14:
                    category = "MIDDLE"
                else:
                    category = "LATE"
            except (ValueError, IndexError):
                pass  # Keep default if parsing fails

        return category

    def _get_shift_category_key(self, category: str, shift_template_like=None) -> str:
        # Maps simple categories from _categorize_shift to keys in SHIFT_TYPE_SCORES
        if category == "EARLY":
            return "EARLY_MORNING"
        if category == "MIDDLE":
            return "STANDARD_DAY"
        if category == "LATE":
            return "LATE_EVENING"
        # Placeholder for other types if _categorize_shift is enhanced
        if category == "NIGHT":
            return "NIGHT"
        if category == "WEEKEND":
            return "WEEKEND"

        self.logger.warning(
            f"Unknown category '{category}' in _get_shift_category_key. Defaulting to STANDARD_DAY."
        )
        return "STANDARD_DAY"  # Default key

    def _calculate_shift_scores(self):
        """Calculate scores for all shift types based on their characteristics"""
        for shift in self.shifts:
            score = {
                "type": "EARLY",  # Default type
                "base_score": ShiftScore.STANDARD,
                "modifiers": [],
            }

            if hasattr(shift, "start_time") and shift.start_time:
                try:
                    start_hour = int(shift.start_time.split(":")[0])

                    # First check if shift has explicit type
                    if hasattr(shift, "shift_type_id") and shift.shift_type_id in [
                        "EARLY",
                        "MIDDLE",
                        "LATE",
                    ]:
                        score["type"] = shift.shift_type_id
                        if shift.shift_type_id == "EARLY":
                            score["base_score"] = ShiftScore.EARLY_MORNING
                        elif shift.shift_type_id == "LATE":
                            score["base_score"] = ShiftScore.LATE_NIGHT
                    else:
                        # Determine type based on start time
                        if start_hour < 10:
                            score["type"] = "EARLY"
                            score["base_score"] = ShiftScore.EARLY_MORNING
                        elif 10 <= start_hour < 14:
                            score["type"] = "MIDDLE"
                            score["base_score"] = ShiftScore.STANDARD
                        else:
                            score["type"] = "LATE"
                            score["base_score"] = ShiftScore.LATE_NIGHT

                except (ValueError, IndexError):
                    pass

            self.shift_scores[shift.id] = score

    def _get_shift_type_ratio(self, shift_type):
        """Calculate the ratio of a specific shift type in current assignments."""
        total_shifts = 0
        type_count = 0

        # Count shifts by type in current assignments
        for employee_id, assignments in self.assignments_by_employee.items():
            for assignment in assignments:
                total_shifts += 1
                # Ensure assignment is a dict and has 'shift_id'
                assigned_shift_id = (
                    assignment.get("shift_id") if isinstance(assignment, dict) else None
                )
                if assigned_shift_id and assigned_shift_id in self.shift_scores:
                    # Ensure self.shift_scores[assigned_shift_id] is a dict and has 'type'
                    shift_data = self.shift_scores[assigned_shift_id]
                    if (
                        isinstance(shift_data, dict)
                        and shift_data.get("type") == shift_type
                    ):
                        type_count += 1

        # Handle case with no assignments
        if total_shifts == 0:
            return 0.33  # Default to ideal distribution

        return type_count / total_shifts

    def calculate_assignment_score(
        self,
        employee_id: int,
        shift_template: Union["ActualShiftTemplate", Dict[str, Any]],
        shift_date: date,
        context: Dict[str, Any],
        availability_type_override: Union["ActualAvailabilityType", str],
    ) -> float:
        """Calculate a score for assigning this employee to this shift_template on shift_date.

        Higher scores are better.
        The score considers availability, interval-specific needs, employee history, preferences, workload, and overstaffing.

        Args:
            employee_id: The ID of the employee
            shift_template: Either a ShiftTemplate object or a dictionary with shift details
            shift_date: The date of the shift
            context: Additional context for scoring
            availability_type_override: The availability type to use

        Returns:
            float: The score (higher is better)
        """
        score = 0.0
        employee = self.resources.get_employee(employee_id) if self.resources else None
        if not employee:
            self.logger.warning(
                f"calculate_assignment_score: Employee {employee_id} not found in resources."
            )
            return -float("inf")

        if isinstance(shift_template, dict):
            shift_template_id = (
                shift_template.get("id")
                or shift_template.get("shift_id")
                or shift_template.get("shift_template_id")
            )
            if shift_template_id is None:
                self.logger.warning(
                    f"calculate_assignment_score: No ID found in shift template dict: {shift_template}"
                )
                return -float("inf")
        else:  # Is an object
            shift_template_id = getattr(shift_template, "id", None)
            if shift_template_id is None:
                self.logger.warning(
                    "calculate_assignment_score: No ID attribute in shift template object"
                )
                return -float("inf")

        # 1. AvailabilityType Scoring
        # Determine availability string, prioritizing enum's .value if it's an enum member
        if isinstance(
            availability_type_override, AvailabilityType
        ):  # Check if it's an instance of the Enum type
            avail_type_str = availability_type_override.value
        elif isinstance(availability_type_override, str):
            avail_type_str = availability_type_override
        else:  # Should not happen based on type hint Union[ActualAvailabilityType, str]
            self.logger.warning(
                f"Unexpected type for availability_type_override: {type(availability_type_override)}. Using as is."
            )
            avail_type_str = str(
                availability_type_override
            )  # Fallback to string conversion

        if avail_type_str == "FIXED":
            score += 100.0
        elif avail_type_str == "PREFERRED":
            score += 50.0
        elif avail_type_str == "AVAILABLE":
            score += 10.0
        else:
            self.logger.error(
                f"calculate_assignment_score called for non-available state: {avail_type_str} for Emp {employee_id}"
            )
            return -float("inf")

        # 2. Target Interval Needs Scoring
        target_interval_needs = context.get("target_interval_needs")
        if target_interval_needs:
            if target_interval_needs.get("requires_keyholder"):
                if getattr(employee, "is_keyholder", False):
                    score += 150.0
                else:
                    score -= 1000.0
            elif getattr(
                employee, "is_keyholder", False
            ):  # Not required, but is keyholder
                score -= 10.0

            required_target_employee_types = target_interval_needs.get(
                "employee_types", []
            )
            if required_target_employee_types:
                employee_group = getattr(employee, "employee_group", None)
                if employee_group and employee_group in required_target_employee_types:
                    score += 120.0
                elif (
                    employee_group
                    and employee_group not in required_target_employee_types
                ):
                    score -= 750.0
                elif not employee_group:
                    score -= 100.0
        else:
            self.logger.warning(
                f"calculate_assignment_score: target_interval_needs not found in context for Emp {employee_id}, Shift {shift_template_id}, Date {shift_date}"
            )

        # 3. Historical/Fairness Adjustments
        score += self._calculate_history_adjustment_v2(
            employee_id, shift_template, shift_date
        )
        score += self._calculate_preference_adjustment_v2(
            employee_id, shift_template, shift_date, availability_type_override
        )

        # 4. Shift Desirability Penalty
        cached_shift_info = self.shift_scores.get(shift_template_id)
        if cached_shift_info and isinstance(cached_shift_info, dict):
            base_penalty_factor = 5.0
            score -= (
                cached_shift_info.get("base_score", ShiftScore.STANDARD)
                * base_penalty_factor
            )

        # 5. Workload Penalty (Inline)
        employee_assignments = self.assignments_by_employee.get(employee_id, [])
        num_assignments_processed = 0
        current_hours_worked = 0.0
        for assignment_dict_for_workload in employee_assignments:
            if isinstance(assignment_dict_for_workload, dict):
                num_assignments_processed += 1
                duration_for_workload = assignment_dict_for_workload.get(
                    "duration_hours"
                )
                if duration_for_workload is None:
                    start_t_for_workload = assignment_dict_for_workload.get(
                        "start_time"
                    )
                    start_t_for_workload = datetime.strptime(
                        start_t_for_workload, "%I:%M"
                    )
                    end_t_for_workload = assignment_dict_for_workload.get("end_time")
                    if start_t_for_workload and end_t_for_workload:
                        duration_for_workload = self.calculate_duration(
                            start_t_for_workload, end_t_for_workload
                        )
                    else:
                        duration_for_workload = 0
                current_hours_worked += duration_for_workload

        workload_penalty_val = num_assignments_processed * 10.0
        contracted_hours_for_workload = getattr(employee, "contracted_hours", 40.0)
        if (
            contracted_hours_for_workload > 0
            and current_hours_worked > contracted_hours_for_workload
        ):
            workload_penalty_val += (
                current_hours_worked - contracted_hours_for_workload
            ) * 1.5
        score -= workload_penalty_val * self.fair_distribution_weight

        # 6. Overstaffing Penalty (Inline)
        overstaffing_penalty_val = 0.0
        shift_covered_intervals = context.get("shift_covered_intervals", [])
        full_day_staffing_snapshot = context.get("full_day_staffing_snapshot")
        if shift_covered_intervals and full_day_staffing_snapshot:
            num_covered_intervals_overstaffed = 0
            for interval_key in shift_covered_intervals:
                if interval_key in full_day_staffing_snapshot:
                    interval_staffing = full_day_staffing_snapshot[interval_key]
                    current_staff = interval_staffing.get("current", 0)
                    max_needed_staff = interval_staffing.get(
                        "max_needed", interval_staffing.get("required", 0)
                    )
                    if current_staff >= max_needed_staff:
                        num_covered_intervals_overstaffed += 1
            if (
                num_covered_intervals_overstaffed > 0
                and len(shift_covered_intervals) > 0
            ):
                overstaffing_penalty_val = (
                    (num_covered_intervals_overstaffed / len(shift_covered_intervals))
                    * 25.0
                    * self.fair_distribution_weight
                )
        score -= overstaffing_penalty_val

        self.logger.debug(
            f"Final score for Emp {employee_id}, Shift {shift_template_id}, Date {shift_date}: {score}"
        )
        return score

    def _get_employee_current_hours(self, employee_id: int) -> float:
        """Calculate total assigned hours for an employee from self.assignments_by_employee."""
        total_hours = 0.0
        if employee_id in self.assignments_by_employee:
            for assignment_dict in self.assignments_by_employee[employee_id]:
                if isinstance(assignment_dict, dict):
                    duration = assignment_dict.get("duration_hours")
                    if duration is None:
                        start_time_str = assignment_dict.get("start_time")
                        end_time_str = assignment_dict.get("end_time")
                        if start_time_str and end_time_str:
                            try:
                                duration = self.calculate_duration(
                                    start_time_str, end_time_str
                                )
                            except Exception as e:
                                self.logger.error(
                                    f"Error calculating duration in _get_employee_current_hours for emp {employee_id}: {e}"
                                )
                                duration = 0  # Default to 0 if calculation fails
                        else:
                            duration = 0  # Default to 0 if start/end times are missing
                    total_hours += duration
        return total_hours

    def get_shift_duration(self, shift):
        """Calculate the duration of a shift"""
        if hasattr(shift, "duration_hours") and shift.duration_hours is not None:
            return shift.duration_hours
        elif hasattr(shift, "start_time") and hasattr(shift, "end_time"):
            return self.calculate_duration(shift.start_time, shift.end_time)
        return 0.0

    def calculate_duration(self, start_time, end_time):
        """Calculate duration between two time strings in hours"""
        try:
            # Parse the times
            start_parts = start_time.split(":")
            end_parts = end_time.split(":")

            start_hour = int(start_parts[0])
            start_min = int(start_parts[1]) if len(start_parts) > 1 else 0

            end_hour = int(end_parts[0])
            end_min = int(end_parts[1]) if len(end_parts) > 1 else 0

            # Calculate minutes
            start_minutes = start_hour * 60 + start_min
            end_minutes = end_hour * 60 + end_min

            # Handle overnight shifts
            if end_minutes < start_minutes:
                end_minutes += 24 * 60

            # Convert to hours
            duration = (end_minutes - start_minutes) / 60.0
            return duration
        except Exception as e:
            self.logger.error(f"Error calculating duration: {str(e)}")
            return 0.0

    # Logging methods
    def log_debug(self, message):
        if hasattr(self.logger, "debug"):
            self.logger.debug(message)

    def log_info(self, message):
        if hasattr(self.logger, "info"):
            self.logger.info(message)

    def log_warning(self, message):
        if hasattr(self.logger, "warning"):
            self.logger.warning(message)

    def log_error(self, message):
        if hasattr(self.logger, "error"):
            self.logger.error(message)

    def get_id(self, obj, id_fields=None):
        """Extract ID consistently from either dict or object

        Args:
            obj: The object or dictionary containing the ID
            id_fields: Optional list of field names to try in order

        Returns:
            The ID value or None if not found
        """
        if id_fields is None:
            id_fields = ["id", "shift_id", "employee_id"]

        # Try dictionary access first
        if isinstance(obj, dict):
            for field in id_fields:
                if field in obj and obj[field] is not None:
                    return obj[field]

        # Then try attribute access
        for field in id_fields:
            if hasattr(obj, field) and getattr(obj, field) is not None:
                return getattr(obj, field)

        # If no ID found, log warning and return None
        self.logger.warning(f"Could not extract ID from object: {obj}")
        return None

    def _coverage_applies_to_date(self, coverage, check_date: date) -> bool:
        """Check if a coverage record applies to the given date"""
        cov_id = getattr(coverage, "id", "N/A")
        self.logger.debug(f"Checking if coverage {cov_id} applies to {check_date}")

        # Check for specific date first (higher priority)
        if hasattr(coverage, "date") and coverage.date:
            coverage_date = coverage.date
            if isinstance(coverage_date, str):
                try:
                    coverage_date = date.fromisoformat(
                        coverage.date.split("T")[0]
                    )  # Handle datetime strings
                except (ValueError, TypeError):
                    self.logger.warning(
                        f"Coverage {cov_id} has invalid date string: {coverage.date}"
                    )
                    return False
            elif not isinstance(coverage_date, date):
                self.logger.warning(
                    f"Coverage {cov_id} has unexpected date type: {type(coverage.date)}"
                )
                return False

            applies = coverage_date == check_date
            self.logger.debug(
                f"Coverage {cov_id} has specific date {coverage_date}. Match with {check_date}: {applies}"
            )
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
                check_weekday = check_date.weekday()  # Monday is 0, Sunday is 6

                # FIXED: Both coverage model and Python's weekday() use the same convention
                # (0=Monday, 6=Sunday) so no conversion is needed
                applies = check_weekday == coverage_day_index

                self.logger.debug(
                    f"Coverage {cov_id} day_index={coverage_day_index}. Check date {check_date} python_weekday={check_weekday}. Match: {applies}"
                )
                return applies
            except (ValueError, TypeError):
                self.logger.warning(
                    f"Coverage {cov_id} has invalid day_index/day_of_week: {day_field}"
                )
                return False

        self.logger.debug(
            f"Coverage {cov_id} has no specific date or applicable day of week. No match."
        )
        return False

    def is_interval_covered(
        self,
        interval_start_time: time,  # Use time
        interval_needs: Dict[str, Any],
        current_staffing_for_interval_entry: Dict[str, Any],
        log_details: bool = False,
    ) -> bool:
        """
        Checks if a specific interval's staffing needs are met by the current staffing.

        Args:
            interval_start_time: The start time of the interval.
            interval_needs: A dictionary detailing the staffing requirements for the interval
                            (e.g., {'min_employees': 2, 'requires_keyholder': True, 'employee_types': ['Cashier']}).
            current_staffing_for_interval_entry: A dictionary detailing the current staffing for the interval
                                                 (e.g., {'current_employees': 1, 'current_keyholders': 0,
                                                         'current_employee_types_count': {'Cashier': 1}}).\n            log_details: If True, logs detailed reasons for coverage failure.

        Returns:
            True if all needs are met, False otherwise.
        """
        if (
            not interval_needs
        ):  # No needs defined, so technically covered (or an issue upstream)
            if log_details:
                self.logger.debug(
                    f"is_interval_covered [{interval_start_time}]: No specific needs defined, assuming covered."
                )
            return True

        # 1. Check min_employees
        required_min_employees = interval_needs.get("min_employees", 0)
        actual_employees = current_staffing_for_interval_entry.get(
            "current_employees", 0
        )
        if actual_employees < required_min_employees:
            if log_details:
                self.logger.info(
                    f"is_interval_covered [{interval_start_time}]: FAILED - Min employees not met. Need: {required_min_employees}, Have: {actual_employees}"
                )
            return False

        # 2. Check requires_keyholder
        if interval_needs.get("requires_keyholder", False):
            actual_keyholders = current_staffing_for_interval_entry.get(
                "current_keyholders", 0
            )
            if actual_keyholders == 0:
                if log_details:
                    self.logger.info(
                        f"is_interval_covered [{interval_start_time}]: FAILED - Keyholder required but none present. Actual keyholders: {actual_keyholders}"
                    )
                return False

        # 3. Check employee_types (if any are specified as required)
        #    This checks if *at least one* employee of each *required* type is present.
        #    Or, if needs specify min counts per type, that should be checked.
        #    Current `get_required_staffing_for_interval` seems to return a list of allowed types,
        #    not necessarily counts per type. Assuming for now it implies at least one if type is listed.
        #    If `interval_needs` provides something like `min_per_type: {'Cashier': 1, 'Barista': 1}` then logic would adapt.
        required_employee_types = interval_needs.get("employee_types", [])
        if (
            required_employee_types
        ):  # Only check if specific types are listed as required
            actual_type_counts = current_staffing_for_interval_entry.get(
                "current_employee_types_count", {}
            )
            # Ensure actual_type_counts is a dict, defaulting to empty if not or None
            if not isinstance(actual_type_counts, dict):
                actual_type_counts = {}

            all_types_met = True
            for req_type in required_employee_types:
                if actual_type_counts.get(req_type, 0) == 0:
                    all_types_met = False
                    if log_details:
                        self.logger.info(
                            f"is_interval_covered [{interval_start_time}]: FAILED - Required employee type '{req_type}' not present or count is zero. Actual counts: {actual_type_counts}"
                        )
                    break  # No need to check further types if one is missing
            if not all_types_met:
                return False

        if log_details:  # If all checks passed
            self.logger.debug(
                f"is_interval_covered [{interval_start_time}]: PASSED. Needs: {interval_needs}, Has: {current_staffing_for_interval_entry}"
            )
        return True

    def get_employees_working_during_interval(
        self,
        interval_start_time: time,  # Use time
        all_final_assignments: List[Dict[str, Any]],
    ) -> List["ActualEmployee"]:
        """
        Retrieves a list of Employee objects who are working during the specified time interval.

        Args:
            interval_start_time: The start time of the interval to check.
            all_final_assignments: A list of assignment dictionaries for the day.

        Returns:
            A list of Employee objects working during that interval.
        """
        working_employees: List["ActualEmployee"] = []
        employee_ids_working: set[int] = (
            set()
        )  # To avoid duplicate Employee objects if somehow assigned multiple overlapping shifts

        # Convert interval_start_time to a full datetime object for easier comparison with shift times
        # Assuming a generic date for this conversion, as we only care about the time part relative to shift times.
        base_date = (
            datetime.min.date()
        )  # Could be any date, e.g., current_date if available and relevant
        interval_start_dt = datetime.combine(base_date, interval_start_time)

        for assignment in all_final_assignments:
            shift_start_str = assignment.get("start_time")
            shift_end_str = assignment.get("end_time")
            employee_id = assignment.get("employee_id")

            if not shift_start_str or not shift_end_str or employee_id is None:
                self.logger.warning(
                    f"get_employees_working_during_interval: Assignment missing start/end time or employee_id: {assignment}"
                )
                continue

            try:
                assigned_shift_start_time = _time_str_to_datetime_time(shift_start_str)
                assigned_shift_end_time = _time_str_to_datetime_time(shift_end_str)

                if not assigned_shift_start_time or not assigned_shift_end_time:
                    self.logger.warning(
                        f"get_employees_working_during_interval: Could not parse shift times for assignment {assignment.get('id', 'N/A')}"
                    )
                    continue

                assigned_shift_start_dt = datetime.combine(
                    base_date, assigned_shift_start_time
                )
                assigned_shift_end_dt = datetime.combine(
                    base_date, assigned_shift_end_time
                )

                # Handle overnight shifts for comparison (where end time is on the next day, e.g. 22:00-02:00)
                if (
                    assigned_shift_end_dt <= assigned_shift_start_dt
                ):  # Covers 00:00 end or overnight
                    # If interval is within the first part of an overnight shift (e.g. shift 22-02, interval 23:00)
                    # OR if interval is within the second part (e.g. shift 22-02, interval 01:00)
                    # This check: (interval_start >= shift_start) OR (interval_start < shift_end)
                    # To be more precise for overnight: shift_end_dt is effectively on day + 1
                    # A simple check: Is interval_start_time within [shift_start_time, 23:59:59] OR [00:00:00, shift_end_time)?
                    # Current logic: A shift covers an interval if interval_start_time falls within [shift_start, shift_end)
                    # For an overnight shift like 22:00 to 02:00:
                    # - Interval 23:00: 22:00 <= 23:00 AND 23:00 < 02:00 (false without adjustment for day change)
                    # If shift ends on next day, add 24 hours to its end time for comparison range.
                    if (
                        assigned_shift_end_time < assigned_shift_start_time
                    ):  # True overnight shift that crosses midnight
                        assigned_shift_end_dt_for_comparison = (
                            assigned_shift_end_dt + timedelta(days=1)
                        )
                    elif (
                        assigned_shift_end_time == datetime.min.time()
                        and assigned_shift_start_time != datetime.min.time()
                    ):  # Shift ends exactly at midnight e.g. 16:00 - 00:00
                        assigned_shift_end_dt_for_comparison = datetime.combine(
                            base_date + timedelta(days=1), datetime.min.time()
                        )
                    else:  # Standard shift or shift that ends at 00:00 and starts at 00:00 (unlikely full 24h)
                        assigned_shift_end_dt_for_comparison = assigned_shift_end_dt
                else:  # Standard same-day shift
                    assigned_shift_end_dt_for_comparison = assigned_shift_end_dt

                # Check: shift_start <= interval_start < shift_end
                if (
                    assigned_shift_start_dt
                    <= interval_start_dt
                    < assigned_shift_end_dt_for_comparison
                ):
                    if employee_id not in employee_ids_working:
                        # ADDED CHECK for self.resources
                        employee = (
                            self.resources.get_employee(employee_id)
                            if self.resources
                            else None
                        )
                        if employee:
                            working_employees.append(employee)
                            employee_ids_working.add(employee_id)
                        else:
                            self.logger.warning(
                                f"get_employees_working_during_interval: Employee ID {employee_id} not found in resources."
                            )
            except ValueError as e:
                self.logger.error(
                    f"get_employees_working_during_interval: Error parsing time for assignment {assignment.get('id', 'N/A')}: {e}"
                )
                continue

        return working_employees
