from typing import Dict, List, Any
from datetime import date
from collections import defaultdict
import functools
import logging

from models import Employee, ShiftTemplate, Schedule
from .utility import calculate_duration

# Configure logger
logger = logging.getLogger(__name__)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


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

    def __init__(self):
        self.employee_history = defaultdict(lambda: defaultdict(int))
        self.shift_scores = {}
        self.employee_preferences = {}
        self.rotation_state = defaultdict(int)
        self.fair_distribution_weight = 1.0
        self.preference_weight = 1.0
        self.seniority_weight = 0.5
        self.assignments = {}
        self.logger = logger

    def initialize(self, employees, historical_data=None, shifts=None, resources=None):
        """Initialize the distribution manager with employee and historical data"""
        self.employees = employees or []
        self.historical_data = historical_data or []
        self.shifts = shifts or []
        self.resources = resources
        self.assignments = {}

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
            if employee_id not in self.assignments:
                self.assignments[employee_id] = []

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

            self.assignments[employee_id].append(assignment)

        # Log loaded assignments
        total_assignments = sum(len(a) for a in self.assignments.values())
        self.logger.info(
            f"Loaded {total_assignments} historical assignments for "
            f"{len(self.assignments)} employees"
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
                duration = calculate_duration(
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
        for employee_id, assignments in self.assignments.items():
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
        employee_assignments = self.assignments.get(employee_id, [])

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
        if employee_id not in self.assignments:
            self.assignments[employee_id] = []

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
        self.assignments[employee_id].append(assignment)

        # Update any caches
        for func in [self.calculate_assignment_score]:
            if hasattr(func, "cache_clear"):
                func.cache_clear()

        self.logger.debug(
            f"Employee {employee_id} now has {len(self.assignments[employee_id])} assignments"
        )

    def get_distribution_metrics(self) -> Dict[str, Any]:
        """Get metrics about the current shift distribution"""
        total_shifts = 0
        type_counts = {"EARLY": 0, "MIDDLE": 0, "LATE": 0, "weekend": 0}

        # Count shifts by type
        for employee_id, assignments in self.assignments.items():
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
        if not self.assignments:
            return metrics

        # Calculate total assignments per employee
        shift_counts = []
        for employee_id, assignments in self.assignments.items():
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
            for employee_id, assignments in self.assignments.items():
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
