"""Distribution module for fair employee assignment across shifts."""

from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import date, datetime, timedelta
from collections import defaultdict
import functools
import sys
import os
import logging
from .resources import ScheduleResources # Assuming ScheduleResources is in resources.py
from .constraints import ConstraintChecker # Assuming ConstraintChecker is in constraints.py
from .availability import AvailabilityChecker # Assuming AvailabilityChecker is in availability.py
from .coverage_utils import get_required_staffing_for_interval, _time_str_to_datetime_time # Import the new utility and helper

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
        return AvailabilityType, Employee, ShiftTemplate, Schedule, backend_logger
    except ImportError:
        try:
            # Import when run from project root
            from backend.models.employee import AvailabilityType
            from backend.models import Employee, ShiftTemplate, Schedule
            from backend.utils.logger import logger as backend_logger
            return AvailabilityType, Employee, ShiftTemplate, Schedule, backend_logger
        except ImportError:
            try:
                # Import when run from another location
                from src.backend.models.employee import AvailabilityType
                from src.backend.models import Employee, ShiftTemplate, Schedule
                from src.backend.utils.logger import logger as backend_logger
                return AvailabilityType, Employee, ShiftTemplate, Schedule, backend_logger
            except ImportError:
                import_logger.warning("Could not import model classes, using type hint classes instead")
                # Create type hint classes for standalone testing
                class DummyAvailabilityType:
                    """Type hint enum for AvailabilityType"""
                    AVAILABLE = "AVAILABLE"
                    PREFERRED = "PREFERRED"
                    UNAVAILABLE = "UNAVAILABLE"
                
                class Employee:
                    """Type hint class for Employee"""
                    id: int
                    employee_group: str
                    skills: List[str]
                    preferred_shift_types: List[str]
                    is_keyholder: bool = False
                    is_active: bool = True
                    contracted_hours: float = 40.0

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
                
                return DummyAvailabilityType, Employee, ShiftTemplate, Schedule, import_logger

# Import model classes
AvailabilityType, Employee, ShiftTemplate, Schedule, logger = import_models()

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
    ):
        self.resources = resources
        self.constraint_checker = constraint_checker
        self.availability_checker = availability_checker
        self.config = config
        self.logger = logger or logging.getLogger(__name__)

        # Initialize assignments dictionary for all employees
        self.assignments_by_employee = defaultdict(list)
        self.schedule_by_date = {}
        self.employee_history = defaultdict(lambda: defaultdict(int))
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
            for employee_id, employee_assignments in self.assignments_by_employee.items():
                for assignment in employee_assignments:
                    if isinstance(assignment, dict) and assignment.get("date") == current_date:
                        shifts_assigned_today[employee_id] += 1
                    elif hasattr(assignment, "date") and assignment.date == current_date:
                        shifts_assigned_today[employee_id] += 1
            
            # Maximum shifts per employee per day
            max_shifts_per_day = 1  # Set to 1 to prevent multiple shifts per day
            
            # Guard against empty inputs
            if not shifts:
                self.logger.warning(f"No shifts to assign for type {shift_type}")
                return []
                
            if not available_employees:
                self.logger.warning(f"No employees available for shift type {shift_type}")
                # Use all active employees as fallback
                available_employees = [e for e in self.resources.employees if getattr(e, "is_active", True)]
                if not available_employees:
                    self.logger.error("No active employees found. Cannot assign shifts.")
                    return []
                self.logger.info(f"Using {len(available_employees)} active employees as fallback")

            # Sort employees by priority score
            sorted_employees = []
            for employee in available_employees:
                employee_id = self.get_id(employee, ["id", "employee_id"])
                if employee_id is None:
                    self.logger.warning(f"Employee has no ID: {employee}")
                    continue

                # Calculate priority score based on weekly shifts and days since last shift
                weekly_shifts = len(self.assignments_by_employee.get(employee_id, []))
                days_since_last = 7  # Default to maximum if no previous shifts

                if self.assignments_by_employee.get(employee_id):
                    last_shift_date = max(
                        assignment.get("date")
                        if isinstance(assignment, dict)
                        else getattr(assignment, "date")
                        for assignment in self.assignments_by_employee[employee_id]
                    )
                    days_since_last = (current_date - last_shift_date).days

                # Add big penalty for employees already assigned today
                daily_shifts_penalty = shifts_assigned_today.get(employee_id, 0) * 100
                
                # Priority score: higher is lower priority
                priority_score = weekly_shifts - days_since_last + daily_shifts_penalty
                sorted_employees.append((employee, priority_score))

            sorted_employees.sort(key=lambda x: x[1])  # Sort by priority score (lower is better)
            self.logger.info(f"Sorted {len(sorted_employees)} employees by priority")

            # Try to assign shifts
            for shift in shifts:
                if self.is_shift_assigned(shift, assignments):
                    continue

                shift_id = self.get_id(shift, ["id", "shift_id"])
                if not shift_id:
                    self.logger.warning(f"Shift has no ID: {shift}")
                    continue
                
                self.logger.info(f"Attempting to assign shift {shift_id}")

                shift_template = None
                if isinstance(shift, dict):
                    shift_template = shift
                else:
                    # Convert shift object to dictionary
                    shift_template = {
                        "id": shift_id,
                        "shift_id": shift_id,
                        "date": current_date,
                        "start_time": getattr(shift, "start_time", "00:00"),
                        "end_time": getattr(shift, "end_time", "00:00"),
                        "shift_type": shift_type,
                    }

                # Find an available employee for this shift
                assigned = False
                employee_idx = 0
                
                # Try each employee in priority order until we find one that can be assigned
                while not assigned and employee_idx < len(sorted_employees):
                    employee, _ = sorted_employees[employee_idx]
                    employee_id = self.get_id(employee, ["id", "employee_id"])
                    if employee_id is None:
                        employee_idx += 1
                        continue

                    # Check if employee has already reached daily shift limit
                    if shifts_assigned_today.get(employee_id, 0) >= max_shifts_per_day:
                        self.logger.debug(f"Employee {employee_id} already has {shifts_assigned_today[employee_id]} shifts today (max: {max_shifts_per_day})")
                        employee_idx += 1
                        continue

                    # Check if employee can be assigned - we limit to a reasonable weekly max
                    # but also consider daily limits
                    if (
                        len(self.assignments_by_employee.get(employee_id, [])) < 10
                    ):  # Weekly max of 10 shifts
                        # Get the version from the resources or self.version attribute
                        version = getattr(self, 'version', None)
                        if version is None and hasattr(self.resources, 'version'):
                            version = self.resources.version
                        
                        # If still None, try scheduler_version from config
                        if version is None and self.config:
                            version = self.config.get('scheduler_version', 1)
                            
                        # Last fallback
                        if version is None:
                            version = 1
                            
                        self.logger.info(f"Using version {version} for assignment")
                        
                        assignment = {
                            "employee_id": employee_id,
                            "shift_id": shift_id,
                            "date": current_date,
                            "start_time": shift_template.get("start_time"),
                            "end_time": shift_template.get("end_time"),
                            "shift_type": shift_type,
                            "status": "PENDING",
                            "version": version  # Use dynamic version instead of hardcoded 1
                        }

                        assignments.append(assignment)
                        
                        # Add to employee's assignments
                        if employee_id not in self.assignments_by_employee:
                            self.assignments_by_employee[employee_id] = []
                        self.assignments_by_employee[employee_id].append(assignment)
                        
                        # Update daily shift counter
                        shifts_assigned_today[employee_id] += 1
                        
                        self.logger.info(f"Assigned employee {employee_id} to shift {shift_id}")
                        assigned = True
                    
                    employee_idx += 1

                if not assigned:
                    self.logger.warning(
                        f"Could not assign shift {shift_id} of type {shift_type}"
                    )

            self.logger.info(
                f"Made {len(assignments)} assignments for shift type {shift_type}"
            )
            return assignments

        except Exception as e:
            self.logger.error(f"Error in assign_employees_by_type: {str(e)}")
            self.logger.error("Stack trace:", exc_info=True)
            return []

    def is_shift_assigned(self, shift: Any, assignments: List[Dict]) -> bool:
        """Check if a shift has already been assigned"""
        shift_id = self.get_id(shift, ["id", "shift_id"])
        if shift_id is None:
            return False

        return any(
            self.get_id(a, ["shift_id"]) == shift_id
            for a in assignments
        )

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

    def _initialize_employee_data(self, employees: List[Employee]):
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
            if hasattr(employee, "preferences") and employee.preferences:
                self._load_employee_preferences(employee)

    def _load_employee_preferences(self, employee: Employee):
        """Load employee preferences from the employee model"""
        if not hasattr(employee, "preferences") or not employee.preferences:
            return

        prefs = employee.preferences

        # This will need to be adapted based on your actual preference model
        if hasattr(prefs, "preferred_days"):
            self.employee_preferences[employee.id]["preferred_days"] = (
                prefs.preferred_days
            )

        if hasattr(prefs, "preferred_shifts"):
            self.employee_preferences[employee.id]["preferred_shifts"] = (
                prefs.preferred_shifts
            )

        if hasattr(prefs, "avoid_days"):
            self.employee_preferences[employee.id]["avoid_days"] = prefs.avoid_days

        if hasattr(prefs, "avoid_shifts"):
            self.employee_preferences[employee.id]["avoid_shifts"] = prefs.avoid_shifts

    def _load_historical_data(self, schedule_entries: List[Schedule]):
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
        if hasattr(shift, "shift_type_id") and shift.shift_type_id:
            if shift.shift_type_id in ["EARLY", "MIDDLE", "LATE"]:
                return shift.shift_type_id

        # Default category if we can't determine
        category = "EARLY"  # Default to EARLY if we can't determine

        # Extract start hour
        if hasattr(shift, "start_time") and shift.start_time:
            try:
                start_hour = int(shift.start_time.split(":")[0])

                # Categorize based on start hour
                if start_hour < 10:
                    category = "EARLY"
                elif 10 <= start_hour < 14:
                    category = "MIDDLE"
                else:
                    category = "LATE"
            except (ValueError, IndexError):
                pass

        return category

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
                assigned_shift_id = assignment.get("shift_id") if isinstance(assignment, dict) else None
                if assigned_shift_id and assigned_shift_id in self.shift_scores:
                    # Ensure self.shift_scores[assigned_shift_id] is a dict and has 'type'
                    shift_data = self.shift_scores[assigned_shift_id]
                    if isinstance(shift_data, dict) and shift_data.get("type") == shift_type:
                        type_count += 1

        # Handle case with no assignments
        if total_shifts == 0:
            return 0.33  # Default to ideal distribution

        return type_count / total_shifts

    @functools.lru_cache(maxsize=256)
    def calculate_assignment_score(
        self,
        employee_id: int,
        shift_template: ShiftTemplate,
        shift_date: date,
        context: Dict[str, Any], # Must contain 'target_interval_needs', 'shift_covered_intervals', 'full_day_staffing_snapshot', 'interval_duration_minutes'
        availability_type_override: AvailabilityType # Specific availability for this context
    ) -> float:
        """Calculate a score for assigning this employee to this shift_template on shift_date.

        Higher scores are better.
        The score considers availability, interval-specific needs, employee history, preferences, workload, and overstaffing.
        """
        score = 0.0
        employee = self.resources.get_employee_by_id(employee_id)
        if not employee:
            self.logger.warning(f"calculate_assignment_score: Employee {employee_id} not found in resources.")
            return -float('inf') # Should not happen if called correctly

        # 1. AvailabilityType Scoring (Directly from override)
        if availability_type_override == AvailabilityType.FIXED:
            score += 100.0
        elif availability_type_override == AvailabilityType.PREFERRED:
            score += 50.0
        elif availability_type_override == AvailabilityType.AVAILABLE:
            score += 10.0 # Base score for being available
        else: # UNAVAILABLE or other status - should not reach here if pre-checked
            self.logger.error(f"calculate_assignment_score called for non-available state: {availability_type_override} for Emp {employee_id}")
            return -float('inf')

        # 2. Target Interval Needs Scoring (from context - for the interval being directly filled)
        target_interval_needs = context.get("target_interval_needs")
        if target_interval_needs:
            if target_interval_needs.get("requires_keyholder"):
                if getattr(employee, 'is_keyholder', False):
                    score += 150.0  # Strong bonus for meeting keyholder need
                else:
                    score -= 1000.0 # Strong penalty if keyholder needed and employee is not one
            #
            # Employee types/groups requirement
            required_target_employee_types = target_interval_needs.get("employee_types", [])
            if required_target_employee_types:
                employee_group = getattr(employee, 'employee_group', None)
                if employee_group and employee_group in required_target_employee_types:
                    score += 75.0  # Bonus if employee type matches requirement
                # Penalty if employee has a type, but not one of the required ones for this interval
                elif employee_group and employee_group not in required_target_employee_types:
                    score -= 750.0
                # If employee has no group, but specific types are required, this could be a penalty too
                elif not employee_group:
                    score -= 100.0 # Penalty for being untyped when types are needed

        else:
            self.logger.warning(f"calculate_assignment_score: target_interval_needs not found in context for Emp {employee_id}, Shift {shift_template.id}, Date {shift_date}")

        # 3. Historical/Fairness Adjustments (higher is better convention)
        #    These methods will be adapted to return positive for bonus, negative for penalty.
        #    Using placeholder names _v2 for now, will rename/refactor them next.
        score += self._calculate_history_adjustment_v2(employee_id, shift_template, shift_date)
        score += self._calculate_preference_adjustment_v2(employee_id, shift_template, shift_date, availability_type_override)

        # 4. Shift Desirability Penalty
        shift_id = shift_template.id
        cached_shift_info = self.shift_scores.get(shift_id)
        if cached_shift_info and isinstance(cached_shift_info, dict):
            base_penalty_factor = 5.0
            score -= cached_shift_info.get('base_score', ShiftScore.STANDARD) * base_penalty_factor

        # 5. Workload Adjustment Penalty
        employee_assignments = self.assignments_by_employee.get(employee_id, [])
        num_assignments_processed = 0
        current_hours_worked = 0.0
        for assignment_dict in employee_assignments: # Assuming assignments_by_employee stores dicts now
            if isinstance(assignment_dict, dict):
                num_assignments_processed +=1
                # Calculate hours from this assignment if possible
                duration = assignment_dict.get('duration_hours')
                if duration is None:
                    start_t = assignment_dict.get('start_time')
                    end_t = assignment_dict.get('end_time')
                    if start_t and end_t:
                        duration = self.calculate_duration(start_t, end_t)
                    else:
                        duration = 0
                current_hours_worked += duration
        #
        workload_penalty = num_assignments_processed * 10.0 # Base penalty per assignment
        contracted_hours = getattr(employee, "contracted_hours", 40.0)
        if contracted_hours > 0 and current_hours_worked > contracted_hours:
            workload_penalty += (current_hours_worked - contracted_hours) * 1.5 # Increased penalty for exceeding contract hours

        score -= workload_penalty * self.fair_distribution_weight

        # 6. Overstaffing Penalty (New Logic)
        shift_covered_intervals = context.get("shift_covered_intervals", [])
        full_day_staffing_snapshot = context.get("full_day_staffing_snapshot")
        # interval_duration_minutes = context.get("interval_duration_minutes") # Available if needed for other logic

        if shift_covered_intervals and full_day_staffing_snapshot:
            for covered_interval_time in shift_covered_intervals:
                # Get current staffing for this specific covered interval
                current_staffing_for_covered_interval = full_day_staffing_snapshot.get(covered_interval_time)
                if not current_staffing_for_covered_interval:
                    self.logger.warning(f"Overstaffing check: Staffing snapshot not found for interval {covered_interval_time}. Skipping penalty for this interval.")
                    continue
                
                # Get the needs for this specific covered interval
                # Note: target_interval_needs is for the interval we are *trying to fill*, 
                # here we need needs for *each interval this shift covers*.
                needs_for_covered_interval = self.resources.get_interval_needs_for_time(shift_date, covered_interval_time)
                if not needs_for_covered_interval:
                    self.logger.warning(f"Overstaffing check: Needs not found for interval {covered_interval_time}. Skipping penalty for this interval.")
                    continue

                min_employees_for_covered_interval = needs_for_covered_interval.get('min_employees', 0)
                # Using 'current_employees' as the key updated in _try_find_and_make_assignment's staffing update
                num_employees_in_covered_interval_before_this = current_staffing_for_covered_interval.get('current_employees', 0)

                # If adding this employee would push it over the minimum required
                if num_employees_in_covered_interval_before_this + 1 > min_employees_for_covered_interval:
                    overstaff_amount = (num_employees_in_covered_interval_before_this + 1) - min_employees_for_covered_interval
                    # Apply penalty, increasing with the amount of overstaffing
                    # Example: base penalty 50, plus 20 for each extra person over
                    penalty = 50.0 + (20.0 * (overstaff_amount -1) ) # -1 because first over is caught by 50.0
                    score -= penalty
                    self.logger.debug(f"Overstaffing penalty for Emp {employee_id}, Shift {shift_template.id} in interval {covered_interval_time}: -{penalty:.2f} (Had {num_employees_in_covered_interval_before_this}, Needs {min_employees_for_covered_interval}, Would be {num_employees_in_covered_interval_before_this + 1})")
        else:
            if not shift_covered_intervals:
                self.logger.warning("calculate_assignment_score: shift_covered_intervals not in context.")
            if not full_day_staffing_snapshot:
                self.logger.warning("calculate_assignment_score: full_day_staffing_snapshot not in context.")

        self.logger.debug(
            f"Score for Emp {employee_id}, Shift {shift_template.id} ({getattr(shift_template, 'shift_type', 'N/A')}) on {shift_date}, "
            f"Avail: {availability_type_override.value if hasattr(availability_type_override, 'value') else availability_type_override}: Final Score = {score:.2f}"
        )
        return score

    def _calculate_base_score(self, shift: ShiftTemplate, shift_date: date) -> float:
        """Calculate the base desirability score for a shift"""
        # This method's logic is largely integrated into self.shift_scores population
        # and direct scoring in calculate_assignment_score. 
        # If specific base desirability (not covered by history/prefs) is needed, implement here.
        # Example: general bonus for day shifts, penalty for very short/long shifts if not covered elsewhere.
        return 0.0 # Neutral for now

    def _calculate_history_adjustment_v2(
        self, employee_id: int, shift_template: ShiftTemplate, shift_date: date
    ) -> float:
        """Calculate adjustment based on employee's shift history. Higher score is better.
        Aims to balance shift types (EARLY, MIDDLE, LATE) and weekend/holiday work.
        Returns positive for a needed/balancing shift, negative for an over-represented one.
        """
        adjustment = 0.0
        employee = self.resources.get_employee_by_id(employee_id)
        if not employee or employee_id not in self.employee_history:
            return 0.0

        history = self.employee_history[employee_id]
        category = self._categorize_shift(shift_template) # EARLY, MIDDLE, LATE

        total_shifts = history.get("total", 0)
        if total_shifts > 5: # Only apply strong balancing after a few shifts to gather data
            # Shift Type Balancing (EARLY, MIDDLE, LATE)
            target_ratio = 0.33 # Simplified target
            current_category_count = history.get(category, 0)
            current_category_ratio = current_category_count / total_shifts

            # Bonus if employee needs more of this type, penalty if has too many
            # Max bonus/penalty around 20-25 points
            if current_category_ratio < target_ratio - 0.15: # Significantly underrepresented
                adjustment += 25.0 * (target_ratio - current_category_ratio) / target_ratio 
            elif current_category_ratio > target_ratio + 0.15: # Significantly overrepresented
                adjustment -= 25.0 * (current_category_ratio - target_ratio) / target_ratio
            
            # Weekend Balancing
            if shift_date.weekday() >= 5: # If current shift is a weekend
                # Consider max N weekend shifts per month, or X% of total shifts
                # Example: Penalize if already worked >2 weekends in last 4 weeks (approx month)
                # Or, if weekend shifts are > 35% of total shifts for this employee
                num_weekend_shifts = history.get("weekend", 0)
                weekend_ratio = num_weekend_shifts / total_shifts
                if weekend_ratio > 0.35: # Employee works >35% weekends
                    adjustment -= 30.0 # Strong penalty for another weekend shift
                elif num_weekend_shifts > (total_shifts / 2) and num_weekend_shifts > 3: # Works more weekends than weekdays recently
                    adjustment -= 15.0
                else: # Taking a weekend shift and not overloaded
                    adjustment += 5.0 
            else: # Current shift is a weekday
                # Optional: bonus if employee has worked many recent weekends (to give a break)
                pass 
            # else: not enough history for strong balancing, minor or no adjustment

            # TODO: Holiday Balancing (similar to weekend)
            self.logger.debug(f"HistoryAdjustment for Emp {employee_id}, ShiftType {category}, Date {shift_date}: {adjustment:.2f}")
            return adjustment

    def _calculate_preference_adjustment_v2(
        self, employee_id: int, shift_template: ShiftTemplate, shift_date: date, availability_type: Optional[AvailabilityType] = None
    ) -> float:
        """Calculate adjustment based on employee preferences. Higher score is better.
        Considers general day/shift preferences.
        AvailabilityType (FIXED/PREFERRED for the specific shift) is heavily scored in the main function; 
        this adds bonuses for general preferences.
        """
        adjustment = 0.0
        employee = self.resources.get_employee_by_id(employee_id)
        if not employee or employee_id not in self.employee_preferences:
            return 0.0

        prefs = self.employee_preferences[employee_id]
        day_of_week_str = shift_date.strftime("%A").lower()
        shift_type_attr = getattr(shift_template, 'shift_type', None) # E.g., "Early", "Office", etc.

        # Explicit Day Preferences
        if day_of_week_str in prefs.get("preferred_days", []):
            adjustment += 20.0  # Stronger bonus for explicitly preferred day
        if day_of_week_str in prefs.get("avoid_days", []):
            adjustment -= 40.0 # Stronger penalty for day they want to avoid

        # Explicit Shift Type Preferences
        if shift_type_attr:
            if shift_type_attr in prefs.get("preferred_shifts", []):
                adjustment += 20.0 # Bonus for preferred shift type
            if shift_type_attr in prefs.get("avoid_shifts", []):
                adjustment -= 40.0 # Penalty for avoided shift type
        
        # If the specific availability for THIS shift instance was PREFERRED,
        # and it also matches a general preference, add a small kicker bonus.
        if availability_type == AvailabilityType.PREFERRED:
            if day_of_week_str in prefs.get("preferred_days", []) or \
               (shift_type_attr and shift_type_attr in prefs.get("preferred_shifts", [])):
                adjustment += 10.0 # Kicker for PREFERRED + General Preference match

        self.logger.debug(f"PreferenceAdjustment for Emp {employee_id}, ShiftType {shift_type_attr}, Date {shift_date}: {adjustment:.2f}")
        return adjustment

    # Keep old versions for reference during transition if needed, or remove if confident
    def _calculate_history_adjustment(self, employee_id: int, shift: ShiftTemplate, shift_date: date ) -> float:
        self.logger.warning("_calculate_history_adjustment (old) called. Should use _v2 version.")
        return 0.0 # Deprecated, return neutral

    def _calculate_preference_adjustment(self, employee_id: int, shift: ShiftTemplate, shift_date: date ) -> float: 
        self.logger.warning("_calculate_preference_adjustment (old) called. Should use _v2 version.")
        return 0.0 # Deprecated, return neutral

    def _calculate_seniority_adjustment(
        self, employee_id: int, context: Dict[str, Any]
    ) -> float:
        """Calculate adjustment based on employee seniority"""
        # This implementation will depend on how seniority is stored
        # For now, return a neutral adjustment
        return 0.0

    def update_with_assignment(self, employee_id, shift_details, shift_date, new_assignment_dict: Optional[Dict] = None):
        """Update the distribution manager with a new assignment.
        shift_details: dict from potential_shifts_map (contains start_time, end_time, id, etc.) - less used now new_assignment_dict is primary.
        new_assignment_dict: The fully formed assignment dictionary that will be saved.
        """
        if new_assignment_dict is None:
            # This case should ideally not happen if called from the new assignment flow.
            self.logger.error(f"FATAL: update_with_assignment called for Emp {employee_id} on {shift_date} WITHOUT new_assignment_dict. Shift details: {shift_details}. This indicates an issue in the calling code.")
            # Constructing a very basic dict to prevent crash, but data will be incomplete.
            assignment_to_record = {
                "employee_id": employee_id,
                "shift_id": shift_details.get('id') if isinstance(shift_details, dict) else None,
                "date": shift_date,
                "start_time": shift_details.get('start_time') if isinstance(shift_details, dict) else "00:00",
                "end_time": shift_details.get('end_time') if isinstance(shift_details, dict) else "00:00",
                "status": "ERROR_INCOMPLETE_DATA",
                "version": self.resources.version_id if hasattr(self.resources, 'version_id') else 1,
            }
        else:
            assignment_to_record = new_assignment_dict

        shift_id_for_log = assignment_to_record.get('shift_id')
        self.logger.info(
            f"Recording assignment via update_with_assignment: Emp {employee_id} to Shift {shift_id_for_log} on {shift_date}. "
            f"Full Assignment Dict: {assignment_to_record}"
        )

        # Update self.assignments_by_employee (list of assignment dicts for each employee)
        if employee_id not in self.assignments_by_employee:
            self.assignments_by_employee[employee_id] = []
        # Ensure no duplicate dictionary instances are appended if this method is somehow called multiple times for the same assignment object
        if not any(existing_assignment is assignment_to_record for existing_assignment in self.assignments_by_employee[employee_id]):
            self.assignments_by_employee[employee_id].append(assignment_to_record)
        else:
            self.logger.warning(f"Attempted to append the exact same assignment dictionary instance for employee {employee_id}, shift {shift_id_for_log}. Skipping duplicate append.")

        # Update self.employee_history (counts for shift types, hours, etc.)
        if employee_id not in self.employee_history:
            # Initialize with defaultdict(int) for counts and float for hours
            self.employee_history[employee_id] = defaultdict(int, {"hours": 0.0})
        elif "hours" not in self.employee_history[employee_id]: # Ensure hours key exists and is float
             self.employee_history[employee_id]["hours"] = 0.0
        elif not isinstance(self.employee_history[employee_id]["hours"], float):
            try:
                self.employee_history[employee_id]["hours"] = float(self.employee_history[employee_id]["hours"])
            except ValueError:
                self.logger.error(f"Corrupted hours in history for emp {employee_id} before update. Resetting to 0.0")
                self.employee_history[employee_id]["hours"] = 0.0

        history = self.employee_history[employee_id]
        
        shift_start_time_for_cat = assignment_to_record.get('start_time')
        shift_template_id_for_cat = assignment_to_record.get('shift_template_id')
        original_shift_template = self.resources.get_shift_template_by_id(shift_template_id_for_cat) if shift_template_id_for_cat else None
        
        if original_shift_template: # Prefer using the full template for categorization
            category = self._categorize_shift(original_shift_template)
        elif shift_start_time_for_cat: # Fallback to using start time from dict
            class MinimalShiftForCategorization: # Helper class for _categorize_shift if only dict info available
                def __init__(self, start_time_str, shift_type_id_str=None):
                    self.start_time = start_time_str
                    self.shift_type_id = shift_type_id_str
            minimal_shift_obj = MinimalShiftForCategorization(shift_start_time_for_cat)
            category = self._categorize_shift(minimal_shift_obj)
        else:
            category = None
            self.logger.warning(f"Could not determine shift category for history: missing start_time and template_id in assignment {assignment_to_record}")

        if category:
            history[category] = history.get(category, 0) + 1 # Use .get for safety if defaultdict isn't fully trusted for all keys
        history["total"] = history.get("total", 0) + 1

        if shift_date.weekday() >= 5:  # Saturday (5) or Sunday (6)
            history["weekend"] = history.get("weekend", 0) + 1
        # TODO: Add holiday check for history (requires holiday data source)

        duration_hours = assignment_to_record.get('duration_hours')
        if not isinstance(duration_hours, (float, int)): # If not pre-calculated or invalid type
            start_t = assignment_to_record.get('start_time')
            end_t = assignment_to_record.get('end_time')
            if start_t and end_t:
                duration_hours = self.calculate_duration(start_t, end_t)
            else:
                duration_hours = 0.0
                self.logger.warning(f"Could not calculate duration for history update: missing start/end time in {assignment_to_record}")
        
        history["hours"] += float(duration_hours) # Ensure it's added as float
        self.logger.debug(
            f"Emp {employee_id} history updated: Total {history.get('total')}, E {history.get('EARLY')}, M {history.get('MIDDLE')}, L {history.get('LATE')}, W {history.get('weekend')}, Hrs {history.get('hours'):.2f}. "
            f"Total assignments in list: {len(self.assignments_by_employee[employee_id])}"
        )

    def get_distribution_metrics(self) -> Dict[str, Any]:
        """Get metrics about the current shift distribution"""
        total_shifts = 0
        # Ensure 'weekend' (lowercase) is for the counter, and add 'UNKNOWN' for robustness.
        # Other main types like EARLY, MIDDLE, LATE should be consistent (e.g., uppercase).
        type_counts = {"EARLY": 0, "MIDDLE": 0, "LATE": 0, "UNKNOWN": 0, "weekend": 0}

        # Count shifts by type
        for employee_id, assignments in self.assignments_by_employee.items():
            for assignment in assignments:
                total_shifts += 1
                
                
                assigned_shift_type = assignment.get("shift_type")
                if assigned_shift_type in ["EARLY", "MIDDLE", "LATE"]:
                    type_counts[assigned_shift_type] += 1
                else:
                    # Log if it's an unexpected type or None
                    if assigned_shift_type is not None:
                        self.logger.warning(f"Metrics: Encountered unexpected shift_type '{assigned_shift_type}'. Counting as UNKNOWN.")
                    else:
                        self.logger.warning(f"Metrics: Assignment missing shift_type. Counting as UNKNOWN. Assignment: {assignment}")
                    type_counts["UNKNOWN"] += 1

                # Check for weekend shifts
                # Note: the original key was 'weekend' (lowercase). Standardizing to 'WEEKEND' if it's a main category.
                # If 'weekend' is just a counter alongside types, then it should be separate.
                # Assuming 'weekend' is a separate counter as in original logic.
                current_type_counts = {"EARLY": 0, "MIDDLE": 0, "LATE": 0, "weekend": 0, "UNKNOWN": 0}
                # Re-initialize type_counts from the broader scope
                type_counts_local = type_counts # Use the main type_counts

                if isinstance(assignment.get("date"), date):
                    if assignment["date"].weekday() >= 5:  # Saturday = 5, Sunday = 6
                        type_counts_local["weekend"] += 1 # Add to 'weekend' key

        # Calculate percentages
        percentages = {}
        if total_shifts > 0:
            for shift_type, count in type_counts.items():
                percentages[shift_type] = (count / total_shifts) * 100

        # Calculate fairness metrics
        fairness_metrics = self._calculate_fairness_metrics()

        return {
            "total_shifts": total_shifts,
            "type_counts": type_counts,
            "overall_percentages": percentages,
            "fairness_metrics": fairness_metrics,
        }

    def _calculate_fairness_score(self, history: Dict[str, int]) -> float:
        """Calculate a fairness score for an employee based on their shift history"""
        if history["total"] == 0:
            return 0.0

        # Calculate how balanced the distribution is across categories
        categories = ["early", "late", "weekend", "standard"]
        percentages = [history[cat] / history["total"] * 100 for cat in categories]
        ideal_percentage = 25.0  # Ideally equal distribution

        # The closer to ideal distribution, the higher the score
        deviations = [abs(p - ideal_percentage) for p in percentages]
        avg_deviation = sum(deviations) / len(deviations)

        # Normalize to a 0-10 scale where 10 is perfect distribution
        return round(10 - min(avg_deviation / 5, 10), 2)

    def _calculate_gini_coefficient(self, values: List[int]) -> float:
        """Calculate Gini coefficient as a measure of inequality
        0 = perfect equality, 1 = perfect inequality
        """
        if not values or sum(values) == 0:
            return 0.0

        sorted_values = sorted(values)
        n = len(sorted_values)
        cumsum = 0
        for i, value in enumerate(sorted_values):
            cumsum += (i + 1) * value

        return round((2 * cumsum / (n * sum(sorted_values))) - (n + 1) / n, 2)

    def _calculate_variance(self, values: List[float]) -> float:
        """Calculate variance of a list of values"""
        if not values:
            return 0.0

        mean = sum(values) / len(values)
        squared_diffs = [(x - mean) ** 2 for x in values]
        return sum(squared_diffs) / len(values)

    def _calculate_equity_score(self, metrics: Dict[str, Any]) -> float:
        """Calculate an overall equity score based on multiple fairness metrics
        Returns a score from 0-10 where 10 is perfect equity
        """
        if not metrics["employee_distribution"]:
            return 0.0

        # Use Gini coefficient (inverted since lower is better)
        gini_score = 10 * (1 - metrics["fairness_metrics"]["gini_coefficient"])

        # Calculate average employee fairness score
        employee_scores = [
            dist["score"] for _, dist in metrics["employee_distribution"].items()
        ]
        avg_employee_score = (
            sum(employee_scores) / len(employee_scores) if employee_scores else 0
        )

        # Combine metrics with weights
        return round(0.6 * gini_score + 0.4 * avg_employee_score, 2)

    def clear_caches(self):
        """Clear all caches"""
        self.calculate_assignment_score.cache_clear()

    def _calculate_fairness_metrics(self):
        """Calculate metrics to measure fairness of shift distribution"""
        metrics = {"gini_coefficient": 0.0, "type_variance": {}, "equity_score": 0.0}

        # Skip if no assignments
        if not self.assignments_by_employee:
            return metrics

        # Calculate total assignments per employee
        shift_counts = []
        for employee_id, assignments in self.assignments_by_employee.items():
            shift_counts.append(len(assignments))

        # Skip if no shift counts
        if not shift_counts:
            return metrics

        # Calculate Gini coefficient (measure of inequality)
        # 0 = perfect equality, 1 = perfect inequality
        gini = self._calculate_gini_coefficient(shift_counts)
        metrics["gini_coefficient"] = round(gini, 3)

        # Calculate variance in shift type distribution
        for shift_type in ["early", "middle", "late"]:
            type_percentages = []
            for employee_id, assignments in self.assignments_by_employee.items():
                # Count shifts of this type
                type_count = sum(
                    1 for a in assignments if a.get("shift_type") == shift_type
                )
                total_shifts = len(assignments)

                if total_shifts > 0:
                    type_percent = (type_count / total_shifts) * 100
                    type_percentages.append(type_percent)

            if type_percentages:
                # Calculate variance (lower is better)
                variance = self._calculate_variance(type_percentages)
                metrics["type_variance"][shift_type] = round(variance, 2)

        # Calculate overall equity score (0-100, higher is better)
        # Based on Gini coefficient and type variances
        if "early" in metrics["type_variance"]:
            # Convert Gini to 0-100 scale (0 = worst, 100 = best)
            gini_score = (1 - metrics["gini_coefficient"]) * 100

            # Average the variances
            avg_variance = sum(metrics["type_variance"].values()) / len(
                metrics["type_variance"]
            )

            # Convert variance to 0-100 scale (lower variance is better)
            # Assume max reasonable variance is 40
            variance_score = max(0, 100 - (avg_variance * 2.5))

            # Combine scores (gini is more important for fairness)
            metrics["equity_score"] = round(
                (gini_score * 0.6) + (variance_score * 0.4), 1
            )

        return metrics

    def set_schedule(self, assignments, schedule_by_date):
        """Set the current assignments to enable constraint checking"""
        self.assignments_by_employee = assignments
        self.schedule_by_date = schedule_by_date
        self.constraint_checker.set_schedule(assignments, schedule_by_date)

    def generate_diagnostic_report(self, date_to_check: date, shifts: List[Any], assignments: List[Dict]) -> Dict[str, Any]:
        """Generate a comprehensive diagnostic report about the assignment process
        
        This method analyzes the results of an assignment run and provides detailed
        diagnostic information to help identify problems with the scheduler.
        
        Args:
            date_to_check: The date for which assignments were generated
            shifts: The list of shifts that needed assignment
            assignments: The assignments that were successfully made
            
        Returns:
            A dictionary containing diagnostic information
        """
        diagnostic = {
            "date": date_to_check,
            "total_shifts": len(shifts),
            "total_assignments": len(assignments),
            "success_rate": round(len(assignments) / max(len(shifts), 1) * 100, 2),
            "shift_types": defaultdict(int),
            "assigned_shift_types": defaultdict(int),
            "unassigned_shifts": [],
            "employee_workload": defaultdict(int),
            "errors": [],
            "warnings": []
        }
        
        # Track which shifts were actually assigned
        assigned_shift_ids = [self.get_id(a, ["shift_id"]) for a in assignments]
        
        # Analyze shift distribution
        for shift in shifts:
            shift_id = self.get_id(shift, ["id", "shift_id"])
            shift_type = self.extract_shift_type(shift)
            
            diagnostic["shift_types"][shift_type] += 1
            
            if shift_id in assigned_shift_ids:
                diagnostic["assigned_shift_types"][shift_type] += 1
            else:
                # Gather info about unassigned shifts
                unassigned_info = {
                    "shift_id": shift_id,
                    "shift_type": shift_type,
                    "reasons": []
                }
                
                # Try to determine why this shift wasn't assigned
                
                # Check if there were any employees available for this shift
                available_employees = []
                if self.availability_checker:
                    shift_template = None
                    if isinstance(shift, dict):
                        shift_template = self.resources.get_shift(shift.get("shift_id", shift.get("id")))
                    else:
                        shift_template = self.resources.get_shift(shift_id)
                        
                    if shift_template:
                        for emp in self.resources.employees:
                            if getattr(emp, "is_active", True):
                                is_available, _ = self.availability_checker.is_employee_available(
                                    emp.id, date_to_check, shift_template
                                )
                                if is_available:
                                    available_employees.append(emp.id)
                
                if not available_employees:
                    unassigned_info["reasons"].append("No available employees for this shift")
                else:
                    unassigned_info["available_employees"] = available_employees
                    unassigned_info["reasons"].append("All available employees already assigned to other shifts")
                    
                diagnostic["unassigned_shifts"].append(unassigned_info)
        
        # Analyze employee workload
        for assignment in assignments:
            employee_id = self.get_id(assignment, ["employee_id"])
            diagnostic["employee_workload"][employee_id] += 1
        
        # Detect potential issues
        
        # Check for employees with too many shifts
        overloaded_employees = [emp_id for emp_id, count in diagnostic["employee_workload"].items() if count > 1]
        if overloaded_employees:
            diagnostic["warnings"].append(f"Employees assigned to multiple shifts: {overloaded_employees}")
        
        # Check for unbalanced shift type assignment
        if len(diagnostic["shift_types"]) > 0:
            for shift_type, count in diagnostic["shift_types"].items():
                assigned = diagnostic["assigned_shift_types"].get(shift_type, 0)
                if assigned < count:
                    diagnostic["warnings"].append(
                        f"Only {assigned}/{count} shifts of type {shift_type} were assigned"
                    )
        
        # Check for excessive employee workloads
        weekly_workloads = {}
        for employee_id, employee_assignments in self.assignments_by_employee.items():
            # Count shifts in the last 7 days
            week_start = date_to_check - timedelta(days=7)
            weekly_count = sum(
                1 for a in employee_assignments 
                if isinstance(a.get("date"), date) and week_start <= a.get("date") <= date_to_check
            )
            weekly_workloads[employee_id] = weekly_count
            
            if weekly_count > 5:  # More than 5 shifts per week
                diagnostic["warnings"].append(
                    f"Employee {employee_id} has {weekly_count} shifts in a 7-day period"
                )
        
        diagnostic["weekly_workloads"] = weekly_workloads
        
        return diagnostic

    def _get_intervals_covered_by_shift(
        self, 
        shift_start_time_str: str, 
        shift_end_time_str: str, 
        interval_minutes: int
    ) -> List[datetime.time]:
        """
        Calculates all time intervals covered by a given shift.

        Args:
            shift_start_time_str: Shift start time as "HH:MM".
            shift_end_time_str: Shift end time as "HH:MM".
            interval_minutes: The duration of each interval in minutes.

        Returns:
            A list of datetime.time objects representing the start of each interval covered by the shift.
        """
        intervals_covered = []
        if not shift_start_time_str or not shift_end_time_str or interval_minutes <= 0:
            return intervals_covered

        start_time = _time_str_to_datetime_time(shift_start_time_str)
        end_time = _time_str_to_datetime_time(shift_end_time_str)

        if not start_time or not end_time:
            self.logger.warning(f"Could not parse shift times: {shift_start_time_str} - {shift_end_time_str}")
            return intervals_covered

        current_interval_start = start_time
        # A shift covers an interval if the shift's start time is less than or equal to the interval's start time,
        # AND the shift's end time is greater than the interval's start time.
        # Iterate by advancing the interval start time.
        
        # Handle overnight shifts by creating datetime objects for comparison if end_time < start_time
        # For simplicity in this loop, we assume shifts are within a 24-hour period or end_time > start_time.
        # More robust overnight handling might be needed if shifts can span past midnight significantly.
        # For shifts ending at 00:00, treat as end of day (24:00)
        if end_time == datetime.min.time() and start_time != datetime.min.time():
             effective_end_time_dt = datetime.combine(datetime.min, datetime.max.time()) + timedelta(microseconds=1) # Effectively 24:00:00
        else:
             effective_end_time_dt = datetime.combine(datetime.min, end_time)
        
        start_dt = datetime.combine(datetime.min, start_time)

        loop_count = 0 # Safety break
        max_loops = (24 * 60) // interval_minutes + 1

        temp_interval_dt = datetime.combine(datetime.min, current_interval_start)

        while temp_interval_dt < effective_end_time_dt and loop_count < max_loops:
            # An interval is covered if its start time is >= shift_start_time and < shift_end_time
            if temp_interval_dt >= start_dt: # Check if interval start is within or at shift start
                intervals_covered.append(current_interval_start)
            
            # Advance to next interval
            temp_interval_dt += timedelta(minutes=interval_minutes)
            current_interval_start = temp_interval_dt.time()
            loop_count += 1
            if current_interval_start == start_time and loop_count > 1: # Avoid infinite loop if stuck
                break
        
        return intervals_covered

    def generate_assignments_for_day(
        self,
        current_date: date,
        potential_shifts: List[Dict],
        resources: ScheduleResources, 
        constraint_checker: ConstraintChecker, 
        availability_checker: AvailabilityChecker 
    ) -> List[Dict]:
        """
        Assigns employees to potential shifts for a given date to meet
        interval-based coverage requirements.
        """
        self.logger.info(f"--- Starting Distribution for {current_date} with {len(potential_shifts)} potential shifts ---")

        final_assignments_for_day: List[Dict] = []
        INTERVAL_MINUTES = 15 

        self.schedule_by_date[current_date] = [] 
        daily_interval_needs: Dict[datetime.time, Dict] = {}
        current_staffing_per_interval: Dict[datetime.time, Dict] = {}

        # --- Phase 1.2: Loop through Time Intervals & Get Needs ---
        current_time_for_interval = datetime.min.time() 
        loop_safety = 0
        while loop_safety < (24 * 60 // INTERVAL_MINUTES) + 2: # Safety break for the loop
            loop_safety +=1
            interval_needs = get_required_staffing_for_interval(
                target_date=current_date,
                interval_start_time=current_time_for_interval,
                resources=resources, 
                interval_duration_minutes=INTERVAL_MINUTES
            )
            daily_interval_needs[current_time_for_interval] = interval_needs
            # Initialize current staffing for this interval
            current_staffing_per_interval[current_time_for_interval] = {
                'assigned_employees_count': 0,
                'assigned_employee_ids': set(),
                'assigned_employee_types': set(),
                'keyholder_present': False
            }
            self.logger.debug(f"Interval {current_date} {current_time_for_interval}: Needs={interval_needs}")

            current_dt_obj = datetime.combine(datetime.min, current_time_for_interval) 
            next_interval_dt_obj = current_dt_obj + timedelta(minutes=INTERVAL_MINUTES)
            
            if next_interval_dt_obj.time() == datetime.min.time(): 
                break
            current_time_for_interval = next_interval_dt_obj.time()
            if current_time_for_interval == datetime.min.time() and INTERVAL_MINUTES > 0: 
                 break

        self.logger.info(f"Collected needs for {len(daily_interval_needs)} intervals on {current_date}.")

        # --- Phase 2: Develop the Interval-Based Assignment Algorithm ---
        final_assignments_for_day = self._perform_interval_based_assignments(
            current_date=current_date,
            potential_shifts=potential_shifts,
            daily_interval_needs=daily_interval_needs,
            current_staffing_per_interval=current_staffing_per_interval,
            resources=resources,
            constraint_checker=constraint_checker,
            availability_checker=availability_checker,
            interval_minutes=INTERVAL_MINUTES
        )
        
        # Update overall assignment tracking (used by historical/fairness calcs)
        for assignment in final_assignments_for_day:
            emp_id = assignment.get('employee_id')
            if emp_id:
                if emp_id not in self.assignments_by_employee:
                   self.assignments_by_employee[emp_id] = []
                self.assignments_by_employee[emp_id].append(assignment)
                # Update self.schedule_by_date for subsequent constraint checks within the same day if needed
                if current_date not in self.schedule_by_date:
                    self.schedule_by_date[current_date] = []
                self.schedule_by_date[current_date].append(assignment)

        self.logger.info(f"--- Distribution for {current_date} finished. Generated {len(final_assignments_for_day)} assignments. ---")
        return final_assignments_for_day

    def _perform_interval_based_assignments(
        self,
        current_date: date,
        potential_shifts: List[Dict],
        daily_interval_needs: Dict[datetime.time, Dict],
        current_staffing_per_interval: Dict[datetime.time, Dict],
        resources: ScheduleResources,
        constraint_checker: ConstraintChecker,
        availability_checker: AvailabilityChecker,
        interval_minutes: int
    ) -> List[Dict]:
        """
        Core logic for assigning employees to shifts to meet interval-based needs.
        Implements a greedy, interval-driven approach.
        """
        self.logger.info(f"Starting interval-based assignment for {current_date} with {len(potential_shifts)} potential shifts.")
        final_assignments: List[Dict] = []
        assigned_shift_ids_in_this_run = set() 

        # Pre-calculate covered intervals for all potential shifts
        shift_details_map = {}
        for shift_dict in potential_shifts: # Ensure this is a list of dicts
            shift_id = shift_dict.get('id')
            if not shift_id:
                self.logger.warning(f"Skipping potential shift without ID: {shift_dict}")
                continue
            shift_start_str = shift_dict.get('start_time')
            shift_end_str = shift_dict.get('end_time')
            # Ensure _get_intervals_covered_by_shift handles None start/end times if they can occur
            covered_intervals = self._get_intervals_covered_by_shift(shift_start_str, shift_end_str, interval_minutes)
            shift_dict['_covered_intervals'] = covered_intervals # Add to the dict
            shift_details_map[shift_id] = shift_dict 
            self.logger.debug(f"Shift {shift_id} ({shift_start_str}-{shift_end_str}) covers {len(covered_intervals)} intervals: {covered_intervals}")

        sorted_interval_times = sorted(daily_interval_needs.keys())

        for interval_time in sorted_interval_times:
            needs = daily_interval_needs[interval_time]
            current_staffing = current_staffing_per_interval[interval_time]
            required_employees = needs.get('min_employees', 0)
            current_employee_count_for_interval = current_staffing_per_interval[interval_time].get('current_employees', 0)
            staffing_deficit = required_employees - current_employee_count_for_interval

            self.logger.debug(f"Processing Interval {interval_time}. Needs: {required_employees}, Has: {current_employee_count_for_interval}, Deficit: {staffing_deficit}")

            loops = 0 
            max_loops_per_interval = required_employees * 2 + 2 # Try to fill deficit, allow some extra attempts
            while staffing_deficit > 0 and loops < max_loops_per_interval:
                loops += 1
                self.logger.info(f"Interval {interval_time} understaffed (deficit: {staffing_deficit}). Attempt {loops}." )

                candidate_shift_ids = [
                    shift_id for shift_id, shift_data in shift_details_map.items() 
                    if interval_time in shift_data.get('_covered_intervals', []) and shift_id not in assigned_shift_ids_in_this_run
                ]
                
                if not candidate_shift_ids:
                    self.logger.warning(f"Interval {interval_time} understaffed, but no available (not yet assigned) candidate shifts cover it.")
                    break 

                assignment_made = self._try_find_and_make_assignment(
                    current_date=current_date,
                    interval_time=interval_time,
                    candidate_shift_ids=candidate_shift_ids,
                    potential_shifts_map=shift_details_map, # Pass map for easy lookup
                    resources=resources,
                    constraint_checker=constraint_checker,
                    availability_checker=availability_checker,
                    current_staffing_per_interval=current_staffing_per_interval,
                    final_assignments_so_far=final_assignments, # Pass current assignments
                    assigned_shift_ids_in_this_run=assigned_shift_ids_in_this_run,
                    interval_duration_minutes=interval_minutes # Pass interval_minutes
                )

                if assignment_made:
                    self.logger.info(f"Assignment successful for interval {interval_time}: Emp {assignment_made.get('employee_id')} to Shift {assignment_made.get('shift_id')}")
                    final_assignments.append(assignment_made)
                    assigned_shift_ids_in_this_run.add(assignment_made.get('shift_id')) # Track assigned shift ID
                    
                    # --- CRITICAL UPDATE: Update current_staffing_per_interval for all intervals covered by this new assignment ---
                    assigned_shift_details = shift_details_map.get(assignment_made.get('shift_id'))
                    employee_obj = resources.get_employee_by_id(assignment_made.get('employee_id'))

                    if assigned_shift_details and employee_obj:
                        intervals_covered_by_newly_assigned_shift = assigned_shift_details.get('_covered_intervals', [])
                        for covered_interval_t in intervals_covered_by_newly_assigned_shift:
                            if covered_interval_t in current_staffing_per_interval:
                                current_staffing_per_interval[covered_interval_t]['current_employees'] = current_staffing_per_interval[covered_interval_t].get('current_employees', 0) + 1
                                current_staffing_per_interval[covered_interval_t]['assigned_employee_ids'].add(employee_obj.id)
                                
                                if getattr(employee_obj, 'is_keyholder', False):
                                    current_staffing_per_interval[covered_interval_t]['keyholder_present'] = True # Or increment a count if needed
                                
                                employee_group_str = str(getattr(employee_obj, 'employee_group', 'UNKNOWN'))
                                type_counts = current_staffing_per_interval[covered_interval_t].get('current_employee_types_count', defaultdict(int))
                                if not isinstance(type_counts, defaultdict):
                                    # If it was, e.g. just a set of types, re-initialize as defaultdict for counting
                                    self.logger.warning(f"Re-initializing type_counts for interval {covered_interval_t} as defaultdict(int)")
                                    type_counts = defaultdict(int)
                                type_counts[employee_group_str] += 1
                                current_staffing_per_interval[covered_interval_t]['current_employee_types_count'] = type_counts
                                self.logger.debug(f"Updated staffing for interval {covered_interval_t} due to new assignment: {current_staffing_per_interval[covered_interval_t]}")
                            else:
                                self.logger.warning(f"Interval {covered_interval_t} (covered by new shift {assignment_made.get('shift_id')}) not found in current_staffing_per_interval. Staffing may be inaccurate.")
                    else:
                        self.logger.error(f"Could not retrieve assigned_shift_details or employee_obj for new assignment {assignment_made.get('assignment_id')} - staffing update for covered intervals incomplete.")
                    # --- End CRITICAL UPDATE ---

                    # Update deficit based on updated current_staffing for the *target* interval_time
                    current_employee_count_for_interval = current_staffing_per_interval[interval_time].get('current_employees', 0)
                    staffing_deficit = required_employees - current_employee_count_for_interval
                    self.logger.debug(f"Interval {interval_time} deficit updated to: {staffing_deficit}")
                else:
                    self.logger.warning(f"Could not find suitable assignment for understaffed interval {interval_time} on attempt {loops}. Deficit remains {staffing_deficit}." )
                    break 

        self.logger.info(f"Interval-based assignment for {current_date} completed. Total assignments: {len(final_assignments)}")
        return final_assignments

    def _try_find_and_make_assignment(
        self,
        current_date: date,
        interval_time: datetime.time, # This is the target interval we are trying to fill
        candidate_shift_ids: List[int],
        potential_shifts_map: Dict[int, Dict], 
        resources: ScheduleResources,
        constraint_checker: ConstraintChecker,
        availability_checker: AvailabilityChecker,
        current_staffing_per_interval: Dict[datetime.time, Dict], # Full day's staffing snapshot
        final_assignments_so_far: List[Dict], 
        assigned_shift_ids_in_this_run: set,
        interval_duration_minutes: int # Added parameter
    ) -> Optional[Dict]:
        """
        Tries to find the best employee for a candidate shift that covers the understaffed interval
        and makes an assignment if a suitable candidate is found.

        Args:
            current_date: The date for which assignments are being made.
            interval_time: The specific interval that is understaffed.
            candidate_shift_ids: List of shift IDs that cover this interval.
            potential_shifts_map: Map of all potential shifts for the day.
            resources: ScheduleResources instance.
            constraint_checker: ConstraintChecker instance.
            availability_checker: AvailabilityChecker instance.
            current_staffing_per_interval: Snapshot of staffing levels for all intervals.
            final_assignments_so_far: List of assignments already made.
            assigned_shift_ids_in_this_run: Set of shift IDs already assigned in the current run.
            interval_duration_minutes: Duration of the interval in minutes.

        Returns:
            The new assignment dictionary if successful, otherwise None.
        """
        best_candidate_for_assignment = None
        highest_score = -float('inf')
        
        # Get the specific needs for the target interval
        target_interval_needs = self.current_daily_interval_needs.get(interval_time, {})
        if not target_interval_needs:
            self.logger.warning(f"No needs defined for interval {interval_time} on {current_date}, cannot assign.")
            return None

        self.logger.debug(f"Attempting to fill interval {interval_time} on {current_date}. Needs: {target_interval_needs}")
        self.logger.debug(f"Candidate shift IDs for interval {interval_time}: {candidate_shift_ids}")

        for shift_id in candidate_shift_ids:
            if shift_id in assigned_shift_ids_in_this_run:
                self.logger.debug(f"Shift ID {shift_id} already assigned in this run, skipping.")
                continue

            shift_template_dict = potential_shifts_map.get(shift_id)
            if not shift_template_dict:
                self.logger.warning(f"Shift ID {shift_id} not found in potential_shifts_map.")
                continue
            
            self.logger.debug(f"Evaluating shift_template_dict: {shift_template_dict} for interval {interval_time}")


            # Convert shift_template_dict to a ShiftTemplate-like object if necessary for scoring
            # This depends on how calculate_assignment_score expects its shift_template argument
            # For now, assuming it can handle a dictionary or we adapt it.
            
            # Identify employees who *could* work this shift_template
            # This requires access to all employees and their general suitability for the shift_template (e.g., skills, groups)
            # For simplicity, let's iterate through all active employees from resources
            # In a more optimized version, this list would be pre-filtered.
            
            active_employees = [e for e in resources.employees if getattr(e, 'is_active', True)]

            for employee in active_employees:
                employee_id = self.get_id(employee)
                if not employee_id:
                    self.logger.warning(f"Skipping employee without ID: {employee}")
                    continue

                # 1. Check if employee is already assigned to ANY shift today
                # This prevents an employee from being assigned to more than one shift per day.
                is_employee_assigned_today = any(
                    asn.get('employee_id') == employee_id
                    for asn in final_assignments_so_far
                )
                if is_employee_assigned_today:
                    self.logger.debug(f"Employee {employee_id} already assigned a shift today. Skipping for shift {shift_id}.")
                    continue

                # 2. Check availability for this specific shift on this date
                # The availability_checker needs shift start and end times.
                shift_start_time_obj = _time_str_to_datetime_time(shift_template_dict['start_time'])
                shift_end_time_obj = _time_str_to_datetime_time(shift_template_dict['end_time'])

                availability_status, _ = availability_checker.check_employee_availability(
                    employee_id=employee_id,
                    check_date=current_date,
                    shift_start_time=shift_start_time_obj,
                    shift_end_time=shift_end_time_obj,
                    shift_id=shift_id # Pass shift_id for context if needed by checker
                )
                if availability_status == AvailabilityType.UNAVAILABLE: # Using the imported AvailabilityType
                    self.logger.debug(f"Employee {employee_id} UNAVAILABLE for shift {shift_id} on {current_date}. Status: {availability_status}")
                    continue
                
                self.logger.debug(f"Employee {employee_id} AVAILABLE for shift {shift_id} on {current_date} with status {availability_status}")

                # 3. Check constraints
                # Create a hypothetical assignment to check constraints
                hypothetical_assignment = {
                    "employee_id": employee_id,
                    "shift_id": shift_id, 
                    "shift_template_id": shift_template_dict.get("shift_template_id", shift_id), # Use shift_template_id if available
                    "date": current_date,
                    "start_time": shift_template_dict['start_time'],
                    "end_time": shift_template_dict['end_time'],
                    "shift_type": shift_template_dict.get('shift_type', 'Unknown'), # Add shift_type
                     # Add other relevant details from shift_template_dict
                }
                
                # Get shift intervals for context in constraint checking and scoring
                shift_covered_intervals = self._get_intervals_covered_by_shift(
                    shift_template_dict['start_time'], 
                    shift_template_dict['end_time'], 
                    interval_duration_minutes
                )

                # Check constraints with all_current_assignments + this hypothetical one
                # Pass existing assignments for comprehensive check
                constraint_violations = constraint_checker.check_all_constraints(
                    employee_id=employee_id,
                    new_shift_start=datetime.combine(current_date, shift_start_time_obj),
                    new_shift_end=datetime.combine(current_date, shift_end_time_obj),
                    existing_assignments=final_assignments_so_far # Use assignments made so far in this run
                )
                if constraint_violations:
                    self.logger.debug(f"Employee {employee_id} violates constraints for shift {shift_id} on {current_date}. Violations: {constraint_violations}")
                    continue
                
                self.logger.debug(f"Employee {employee_id} passed constraint checks for shift {shift_id} on {current_date}.")

                # 4. Score this potential assignment
                # Ensure context for scoring has all required keys
                scoring_context = {
                    'target_interval_needs': target_interval_needs,
                    'shift_covered_intervals': shift_covered_intervals,
                    'full_day_staffing_snapshot': current_staffing_per_interval, # The full day's picture
                    'interval_duration_minutes': interval_duration_minutes,
                    'employee_object': employee # Pass the employee object for seniority, etc.
                }
                
                # Ensure shift_template_dict is compatible with ShiftTemplate or adapt
                # For now, assuming calculate_assignment_score can handle dict or a Pydantic-like model
                # If ShiftTemplate is a SQLAlchemy model, direct instantiation might be complex here.
                # A simpler DTO or ensuring shift_template_dict has all fields is better.

                # Use the availability_status from the earlier check
                score = self.calculate_assignment_score(
                    employee_id, 
                    shift_template_dict, # Pass the dict
                    current_date, 
                    context=scoring_context,
                    availability_type_override=availability_status 
                )
                
                self.logger.debug(f"Score for employee {employee_id}, shift {shift_id} on {current_date}: {score}")

                if score > highest_score:
                    highest_score = score
                    best_candidate_for_assignment = {
                        "employee_id": employee_id,
                        "employee_instance": employee, # Keep the employee object for later use if needed
                        "shift_id": shift_id,
                        "shift_template_data": shift_template_dict, # Keep the shift data
                        "score": score,
                    }
                    self.logger.debug(f"New best candidate: E{employee_id} for S{shift_id}, score {score}")

        if best_candidate_for_assignment:
            employee_id = best_candidate_for_assignment["employee_id"]
            assigned_shift_id = best_candidate_for_assignment["shift_id"]
            assigned_shift_data = best_candidate_for_assignment["shift_template_data"]
            
            self.logger.info(
                f"Selected for assignment: Employee {employee_id} to Shift {assigned_shift_id} "
                f"({assigned_shift_data['start_time']}-{assigned_shift_data['end_time']}) "
                f"for interval {interval_time} on {current_date} with score {best_candidate_for_assignment['score']}."
            )

            new_assignment = {
                "assignment_id": f"asgn_{current_date.strftime('%Y%m%d')}_{employee_id}_{assigned_shift_id}", # Example ID
                "employee_id": employee_id,
                "shift_id": assigned_shift_id,
                "shift_template_id": assigned_shift_data.get("shift_template_id", assigned_shift_id),
                "date": current_date,
                "start_time": assigned_shift_data["start_time"],
                "end_time": assigned_shift_data["end_time"],
                "duration_hours": self.calculate_duration(assigned_shift_data["start_time"], assigned_shift_data["end_time"]),
                "status": "PENDING", # Or "CONFIRMED" if direct
                "version": self.resources.version_id, # Assuming version_id is available in resources
                "shift_type": assigned_shift_data.get("shift_type", "Unknown"),
                "employee_group": getattr(best_candidate_for_assignment["employee_instance"], "employee_group", "Unknown"),
                "score": best_candidate_for_assignment["score"]
            }
            
            # Update employee history and other relevant structures
            self.update_with_assignment(
                employee_id=employee_id,
                shift_details=assigned_shift_data, # Pass the shift dict
                shift_date=current_date,
                new_assignment_dict=new_assignment # Pass the newly created assignment
            )
            
            # Add to final_assignments_so_far and assigned_shift_ids_in_this_run
            # These are updated by the calling function _perform_interval_based_assignments
            # This function should just return the new assignment.

            self.logger.info(f"Successfully created assignment: {new_assignment}")
            return new_assignment
        else:
            self.logger.info(
                f"No suitable candidate found to make an assignment for interval {interval_time} on {current_date} "
                f"from candidate shifts: {candidate_shift_ids}."
            )
            return None

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
        cov_id = getattr(coverage, 'id', 'N/A')
        self.logger.debug(f"Checking if coverage {cov_id} applies to {check_date}")

        # Check for specific date first (higher priority)
        if hasattr(coverage, "date") and coverage.date:
            coverage_date = coverage.date
            if isinstance(coverage_date, str):
                try:
                    coverage_date = date.fromisoformat(coverage_date.split('T')[0]) # Handle datetime strings
                except (ValueError, TypeError):
                    self.logger.warning(f"Coverage {cov_id} has invalid date string: {coverage.date}")
                    return False
            elif not isinstance(coverage_date, date):
                 self.logger.warning(f"Coverage {cov_id} has unexpected date type: {type(coverage.date)}")
                 return False

            applies = (coverage_date == check_date)
            self.logger.debug(f"Coverage {cov_id} has specific date {coverage_date}. Match with {check_date}: {applies}")
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

                # FIXED: Both coverage model and Python's weekday() use the same convention
                # (0=Monday, 6=Sunday) so no conversion is needed
                applies = (check_weekday == coverage_day_index)

                self.logger.debug(
                    f"Coverage {cov_id} day_index={coverage_day_index}. Check date {check_date} python_weekday={check_weekday}. Match: {applies}"
                )
                return applies
            except (ValueError, TypeError):
                 self.logger.warning(f"Coverage {cov_id} has invalid day_index/day_of_week: {day_field}")
                 return False

        self.logger.debug(f"Coverage {cov_id} has no specific date or applicable day of week. No match.")
        return False

    def is_interval_covered(
        self, 
        interval_start_time: datetime.time, 
        interval_needs: Dict[str, Any], 
        current_staffing_for_interval_entry: Dict[str, Any],
        log_details: bool = False
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
        if not interval_needs: # No needs defined, so technically covered (or an issue upstream)
            if log_details:
                self.logger.debug(f"is_interval_covered [{interval_start_time}]: No specific needs defined, assuming covered.")
            return True

        # 1. Check min_employees
        required_min_employees = interval_needs.get('min_employees', 0)
        actual_employees = current_staffing_for_interval_entry.get('current_employees', 0)
        if actual_employees < required_min_employees:
            if log_details:
                self.logger.info(f"is_interval_covered [{interval_start_time}]: FAILED - Min employees not met. Need: {required_min_employees}, Have: {actual_employees}")
            return False

        # 2. Check requires_keyholder
        if interval_needs.get('requires_keyholder', False):
            actual_keyholders = current_staffing_for_interval_entry.get('current_keyholders', 0)
            if actual_keyholders == 0:
                if log_details:
                    self.logger.info(f"is_interval_covered [{interval_start_time}]: FAILED - Keyholder required but none present. Actual keyholders: {actual_keyholders}")
                return False
        
        # 3. Check employee_types (if any are specified as required)
        #    This checks if *at least one* employee of each *required* type is present.
        #    Or, if needs specify min counts per type, that should be checked.
        #    Current `get_required_staffing_for_interval` seems to return a list of allowed types,
        #    not necessarily counts per type. Assuming for now it implies at least one if type is listed.
        #    If `interval_needs` provides something like `min_per_type: {'Cashier': 1, 'Barista': 1}` then logic would adapt.
        required_employee_types = interval_needs.get('employee_types', [])
        if required_employee_types: # Only check if specific types are listed as required
            actual_type_counts = current_staffing_for_interval_entry.get('current_employee_types_count', {})
            # Ensure actual_type_counts is a dict, defaulting to empty if not or None
            if not isinstance(actual_type_counts, dict): actual_type_counts = {}

            all_types_met = True
            for req_type in required_employee_types:
                if actual_type_counts.get(req_type, 0) == 0:
                    all_types_met = False
                    if log_details:
                        self.logger.info(f"is_interval_covered [{interval_start_time}]: FAILED - Required employee type '{req_type}' not present or count is zero. Actual counts: {actual_type_counts}")
                    break # No need to check further types if one is missing
            if not all_types_met:
                return False
        
        if log_details: # If all checks passed
            self.logger.debug(f"is_interval_covered [{interval_start_time}]: PASSED. Needs: {interval_needs}, Has: {current_staffing_for_interval_entry}")
        return True

    def get_employees_working_during_interval(
        self,
        interval_start_time: datetime.time,
        all_final_assignments: List[Dict[str, Any]]
    ) -> List[Employee]:
        """
        Retrieves a list of Employee objects who are working during the specified time interval.

        Args:
            interval_start_time: The start time of the interval to check.
            all_final_assignments: A list of assignment dictionaries for the day.

        Returns:
            A list of Employee objects working during that interval.
        """
        working_employees: List[Employee] = []
        employee_ids_working: set[int] = set() # To avoid duplicate Employee objects if somehow assigned multiple overlapping shifts

        # Convert interval_start_time to a full datetime object for easier comparison with shift times
        # Assuming a generic date for this conversion, as we only care about the time part relative to shift times.
        base_date = datetime.min.date() # Could be any date, e.g., current_date if available and relevant
        interval_start_dt = datetime.combine(base_date, interval_start_time)

        for assignment in all_final_assignments:
            shift_start_str = assignment.get('start_time')
            shift_end_str = assignment.get('end_time')
            employee_id = assignment.get('employee_id')

            if not shift_start_str or not shift_end_str or employee_id is None:
                self.logger.warning(f"get_employees_working_during_interval: Assignment missing start/end time or employee_id: {assignment}")
                continue

            try:
                assigned_shift_start_time = _time_str_to_datetime_time(shift_start_str)
                assigned_shift_end_time = _time_str_to_datetime_time(shift_end_str)

                if not assigned_shift_start_time or not assigned_shift_end_time:
                    self.logger.warning(f"get_employees_working_during_interval: Could not parse shift times for assignment {assignment.get('id', 'N/A')}")
                    continue
                
                assigned_shift_start_dt = datetime.combine(base_date, assigned_shift_start_time)
                assigned_shift_end_dt = datetime.combine(base_date, assigned_shift_end_time)

                # Handle overnight shifts for comparison (where end time is on the next day, e.g. 22:00-02:00)
                if assigned_shift_end_dt <= assigned_shift_start_dt: # Covers 00:00 end or overnight
                    # If interval is within the first part of an overnight shift (e.g. shift 22-02, interval 23:00)
                    # OR if interval is within the second part (e.g. shift 22-02, interval 01:00)
                    # This check: (interval_start >= shift_start) OR (interval_start < shift_end)
                    # To be more precise for overnight: shift_end_dt is effectively on day + 1
                    # A simple check: Is interval_start_time within [shift_start_time, 23:59:59] OR [00:00:00, shift_end_time)?
                    # Current logic: A shift covers an interval if interval_start_time falls within [shift_start, shift_end)
                    # For an overnight shift like 22:00 to 02:00:
                    # - Interval 23:00: 22:00 <= 23:00 AND 23:00 < 02:00 (false without adjustment for day change)
                    # If shift ends on next day, add 24 hours to its end time for comparison range.
                    if assigned_shift_end_time < assigned_shift_start_time: # True overnight shift that crosses midnight
                         assigned_shift_end_dt_for_comparison = assigned_shift_end_dt + timedelta(days=1)
                    elif assigned_shift_end_time == datetime.min.time() and assigned_shift_start_time != datetime.min.time(): # Shift ends exactly at midnight e.g. 16:00 - 00:00
                         assigned_shift_end_dt_for_comparison = datetime.combine(base_date + timedelta(days=1), datetime.min.time())
                    else: # Standard shift or shift that ends at 00:00 and starts at 00:00 (unlikely full 24h)
                         assigned_shift_end_dt_for_comparison = assigned_shift_end_dt
                else: # Standard same-day shift
                    assigned_shift_end_dt_for_comparison = assigned_shift_end_dt

                # Check: shift_start <= interval_start < shift_end
                if assigned_shift_start_dt <= interval_start_dt < assigned_shift_end_dt_for_comparison:
                    if employee_id not in employee_ids_working:
                        employee = self.resources.get_employee_by_id(employee_id)
                        if employee:
                            working_employees.append(employee)
                            employee_ids_working.add(employee_id)
                        else:
                            self.logger.warning(f"get_employees_working_during_interval: Employee ID {employee_id} not found in resources.")
            except ValueError as e:
                self.logger.error(f"get_employees_working_during_interval: Error parsing time for assignment {assignment.get('id', 'N/A')}: {e}")
                continue
        
        return working_employees
