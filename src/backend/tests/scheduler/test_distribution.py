import unittest
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from services.scheduler.distribution import DistributionManager, ShiftScore


class TestDistributionManager(unittest.TestCase):
    """Test case for the DistributionManager class"""

    def setUp(self):
        """Set up test fixtures"""
        # Create mock resources
        self.resources = MagicMock()
        self.resources.get_employees.return_value = []
        
        self.manager = DistributionManager(resources=self.resources)

        # Create mock employees
        self.employee1 = MagicMock()
        self.employee1.id = 1
        self.employee1.first_name = "John"
        self.employee1.last_name = "Doe"
        self.employee1.preferences = None

        self.employee2 = MagicMock()
        self.employee2.id = 2
        self.employee2.first_name = "Jane"
        self.employee2.last_name = "Smith"
        self.employee2.preferences = None

        # Create mock shift templates
        self.early_shift = MagicMock()
        self.early_shift.id = 1
        self.early_shift.start_time = "06:00"
        self.early_shift.end_time = "14:00"

        self.late_shift = MagicMock()
        self.late_shift.id = 2
        self.late_shift.start_time = "14:00"
        self.late_shift.end_time = "22:00"

        self.standard_shift = MagicMock()
        self.standard_shift.id = 3
        self.standard_shift.start_time = "09:00"
        self.standard_shift.end_time = "17:00"

        # Initialize test dates
        today = date.today()
        self.monday = today - timedelta(days=today.weekday())
        self.tuesday = self.monday + timedelta(days=1)
        self.wednesday = self.monday + timedelta(days=2)
        self.thursday = self.monday + timedelta(days=3)
        self.friday = self.monday + timedelta(days=4)
        self.saturday = self.monday + timedelta(days=5)
        self.sunday = self.monday + timedelta(days=6)

    def test_initialize(self):
        """Test initialization of distribution manager"""
        employees = [self.employee1, self.employee2]
        self.manager.initialize(employees)

        # Verify employee history is initialized
        self.assertIn(1, self.manager.employee_history)
        self.assertIn(2, self.manager.employee_history)

        # Verify preference data is initialized
        self.assertIn(1, self.manager.employee_preferences)
        self.assertIn(2, self.manager.employee_preferences)

    def test_categorize_shift(self):
        """Test shift categorization"""
        # Test early shift
        category = self.manager._categorize_shift(self.early_shift, self.monday)
        self.assertEqual(category, "early")

        # Test late shift
        category = self.manager._categorize_shift(self.late_shift, self.monday)
        self.assertEqual(category, "late")

        # Test standard shift
        category = self.manager._categorize_shift(self.standard_shift, self.monday)
        self.assertEqual(category, "standard")

        # Test weekend shift
        category = self.manager._categorize_shift(self.standard_shift, self.saturday)
        self.assertEqual(category, "weekend")
        category = self.manager._categorize_shift(self.standard_shift, self.sunday)
        self.assertEqual(category, "weekend")

    def test_calculate_base_score(self):
        """Test calculation of base shift scores"""
        # Test early shift score
        score = self.manager._calculate_base_score(self.early_shift, self.monday)
        self.assertEqual(score, ShiftScore.EARLY_MORNING)

        # Test late shift score
        score = self.manager._calculate_base_score(self.late_shift, self.monday)
        self.assertEqual(score, ShiftScore.LATE_NIGHT)

        # Test standard shift score
        score = self.manager._calculate_base_score(self.standard_shift, self.monday)
        self.assertEqual(score, ShiftScore.STANDARD)

        # Test weekend shift score
        score = self.manager._calculate_base_score(self.standard_shift, self.saturday)
        self.assertEqual(score, ShiftScore.WEEKEND)

    @patch("services.scheduler.distribution.calculate_duration")
    def test_update_with_assignment(self, mock_calculate_duration):
        """Test updating metrics with a new assignment"""
        # Setup
        mock_calculate_duration.return_value = 8.0
        employees = [self.employee1, self.employee2]
        self.manager.initialize(employees)

        # Initial state
        self.assertEqual(self.manager.employee_history[1]["early"], 0)
        self.assertEqual(self.manager.employee_history[1]["late"], 0)
        self.assertEqual(self.manager.employee_history[1]["total"], 0)

        # Update with early shift
        self.manager.update_with_assignment(1, self.early_shift, self.monday)

        # Verify early shift count increased
        self.assertEqual(self.manager.employee_history[1]["early"], 1)
        self.assertEqual(self.manager.employee_history[1]["total"], 1)
        self.assertEqual(self.manager.employee_history[1]["hours"], 8.0)

        # Update with late shift
        self.manager.update_with_assignment(1, self.late_shift, self.tuesday)

        # Verify late shift count increased
        self.assertEqual(self.manager.employee_history[1]["early"], 1)
        self.assertEqual(self.manager.employee_history[1]["late"], 1)
        self.assertEqual(self.manager.employee_history[1]["total"], 2)
        self.assertEqual(self.manager.employee_history[1]["hours"], 16.0)

    def test_assignment_score_calculation(self):
        """Test calculation of assignment scores based on distribution"""
        # Setup
        employees = [self.employee1, self.employee2]
        self.manager.initialize(employees)

        # First assignment should be neutral base score
        score1 = self.manager.calculate_assignment_score(
            1, self.early_shift, self.monday
        )
        self.assertEqual(score1, ShiftScore.EARLY_MORNING)

        # Simulate assigned early shifts
        self.manager.employee_history[1]["early"] = 5
        self.manager.employee_history[1]["total"] = 10  # 50% early shifts

        # Score should now be higher (less desirable) due to high early shift ratio
        score2 = self.manager.calculate_assignment_score(
            1, self.early_shift, self.monday
        )
        self.assertGreater(score2, score1)

        # Simulate more balanced distribution
        self.manager.employee_history[2]["early"] = 1
        self.manager.employee_history[2]["total"] = 10  # 10% early shifts

        # Employee 2 should get a better (lower) score for early shift
        score3 = self.manager.calculate_assignment_score(
            2, self.early_shift, self.monday
        )
        self.assertLess(score3, score2)

    def test_get_distribution_metrics(self):
        """Test retrieving distribution metrics"""
        # Setup
        employees = [self.employee1, self.employee2]
        self.manager.initialize(employees)

        # Simulate some shift assignments
        self.manager.employee_history[1]["early"] = 5
        self.manager.employee_history[1]["late"] = 3
        self.manager.employee_history[1]["weekend"] = 2
        self.manager.employee_history[1]["total"] = 10

        self.manager.employee_history[2]["early"] = 2
        self.manager.employee_history[2]["late"] = 6
        self.manager.employee_history[2]["weekend"] = 2
        self.manager.employee_history[2]["total"] = 10

        # Get metrics
        metrics = self.manager.get_distribution_metrics()

        # Verify employee distribution data
        self.assertIn(1, metrics["employee_distribution"])
        self.assertIn(2, metrics["employee_distribution"])

        # Verify percentages for employee 1
        self.assertEqual(
            metrics["employee_distribution"][1]["percentages"]["early"], 50.0
        )
        self.assertEqual(
            metrics["employee_distribution"][1]["percentages"]["late"], 30.0
        )

        # Verify percentages for employee 2
        self.assertEqual(
            metrics["employee_distribution"][2]["percentages"]["early"], 20.0
        )
        self.assertEqual(
            metrics["employee_distribution"][2]["percentages"]["late"], 60.0
        )

        # Verify overall totals
        self.assertEqual(metrics["category_totals"]["early"], 7)
        self.assertEqual(metrics["category_totals"]["late"], 9)
        self.assertEqual(metrics["category_totals"]["weekend"], 4)
        self.assertEqual(metrics["category_totals"]["total"], 20)

        # Verify overall percentages
        self.assertEqual(metrics["overall_percentages"]["early"], 35.0)
        self.assertEqual(metrics["overall_percentages"]["late"], 45.0)
        self.assertEqual(metrics["overall_percentages"]["weekend"], 20.0)


if __name__ == "__main__":
    unittest.main()
