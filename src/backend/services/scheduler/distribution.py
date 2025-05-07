"""Distribution module for fair employee assignment across shifts."""

from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import date, datetime, timedelta
from collections import defaultdict
import functools
import sys
import os
import logging

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
                        assignment = {
                            "employee_id": employee_id,
                            "shift_id": shift_id,
                            "date": current_date,
                            "start_time": shift_template.get("start_time"),
                            "end_time": shift_template.get("end_time"),
                            "shift_type": shift_type,
                            "status": "PENDING",
                            "version": 1
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
                shift_id = assignment.get("shift_id")
                if (
                    shift_id in self.shift_scores
                    and self.shift_scores[shift_id]["type"] == shift_type
                ):
                    type_count += 1

        # Handle case with no assignments
        if total_shifts == 0:
            return 0.33  # Default to ideal distribution

        return type_count / total_shifts

    @functools.lru_cache(maxsize=256)
    def calculate_assignment_score(
        self,
        employee_id: int,
        shift: ShiftTemplate,
        shift_date: date,
        context: Dict[str, Any] = None,
    ) -> float:
        """Calculate a score for assigning this employee to this shift

        Lower scores are better - employee with lowest score should be assigned.
        """
        base_score = 100  # Start with a base score

        # Get shift details (use cached shift scores)
        shift_id = shift.id
        shift_data = self.shift_scores.get(shift_id, {})
        shift_score = shift_data.get("score", 0)
        shift_type = shift_data.get("type", "unknown")

        # Get employee's existing assignments
        employee_assignments = self.assignments_by_employee.get(employee_id, [])

        # Employee's workload factor (penalize employees with more assignments)
        workload_factor = len(employee_assignments) * 5

        # Get employee's contracted hours
        contracted_hours = 0
        for employee in self.employees:
            if employee.id == employee_id:
                contracted_hours = employee.contracted_hours
                break

        # Adjust workload based on contracted hours (higher hours = can take more shifts)
        if contracted_hours > 0:
            workload_factor = workload_factor * (40 / contracted_hours)

        # Count shift types this employee already has
        employee_shift_types = {"EARLY": 0, "MIDDLE": 0, "LATE": 0}

        for assignment in employee_assignments:
            assigned_shift_id = assignment.get("shift_id")
            if assigned_shift_id in self.shift_scores:
                assigned_type = self.shift_scores[assigned_shift_id].get(
                    "type", "unknown"
                )
                if assigned_type in employee_shift_types:
                    employee_shift_types[assigned_type] += 1

        # Calculate employee shift type balance factor
        total_shifts = sum(employee_shift_types.values())
        if total_shifts > 0:
            # Calculate current percentages
            type_percentages = {
                t: (count / total_shifts * 100)
                for t, count in employee_shift_types.items()
            }

            # Ideal distribution would be ~33% of each type
            # Penalize already overrepresented shift types for this employee
            current_type_percentage = type_percentages.get(shift_type, 0)

            # Apply heavier penalties for unbalanced distributions
            if shift_type == "EARLY" and current_type_percentage > 50:
                # If employee already has too many early shifts
                base_score += 50
            elif shift_type == "EARLY" and current_type_percentage > 33:
                base_score += 25
            elif shift_type == "MIDDLE" and current_type_percentage < 20:
                # If employee doesn't have enough middle shifts
                base_score -= 30
            elif shift_type == "late" and current_type_percentage < 20:
                # If employee doesn't have enough late shifts
                base_score -= 30

        # Add weekend/holiday factors if applicable
        shift_day = shift_date.weekday()
        weekend_penalty = 0
        if shift_day >= 5:  # Saturday or Sunday
            weekend_penalty = 15

            # Check how many weekend shifts the employee already has
            weekend_shifts = sum(
                1
                for a in employee_assignments
                if a.get("date") and a.get("date").weekday() >= 5
            )

            # Higher penalty if employee already has weekend shifts
            weekend_penalty += weekend_shifts * 10

        # Calculate final score
        final_score = base_score + shift_score + workload_factor + weekend_penalty

        # Log assignment consideration
        self.logger.debug(
            f"Employee {employee_id} assignment score for shift {shift_id} ({shift_type}): {final_score:.2f} "
            f"(base={base_score}, shift={shift_score}, workload={workload_factor}, weekend={weekend_penalty})"
        )

        return final_score

    def _calculate_base_score(self, shift: ShiftTemplate, shift_date: date) -> float:
        """Calculate the base desirability score for a shift"""
        # Start with standard score
        score = ShiftScore.STANDARD

        # We don't need to calculate these as we'll use _categorize_shift directly
        # Let's use the shift categorization we already have
        shift_type = self._categorize_shift(shift)

        # Adjust base scores to create better distribution
        if shift_type == "early":
            # Make early shifts have a higher score (less desirable)
            # because we have too many of them
            score = ShiftScore.EARLY_MORNING + 2.0
        elif shift_type == "middle":
            # Make middle shifts more desirable with lower score
            score = ShiftScore.STANDARD - 1.0
        elif shift_type == "late":
            # Make late shifts more desirable with lower score
            score = ShiftScore.STANDARD - 1.0

        # Weekend shifts are still special
        if shift_date.weekday() >= 5:  # Saturday (5) or Sunday (6)
            score = ShiftScore.WEEKEND

        # TODO: Add holiday check

        return score

    def _calculate_history_adjustment(
        self, employee_id: int, shift: ShiftTemplate, shift_date: date
    ) -> float:
        """Calculate adjustment based on employee's shift history"""
        if employee_id not in self.employee_history:
            return 0.0

        history = self.employee_history[employee_id]
        category = self._categorize_shift(shift)

        # If employee has done very few of these shifts, encourage assignment
        if history["total"] > 0:
            category_ratio = history[category] / history["total"]

            # Check overall distribution of shift types in employee history
            early_ratio = history["EARLY"] / max(history["total"], 1)
            middle_ratio = history["MIDDLE"] / max(history["total"], 1)
            late_ratio = history["LATE"] / max(history["total"], 1)

            # Get ideal distribution - balanced across shift types
            ideal = {
                "early": 0.34,
                "middle": 0.33,
                "late": 0.33,
            }

            # Calculate adjustment based on how far this employee is from the ideal
            # distribution for this shift type
            if category in ideal:
                target_ratio = ideal[category]

                # If this is an "early" shift and employee already has too many
                if category == "early" and early_ratio > ideal["early"] + 0.1:
                    # Apply a larger penalty to discourage more early shifts
                    return 5.0 * (early_ratio - ideal["early"])

                # If this is a "middle" or "late" shift and employee has too few
                if (category == "middle" and middle_ratio < ideal["middle"] - 0.1) or (
                    category == "late" and late_ratio < ideal["late"] - 0.1
                ):
                    # Apply a larger bonus to encourage more of these shifts
                    return -5.0 * (ideal[category] - category_ratio)

                # Regular adjustment based on distance from ideal ratio
                return 3.0 * (category_ratio - target_ratio)

        return 0.0

    def _calculate_preference_adjustment(
        self, employee_id: int, shift: ShiftTemplate, shift_date: date
    ) -> float:
        """Calculate adjustment based on employee preferences"""
        if employee_id not in self.employee_preferences:
            return 0.0

        prefs = self.employee_preferences[employee_id]
        adjustment = 0.0

        # Check for preferred days
        day_of_week = shift_date.strftime("%A").lower()
        if day_of_week in prefs["preferred_days"]:
            adjustment += ShiftScore.EMPLOYEE_PREFERENCE_MATCH

        # Check for avoided days
        if day_of_week in prefs["avoid_days"]:
            adjustment += ShiftScore.EMPLOYEE_PREFERENCE_AVOID

        # Check for preferred shifts (would need to match on shift template id or similar)
        # This implementation will depend on how shift preferences are stored

        return adjustment

    def _calculate_seniority_adjustment(
        self, employee_id: int, context: Dict[str, Any]
    ) -> float:
        """Calculate adjustment based on employee seniority"""
        # This implementation will depend on how seniority is stored
        # For now, return a neutral adjustment
        return 0.0

    def update_with_assignment(self, employee_id, shift, shift_date):
        """Update the distribution manager with a new assignment"""
        self.logger.info(
            f"Recording assignment: Employee {employee_id} to shift {shift.id} on {shift_date}"
        )

        # Initialize assignment list for employee if not exists
        if employee_id not in self.assignments_by_employee:
            self.assignments_by_employee[employee_id] = []

        # Record the assignment
        assignment = {
            "shift_id": shift.id,
            "date": shift_date,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
        }

        # Add additional info if available in shift_scores
        if shift.id in self.shift_scores:
            shift_data = self.shift_scores[shift.id]
            assignment["shift_type"] = shift_data.get("type", "unknown")

        # Add the assignment to the employee's list
        self.assignments_by_employee[employee_id].append(assignment)

        # Update any caches
        for func in [self.calculate_assignment_score]:
            if hasattr(func, "cache_clear"):
                func.cache_clear()

        self.logger.debug(
            f"Employee {employee_id} now has {len(self.assignments_by_employee[employee_id])} assignments"
        )

    def get_distribution_metrics(self) -> Dict[str, Any]:
        """Get metrics about the current shift distribution"""
        total_shifts = 0
        type_counts = {"EARLY": 0, "MIDDLE": 0, "LATE": 0, "weekend": 0}

        # Count shifts by type
        for employee_id, assignments in self.assignments_by_employee.items():
            for assignment in assignments:
                total_shifts += 1
                shift_type = assignment.get(
                    "shift_type", "EARLY"
                )  # Default to EARLY if not specified
                if shift_type in type_counts:
                    type_counts[shift_type] += 1

                # Check for weekend shifts
                if isinstance(assignment.get("date"), date):
                    if assignment["date"].weekday() >= 5:  # Saturday = 5, Sunday = 6
                        type_counts["weekend"] += 1

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

    def assign_employees_with_distribution(
        self, current_date: date, shifts: List[Any], coverage: Dict[str, int]
    ) -> List[Dict]:
        """Assign employees to shifts using distribution metrics"""
        try:
            self.logger.info(f"Starting employee assignment for date {current_date}")
            self.logger.info(f"Available shifts: {len(shifts)}")
            self.logger.info(f"Coverage requirements: {coverage}")

            assignments = []

            # First assign keyholders if needed
            try:
                self.logger.info("Attempting to assign keyholders")
                keyholder_assignments = self.assign_keyholders(current_date, shifts)
                if keyholder_assignments:
                    self.logger.info(
                        f"Assigned {len(keyholder_assignments)} keyholders"
                    )
                    assignments.extend(keyholder_assignments)
                else:
                    self.logger.warning("No keyholder assignments made")
            except Exception as e:
                self.logger.error(f"Error assigning keyholders: {str(e)}")
                self.logger.error("Stack trace:", exc_info=True)

            # Group remaining shifts by type
            shifts_by_type = {}
            for shift in shifts:
                if not self.is_shift_assigned(shift, assignments):
                    # Get shift type using various fallbacks
                    shift_type = self.extract_shift_type(shift)
                    self.logger.info(f"Categorized shift as type {shift_type}")

                    if shift_type not in shifts_by_type:
                        shifts_by_type[shift_type] = []
                    shifts_by_type[shift_type].append(shift)

            self.logger.info(
                f"Remaining shifts by type: {[(t, len(s)) for t, s in shifts_by_type.items()]}"
            )

            # If we have no shift types categorized, try a fallback approach
            if not shifts_by_type:
                self.logger.warning("No shifts categorized by type. Using fallback approach.")
                # Fallback: Just put all shifts in a GENERAL category
                shifts_by_type["GENERAL"] = [s for s in shifts if not self.is_shift_assigned(s, assignments)]
                self.logger.info(f"Fallback - Assigned {len(shifts_by_type['GENERAL'])} shifts to GENERAL type")

            # Then assign regular employees by shift type
            for shift_type, type_shifts in shifts_by_type.items():
                try:
                    self.logger.info(
                        f"Processing assignments for shift type: {shift_type}"
                    )
                    self.logger.info(
                        f"Available shifts of this type: {len(type_shifts)}"
                    )

                    # Get available employees for this shift type
                    available_employees = self.get_available_employees(
                        current_date, type_shifts
                    )
                    self.logger.info(
                        f"Available employees for shift type {shift_type}: {len(available_employees)}"
                    )

                    # If we have no available employees but we have shifts, try using all active employees
                    if not available_employees and type_shifts:
                        self.logger.warning(f"No specifically available employees for {shift_type}. Using all active employees as fallback.")
                        # Fallback to using all employees
                        all_employees = [e for e in self.resources.employees if getattr(e, "is_active", True)]
                        self.logger.info(f"Fallback - Using {len(all_employees)} active employees")
                        available_employees = all_employees

                    type_assignments = self.assign_employees_by_type(
                        current_date, type_shifts, available_employees, shift_type
                    )

                    if type_assignments:
                        self.logger.info(
                            f"Made {len(type_assignments)} assignments for shift type {shift_type}"
                        )
                        assignments.extend(type_assignments)
                    else:
                        self.logger.warning(
                            f"No assignments made for shift type {shift_type}"
                        )

                except Exception as e:
                    self.logger.error(
                        f"Error assigning employees for shift type {shift_type}: {str(e)}"
                    )
                    self.logger.error("Stack trace:", exc_info=True)

            self.logger.info(f"Total assignments made: {len(assignments)}")
            
            # Generate diagnostic information
            diagnostics = self.generate_diagnostic_report(current_date, shifts, assignments)
            
            # Log diagnostic information 
            self.logger.info(f"Assignment success rate: {diagnostics['success_rate']}%")
            
            if diagnostics['warnings']:
                for warning in diagnostics['warnings']:
                    self.logger.warning(f"Diagnostic warning: {warning}")
                
            # Log detailed info if we have problems
            if diagnostics['success_rate'] < 100:
                self.logger.warning("Incomplete assignment - detailed diagnostic information follows:")
                self.logger.warning(f"Unassigned shifts: {len(diagnostics['unassigned_shifts'])}")
                for shift in diagnostics['unassigned_shifts']:
                    self.logger.warning(f"  Shift {shift['shift_id']} ({shift['shift_type']}): {', '.join(shift['reasons'])}")
            
            return assignments

        except Exception as e:
            self.logger.error(f"Error in assign_employees_with_distribution: {str(e)}")
            self.logger.error("Stack trace:", exc_info=True)
            raise
            
    def extract_shift_type(self, shift: Any) -> str:
        """Extract shift type from a shift object or dictionary with consistent fallbacks
        
        Args:
            shift: The shift object or dictionary
            
        Returns:
            A standardized shift type string (EARLY, MIDDLE, LATE, or GENERAL)
        """
        # Try to get shift_type_id first
        shift_type = None
        
        # Get from shift_type_id attribute/key
        if isinstance(shift, dict):
            shift_type = shift.get("shift_type_id")
        else:
            shift_type = getattr(shift, "shift_type_id", None)

        # If no shift_type_id, try shift_type
        if not shift_type:
            if isinstance(shift, dict):
                shift_type = shift.get("shift_type")
            else:
                shift_type = getattr(shift, "shift_type", None)
                
        # Handle potential enum or object values
        if hasattr(shift_type, 'value'):
            shift_type = shift_type.value
        elif hasattr(shift_type, '__str__'):
            shift_type = str(shift_type)
            
        # If we have a string type at this point, normalize to uppercase
        if isinstance(shift_type, str):
            shift_type = shift_type.upper()
            
            # Additional validation that type is one of our expected values
            valid_types = ["EARLY", "MIDDLE", "LATE"]
            if shift_type not in valid_types:
                # Try to match based on substring
                for valid_type in valid_types:
                    if valid_type in shift_type:
                        return valid_type
        
        # If still no type, determine from time
        if not shift_type:
            start_time = None
            if isinstance(shift, dict):
                start_time = shift.get("start_time")
            else:
                start_time = getattr(shift, "start_time", None)

            if start_time:
                try:
                    start_hour = int(start_time.split(":")[0])
                    if start_hour < 11:
                        shift_type = "EARLY"
                    elif start_hour >= 14:
                        shift_type = "LATE"
                    else:
                        shift_type = "MIDDLE"
                except (ValueError, IndexError):
                    shift_type = "MIDDLE"  # Default to MIDDLE if time parsing fails
            else:
                shift_type = "MIDDLE"  # Default to MIDDLE if no time available
                
        # Final validation - if we still don't have a valid type, use MIDDLE as default
        if not shift_type or not isinstance(shift_type, str):
            shift_type = "MIDDLE"
            
        return shift_type

    def get_available_employees(
        self, date_to_check: date, shifts: List[Any] = None
    ) -> List[Employee]:
        """Get all employees available on the given date and for the given shifts"""
        self.logger.info(f"Finding available employees for date: {date_to_check}")
        available_employees = []
        
        # Track availability reasons for diagnostics
        availability_status = {}
        
        # First get all employees that are active
        active_employees = [emp for emp in self.resources.employees if getattr(emp, "is_active", True)]
        self.logger.info(f"Found {len(active_employees)} active employees")
        
        if not active_employees:
            self.logger.error("No active employees found in resources")
            return []

        # Process each employee for availability
        for employee in active_employees:
            employee_id = self.get_id(employee, ["id", "employee_id"])
            if employee_id is None:
                self.logger.warning(f"Employee has no ID, skipping: {employee}")
                continue
                
            # Initialize tracking for this employee
            availability_status[employee_id] = {
                "is_on_leave": False,
                "available_for_shifts": [],
                "unavailable_for_shifts": []
            }

            # Check if employee is on leave (if availability checker exists)
            if self.availability_checker and self.availability_checker.is_employee_on_leave(employee_id, date_to_check):
                self.logger.info(f"Employee {employee_id} is on leave for {date_to_check}")
                availability_status[employee_id]["is_on_leave"] = True
                continue

            # Track if employee is available for at least one shift
            available_for_any_shift = False
            
            # If shifts are provided and we have an availability checker, check availability for each shift
            if shifts and self.availability_checker:
                for shift in shifts:
                    shift_id = self.get_id(shift, ["id", "shift_id"])
                    if not shift_id:
                        continue
                        
                    shift_template = None
                    if isinstance(shift, dict):
                        shift_template = self.resources.get_shift(shift.get("shift_id", shift.get("id")))
                    else:
                        shift_template = self.resources.get_shift(shift_id)

                    if not shift_template:
                        self.logger.warning(f"Could not find shift template for ID {shift_id}")
                        continue

                    is_available, avail_type = self.availability_checker.is_employee_available(
                        employee_id, date_to_check, shift_template
                    )
                    
                    if is_available:
                        availability_status[employee_id]["available_for_shifts"].append(shift_id)
                        available_for_any_shift = True
                    else:
                        availability_status[employee_id]["unavailable_for_shifts"].append(shift_id)
                
                # Only add employee if they're available for at least one shift
                if available_for_any_shift:
                    available_employees.append(employee)
                    self.logger.info(f"Employee {employee_id} is available for {len(availability_status[employee_id]['available_for_shifts'])} shifts")
            else:
                # If no availability checker or no shifts specified, consider all active employees available
                available_employees.append(employee)
                self.logger.info(f"Employee {employee_id} added to available list (no specific availability check)")

        # Log overall availability statistics
        total_available = len(available_employees)
        total_unavailable = len(active_employees) - total_available
        self.logger.info(f"Found {total_available} available employees out of {len(active_employees)} active employees")
        self.logger.info(f"{total_unavailable} employees are unavailable for this date/shifts")
        
        # Log detailed availability information at debug level
        for emp_id, status in availability_status.items():
            if status["is_on_leave"]:
                self.logger.debug(f"Employee {emp_id} is on leave")
            elif not status["available_for_shifts"] and status["unavailable_for_shifts"]:
                self.logger.debug(f"Employee {emp_id} is unavailable for all requested shifts")
            elif status["available_for_shifts"]:
                self.logger.debug(f"Employee {emp_id} is available for shifts: {status['available_for_shifts']}")
                if status["unavailable_for_shifts"]:
                    self.logger.debug(f"Employee {emp_id} is unavailable for shifts: {status['unavailable_for_shifts']}")

        # If no employees are available through normal means, use all active employees as a fallback
        if not available_employees:
            self.logger.warning("No employees available through normal availability checks. Using all active employees as fallback.")
            available_employees = active_employees
            self.logger.info(f"Fallback - Using {len(available_employees)} active employees")

        return available_employees

    def get_employee_assignment_stats(
        self, employees: List[Employee]
    ) -> Dict[int, Dict]:
        """
        Calculate assignment statistics for each employee
        Returns dictionary of employee_id -> stats
        """
        stats = {}

        for employee in employees:
            # Count how many shifts assigned in past week
            weekly_shifts = self.count_weekly_shifts(employee.id)

            # Count consecutive days worked
            consecutive_days = self.count_consecutive_days(employee.id)

            # Check days since last shift
            days_since_last = self.get_days_since_last_shift(employee.id)

            # Calculate a priority score (lower is higher priority)
            # Prioritize employees with fewer weekly shifts and those who haven't worked in a while
            priority_score = weekly_shifts * 10 - days_since_last

            stats[employee.id] = {
                "employee": employee,
                "weekly_shifts": weekly_shifts,
                "consecutive_days": consecutive_days,
                "days_since_last": days_since_last,
                "priority_score": priority_score,
                "is_keyholder": getattr(employee, "is_keyholder", False),
            }

        return stats

    def count_weekly_shifts(self, employee_id: int) -> int:
        """Count how many shifts an employee has in the current week"""
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())  # Monday of this week

        weekly_count = 0
        for assignment in self.assignments_by_employee[employee_id]:
            if (
                isinstance(assignment, dict)
                and assignment.get("employee_id") == employee_id
            ) or (
                hasattr(assignment, "employee_id")
                and assignment.employee_id == employee_id
            ):
                # Get the assignment date
                assignment_date = None
                if isinstance(assignment, dict):
                    date_str = assignment.get("date")
                    if date_str:
                        try:
                            assignment_date = datetime.fromisoformat(date_str).date()
                        except (ValueError, TypeError):
                            continue
                else:
                    if hasattr(assignment, "date"):
                        if isinstance(assignment.date, date):
                            assignment_date = assignment.date
                        elif isinstance(assignment.date, str):
                            try:
                                assignment_date = datetime.fromisoformat(
                                    assignment.date
                                ).date()
                            except (ValueError, TypeError):
                                continue

                if assignment_date and assignment_date >= week_start:
                    weekly_count += 1

        return weekly_count

    def count_consecutive_days(self, employee_id: int) -> int:
        """Count consecutive days worked by an employee up to today"""
        today = datetime.now().date()
        consecutive = 0
        day = today - timedelta(days=1)  # Start from yesterday

        while day >= today - timedelta(days=7):  # Look back at most 7 days
            if self.is_employee_assigned_on_date(employee_id, day):
                consecutive += 1
                day -= timedelta(days=1)
            else:
                break

        return consecutive

    def get_days_since_last_shift(self, employee_id: int) -> int:
        """Calculate days since employee's last assigned shift"""
        today = datetime.now().date()

        # Look back up to 30 days
        for days_back in range(1, 31):
            check_date = today - timedelta(days=days_back)
            if self.is_employee_assigned_on_date(employee_id, check_date):
                return days_back

        # If no shifts found in the past 30 days, return a high number
        return 30

    def is_employee_assigned_on_date(self, employee_id: int, day: date) -> bool:
        """Check if employee is assigned to any shift on the given date"""
        for assignment in self.assignments_by_employee[employee_id]:
            if (
                isinstance(assignment, dict)
                and assignment.get("employee_id") == employee_id
            ) or (
                hasattr(assignment, "employee_id")
                and assignment.employee_id == employee_id
            ):
                # Get the assignment date
                assignment_date = None
                if isinstance(assignment, dict):
                    date_str = assignment.get("date")
                    if date_str:
                        try:
                            assignment_date = datetime.fromisoformat(date_str).date()
                        except (ValueError, TypeError):
                            continue
                else:
                    if hasattr(assignment, "date"):
                        if isinstance(assignment.date, date):
                            assignment_date = assignment.date
                        elif isinstance(assignment.date, str):
                            try:
                                assignment_date = datetime.fromisoformat(
                                    assignment.date
                                ).date()
                            except (ValueError, TypeError):
                                continue

                if assignment_date and assignment_date == day:
                    return True

        return False

    def get_keyholders_needed(self, shift_type: str, date_to_check: date) -> int:
        """Determine how many keyholders are needed for this shift type and date"""
        # Check if keyholder requirements are in the config
        if hasattr(self.config, "keyholder_requirements") and isinstance(
            self.config.keyholder_requirements, dict
        ):
            return self.config.keyholder_requirements.get(shift_type, 1)

        # Default to requiring one keyholder per shift type
        return 1

    def assign_keyholders(self, current_date: date, shifts: List[Dict]) -> List[Dict]:
        """Assign keyholders to shifts"""
        try:
            self.logger.info(f"Attempting to assign keyholders for date {current_date}")
            
            # Track keyholders already assigned today to prevent over-assignment
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

            # Get available keyholders
            available_keyholders = [
                emp
                for emp in self.resources.employees
                if getattr(emp, "is_keyholder", False)
                and (
                    not self.availability_checker
                    or not self.availability_checker.is_employee_on_leave(
                        emp.id, current_date
                    )
                )
                and shifts_assigned_today.get(emp.id, 0) < max_shifts_per_day
            ]

            if not available_keyholders:
                self.logger.warning(f"No keyholders available for {current_date}")
                return []

            assigned_keyholders = []

            # Try to assign each keyholder to the best matching shift
            for keyholder in available_keyholders:
                keyholder_id = self.get_id(keyholder, ["id", "employee_id"])
                
                # Skip if already assigned today
                if shifts_assigned_today.get(keyholder_id, 0) >= max_shifts_per_day:
                    self.logger.info(f"Keyholder {keyholder_id} already has {shifts_assigned_today[keyholder_id]} shifts today (max: {max_shifts_per_day})")
                    continue
                
                # Find best matching shift for this keyholder
                best_shift = None
                best_match_score = float("inf")
                best_availability = None

                for shift in shifts:
                    # Skip if shift is already assigned
                    if self.is_shift_assigned(shift, assigned_keyholders):
                        continue

                    # Get the shift template
                    shift_id = self.get_id(shift, ["id", "shift_id"])
                    shift_template = None
                    if isinstance(shift, dict):
                        shift_template = self.resources.get_shift(shift.get("shift_id"))
                    else:
                        shift_template = self.resources.get_shift(shift_id)

                    if not shift_template:
                        continue

                    # Check if keyholder is available for this shift (if we have an availability checker)
                    is_available = True
                    avail_type = None
                    if self.availability_checker:
                        is_available, avail_type = (
                            self.availability_checker.is_employee_available(
                                keyholder_id, current_date, shift_template
                            )
                        )

                    if not is_available:
                        continue

                    # Check constraints if we have a constraint checker
                    if (
                        self.constraint_checker
                        and self.constraint_checker.exceeds_constraints(
                            keyholder, current_date, shift_template
                        )
                    ):
                        self.logger.debug(
                            f"Keyholder {keyholder_id} exceeds constraints for shift {shift_template.id}"
                        )
                        continue

                    # Calculate match score
                    match_score = self.calculate_shift_match_score(
                        keyholder, shift_template, avail_type
                    )

                    if match_score < best_match_score:
                        best_match_score = match_score
                        best_shift = shift
                        best_availability = avail_type

                # If we found a matching shift, create the assignment
                if best_shift:
                    shift_id = self.get_id(best_shift, ["id", "shift_id"])
                    assignment = {
                        "employee_id": keyholder_id,
                        "shift_id": shift_id,
                        "date": current_date,
                        "availability_type": best_availability,
                        "status": "PENDING",
                        "version": 1,
                    }

                    assigned_keyholders.append(assignment)
                    
                    # Add to employee's assignments
                    if keyholder_id not in self.assignments_by_employee:
                        self.assignments_by_employee[keyholder_id] = []
                    self.assignments_by_employee[keyholder_id].append(assignment)
                    
                    # Update daily shift counter
                    shifts_assigned_today[keyholder_id] += 1
                    
                    self.logger.info(
                        f"Assigned keyholder {keyholder_id} to shift {shift_id}"
                    )

            self.logger.info(
                f"Successfully assigned {len(assigned_keyholders)} keyholders for {current_date}"
            )
            return assigned_keyholders

        except Exception as e:
            self.logger.error(f"Error assigning keyholders: {str(e)}")
            self.logger.error("Stack trace:", exc_info=True)
            return []

    def calculate_shift_match_score(
        self,
        employee,
        shift_template,
        availability_type,
    ) -> float:
        """Calculate how well an employee matches a shift"""
        try:
            base_score = 0.0

            # Preferred availability gets a bonus
            if availability_type == "PRF":
                base_score -= 20.0

            # Get shift type
            shift_type = None
            if hasattr(shift_template, "shift_type_id"):
                shift_type = shift_template.shift_type_id
            elif hasattr(shift_template, "shift_type"):
                shift_type = getattr(
                    shift_template.shift_type, "value", shift_template.shift_type
                )
            else:
                # Determine shift type based on time if not provided
                start_hour = int(shift_template.start_time.split(":")[0])
                if start_hour < 11:
                    shift_type = "EARLY"
                elif start_hour >= 14:
                    shift_type = "LATE"
                else:
                    shift_type = "MIDDLE"

            # Check employee preferences if available
            if hasattr(employee, "preferences") and employee.preferences:
                prefs = employee.preferences
                if hasattr(prefs, "preferred_shifts"):
                    if shift_template.id in prefs.preferred_shifts:
                        base_score -= 15.0
                if hasattr(prefs, "avoid_shifts"):
                    if shift_template.id in prefs.avoid_shifts:
                        base_score += 15.0

            # Check employee history for this shift type
            if employee.id in self.employee_history:
                history = self.employee_history[employee.id]
                total_shifts = history.get("total", 0)

                if total_shifts > 0:
                    type_count = history.get(shift_type, 0)
                    type_ratio = type_count / total_shifts

                    # Penalize if employee already has many shifts of this type
                    if type_ratio > 0.4:  # More than 40% of shifts are this type
                        base_score += (type_ratio - 0.4) * 50.0

            # Return final score (lower is better)
            return base_score

        except Exception as e:
            self.logger.error(f"Error calculating shift match score: {str(e)}")
            return 100.0  # Return high score (bad match) on error

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
