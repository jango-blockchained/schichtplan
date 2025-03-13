from typing import Dict, List, Any, Optional
from datetime import date
from collections import defaultdict
import functools
import logging

from models import Employee, ShiftTemplate, Schedule
from .utility import time_to_minutes, calculate_duration

logger = logging.getLogger(__name__)


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

    def initialize(
        self,
        employees: List[Employee],
        historical_data: Optional[List[Schedule]] = None,
    ):
        """Initialize the distribution manager with employees and optionally historical data"""
        self._initialize_employee_data(employees)

        if historical_data:
            self._load_historical_data(historical_data)

        self._calculate_shift_scores()
        logger.info(f"Distribution manager initialized with {len(employees)} employees")

    def _initialize_employee_data(self, employees: List[Employee]):
        """Initialize employee data structures"""
        for employee in employees:
            self.employee_history[employee.id] = {
                "early": 0,
                "late": 0,
                "weekend": 0,
                "holiday": 0,
                "standard": 0,
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
            shift_category = self._categorize_shift(shift_template, shift_date)
            self.employee_history[employee_id][shift_category] += 1
            self.employee_history[employee_id]["total"] += 1

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

    def _categorize_shift(self, shift: ShiftTemplate, shift_date: date) -> str:
        """Categorize a shift as early, late, weekend, holiday, or standard"""
        # Check if weekend
        if shift_date.weekday() >= 5:  # Saturday (5) or Sunday (6)
            return "weekend"

        # Check if early shift
        start_minutes = time_to_minutes(shift.start_time)
        if start_minutes < time_to_minutes("08:00"):
            return "early"

        # Check if late shift
        end_minutes = time_to_minutes(shift.end_time)
        if end_minutes > time_to_minutes("20:00"):
            return "late"

        # Default to standard
        return "standard"

    def _calculate_shift_scores(self):
        """Calculate scores for shift templates based on their characteristics"""
        # This implementation will be expanded in future versions
        # For now we'll use simple base scores
        pass

    @functools.lru_cache(maxsize=256)
    def calculate_assignment_score(
        self,
        employee_id: int,
        shift: ShiftTemplate,
        shift_date: date,
        context: Dict[str, Any] = None,
    ) -> float:
        """
        Calculate a score for assigning this shift to this employee
        Lower scores indicate better assignments
        """
        if not context:
            context = {}

        base_score = self._calculate_base_score(shift, shift_date)

        # Apply employee history adjustments
        history_adjustment = self._calculate_history_adjustment(
            employee_id, shift, shift_date
        )

        # Apply preference adjustments
        preference_adjustment = self._calculate_preference_adjustment(
            employee_id, shift, shift_date
        )

        # Apply seniority adjustment if available
        seniority_adjustment = self._calculate_seniority_adjustment(
            employee_id, context
        )

        # Calculate final score with weightings
        final_score = (
            base_score
            + (history_adjustment * self.fair_distribution_weight)
            + (preference_adjustment * self.preference_weight)
            + (seniority_adjustment * self.seniority_weight)
        )

        return final_score

    def _calculate_base_score(self, shift: ShiftTemplate, shift_date: date) -> float:
        """Calculate the base desirability score for a shift"""
        # Start with standard score
        score = ShiftScore.STANDARD

        start_minutes = time_to_minutes(shift.start_time)
        end_minutes = time_to_minutes(shift.end_time)

        # Check if early morning
        if start_minutes < time_to_minutes("08:00"):
            score = ShiftScore.EARLY_MORNING

        # Check if late night
        elif end_minutes > time_to_minutes("20:00"):
            score = ShiftScore.LATE_NIGHT

        # Weekend adjustment
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
        category = self._categorize_shift(shift, shift_date)

        # If employee has done very few of these shifts, encourage assignment
        if history["total"] > 0:
            category_ratio = history[category] / history["total"]

            # If this employee has a low ratio of this shift type, make it more appealing
            if category_ratio < 0.2:  # Less than 20% of shifts are this type
                return -1.0

            # If this employee has a high ratio of this shift type, make it less appealing
            if category_ratio > 0.4:  # More than 40% of shifts are this type
                return 1.0

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

    def update_with_assignment(
        self, employee_id: int, shift: ShiftTemplate, shift_date: date
    ):
        """Update distribution metrics with a new assignment"""
        if employee_id not in self.employee_history:
            return

        category = self._categorize_shift(shift, shift_date)
        self.employee_history[employee_id][category] += 1
        self.employee_history[employee_id]["total"] += 1

        duration = calculate_duration(shift.start_time, shift.end_time)
        self.employee_history[employee_id]["hours"] += duration

        # Clear the cache since history has changed
        self.calculate_assignment_score.cache_clear()

    def get_distribution_metrics(self) -> Dict[str, Any]:
        """Get current distribution metrics for analysis
        
        Returns a comprehensive dictionary of metrics for analyzing shift distribution:
        - employee_distribution: Per-employee metrics including counts and percentages
        - category_totals: Total counts for each shift category
        - overall_percentages: Percentage distribution across all shift categories
        - fairness_metrics: Metrics to evaluate distribution fairness
        - workload_distribution: Analysis of workload across employees
        """
        metrics = {
            "employee_distribution": {},
            "category_totals": {
                "early": 0,
                "late": 0,
                "weekend": 0,
                "standard": 0,
                "total": 0,
            },
            "fairness_metrics": {
                "gini_coefficient": 0.0,
                "category_variance": {},
                "equity_score": 0.0
            },
            "workload_distribution": {
                "max_shifts": 0,
                "min_shifts": 0,
                "avg_shifts": 0.0,
                "employee_counts": []
            }
        }
        
        # Skip calculation if no history data is available
        if not self.employee_history:
            return metrics

        # Calculate overall and per-employee metrics
        all_shift_counts = []
        
        for employee_id, history in self.employee_history.items():
            metrics["employee_distribution"][employee_id] = {
                "percentages": {},
                "counts": history.copy(),
                "score": self._calculate_fairness_score(history)
            }
            
            all_shift_counts.append(history["total"])

            # Calculate percentages
            if history["total"] > 0:
                for category in ["early", "late", "weekend", "standard"]:
                    metrics["employee_distribution"][employee_id]["percentages"][
                        category
                    ] = round(history[category] / history["total"] * 100, 2)

                    # Add to category totals
                    metrics["category_totals"][category] += history[category]

            # Add to total count
            metrics["category_totals"]["total"] += history["total"]

        # Calculate overall percentages
        if metrics["category_totals"]["total"] > 0:
            metrics["overall_percentages"] = {}
            for category in ["early", "late", "weekend", "standard"]:
                metrics["overall_percentages"][category] = round(
                    metrics["category_totals"][category]
                    / metrics["category_totals"]["total"]
                    * 100, 2
                )
        
        # Calculate workload distribution metrics
        if all_shift_counts:
            metrics["workload_distribution"]["max_shifts"] = max(all_shift_counts)
            metrics["workload_distribution"]["min_shifts"] = min(all_shift_counts)
            metrics["workload_distribution"]["avg_shifts"] = round(
                sum(all_shift_counts) / len(all_shift_counts), 2
            )
            metrics["workload_distribution"]["employee_counts"] = all_shift_counts
            
            # Calculate fairness metrics
            metrics["fairness_metrics"]["gini_coefficient"] = self._calculate_gini_coefficient(all_shift_counts)
            metrics["fairness_metrics"]["equity_score"] = self._calculate_equity_score(metrics)
            
            # Calculate category variance
            for category in ["early", "late", "weekend", "standard"]:
                category_percentages = []
                for emp_id, dist in metrics["employee_distribution"].items():
                    if "percentages" in dist and category in dist["percentages"]:
                        category_percentages.append(dist["percentages"][category])
                if category_percentages:
                    metrics["fairness_metrics"]["category_variance"][category] = round(
                        self._calculate_variance(category_percentages), 2
                    )

        return metrics
        
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
        employee_scores = [dist["score"] for _, dist in metrics["employee_distribution"].items()]
        avg_employee_score = sum(employee_scores) / len(employee_scores) if employee_scores else 0
        
        # Combine metrics with weights
        return round(0.6 * gini_score + 0.4 * avg_employee_score, 2)

    def clear_caches(self):
        """Clear all caches"""
        self.calculate_assignment_score.cache_clear()
