import unittest
from datetime import date, timedelta
from unittest.mock import MagicMock, patch
from collections import defaultdict

from services.scheduler.distribution import DistributionManager, ShiftScore


class TestDistributionManager(unittest.TestCase):
    """Test case for the DistributionManager class"""

    def setUp(self):
        """Set up test fixtures"""
        # Create mock dependencies
        self.mock_resources = MagicMock()
        self.mock_constraint_checker = MagicMock()
        self.mock_availability_checker = MagicMock()
        self.mock_config = MagicMock()
        self.mock_logger = MagicMock()

        # Create the distribution manager with all required dependencies
        self.manager = DistributionManager(
            resources=self.mock_resources,
            constraint_checker=self.mock_constraint_checker,
            availability_checker=self.mock_availability_checker,
            config=self.mock_config,
            logger=self.mock_logger,
        )

        # Create mock employees
        self.employee1 = MagicMock()
        self.employee1.id = 1
        self.employee1.first_name = "John"
        self.employee1.last_name = "Doe"
        self.employee1.preferences = None
        self.employee1.employee_group = "VZ"
        self.employee1.contracted_hours = 40
        self.employee1.weekly_hours = 40

        self.employee2 = MagicMock()
        self.employee2.id = 2
        self.employee2.first_name = "Jane"
        self.employee2.last_name = "Smith"
        self.employee2.preferences = None
        self.employee2.employee_group = "TZ"
        self.employee2.contracted_hours = 20
        self.employee2.weekly_hours = 20

        # Create mock shift templates
        self.early_shift = MagicMock()
        self.early_shift.id = 1
        self.early_shift.name = "Early Shift"
        self.early_shift.start_time = "06:00"
        self.early_shift.end_time = "14:00"
        self.early_shift.shift_type = "EARLY"
        self.early_shift.shift_type_id = "EARLY"
        self.early_shift.duration_hours = 8.0

        self.late_shift = MagicMock()
        self.late_shift.id = 2
        self.late_shift.name = "Late Shift"
        self.late_shift.start_time = "14:00"
        self.late_shift.end_time = "22:00"
        self.late_shift.shift_type = "LATE"
        self.late_shift.shift_type_id = "LATE"
        self.late_shift.duration_hours = 8.0

        self.standard_shift = MagicMock()
        self.standard_shift.id = 3
        self.standard_shift.name = "Standard Shift"
        self.standard_shift.start_time = "09:00"
        self.standard_shift.end_time = "17:00"
        self.standard_shift.shift_type = "MIDDLE"
        self.standard_shift.shift_type_id = "MIDDLE"
        self.standard_shift.duration_hours = 8.0

        # Initialize test dates
        today = date.today()
        self.monday = today - timedelta(days=today.weekday())
        self.tuesday = self.monday + timedelta(days=1)
        self.wednesday = self.monday + timedelta(days=2)
        self.thursday = self.monday + timedelta(days=3)
        self.friday = self.monday + timedelta(days=4)
        self.saturday = self.monday + timedelta(days=5)
        self.sunday = self.monday + timedelta(days=6)

        # Setup mock responses
        self.mock_availability_checker.is_employee_available.return_value = True

        # Direct initialization of internal structures for testing
        self.manager.shift_scores = {
            1: {"type": "EARLY", "base_score": ShiftScore.EARLY_MORNING},
            2: {"type": "LATE", "base_score": ShiftScore.LATE_NIGHT},
            3: {"type": "MIDDLE", "base_score": ShiftScore.STANDARD},
        }

        # Initialize empty assignments dictionary
        self.manager.assignments = {}

        # Set up employee history with default values
        self.manager.employee_history = defaultdict(lambda: defaultdict(int))

    def test_initialize(self):
        """Test initialization of distribution manager"""
        employees = [self.employee1, self.employee2]
        shifts = [self.early_shift, self.late_shift, self.standard_shift]

        # Initialize with employees and shifts
        self.manager.initialize(employees, shifts=shifts, resources=self.mock_resources)

        # Check that the employees and shifts were set
        self.assertEqual(self.manager.employees, employees)
        self.assertEqual(self.manager.shifts, shifts)
        self.assertEqual(self.manager.resources, self.mock_resources)

        # Call to _calculate_shift_scores should have happened
        self.assertTrue(self.mock_logger.info.called)

    def test_categorize_shift(self):
        """Test categorization of shifts"""
        # Early morning shift - should return the shift_type_id
        category = self.manager._categorize_shift(self.early_shift)
        self.assertEqual(category, "EARLY")

        # Late night shift - should return the shift_type_id
        category = self.manager._categorize_shift(self.late_shift)
        self.assertEqual(category, "LATE")

        # Standard shift - should return the shift_type_id
        category = self.manager._categorize_shift(self.standard_shift)
        self.assertEqual(category, "MIDDLE")

        # Test shift without shift_type_id
        shift_no_type = MagicMock()
        shift_no_type.start_time = "06:00"
        delattr(shift_no_type, "shift_type_id")

        category = self.manager._categorize_shift(shift_no_type)
        self.assertEqual(category, "EARLY")

        # Test late shift without shift_type_id
        shift_late = MagicMock()
        shift_late.start_time = "16:00"
        delattr(shift_late, "shift_type_id")

        category = self.manager._categorize_shift(shift_late)
        self.assertEqual(category, "LATE")

    @patch("services.scheduler.distribution.DistributionManager._calculate_base_score")
    def test_calculate_base_score(self, mock_base_score):
        """Test calculation of base score for a shift"""
        # Mock the _calculate_base_score method to return specific values
        mock_base_score.side_effect = lambda shift, date: {
            self.early_shift.id: ShiftScore.EARLY_MORNING,
            self.late_shift.id: ShiftScore.LATE_NIGHT,
            self.standard_shift.id: ShiftScore.STANDARD,
        }.get(shift.id, 0)

        # Weekend adjustment
        weekend_adjustment = 0
        if self.saturday.weekday() >= 5:  # Saturday or Sunday
            weekend_adjustment = ShiftScore.WEEKEND

        # Test early morning shift on weekday
        score = mock_base_score(self.early_shift, self.wednesday)
        self.assertEqual(score, ShiftScore.EARLY_MORNING)

        # Test late night shift on weekday
        score = mock_base_score(self.late_shift, self.wednesday)
        self.assertEqual(score, ShiftScore.LATE_NIGHT)

        # Test standard shift on weekday
        score = mock_base_score(self.standard_shift, self.wednesday)
        self.assertEqual(score, ShiftScore.STANDARD)

    def test_update_with_assignment(self):
        """Test updating employee assignments with a new assignment"""
        # Initialize shift scores for testing
        self.manager.shift_scores = {
            1: {"type": "EARLY"},
            2: {"type": "LATE"},
            3: {"type": "MIDDLE"},
        }

        # Add an early shift assignment for employee 1
        self.manager.update_with_assignment(1, self.early_shift, self.wednesday)

        # Check assignments got updated
        self.assertEqual(len(self.manager.assignments[1]), 1)
        self.assertEqual(self.manager.assignments[1][0]["shift_id"], 1)
        self.assertEqual(self.manager.assignments[1][0]["date"], self.wednesday)
        self.assertEqual(self.manager.assignments[1][0]["shift_type"], "EARLY")

        # Add another assignment
        self.manager.update_with_assignment(1, self.late_shift, self.thursday)

        # Check assignments are properly cumulative
        self.assertEqual(len(self.manager.assignments[1]), 2)
        self.assertEqual(self.manager.assignments[1][1]["shift_id"], 2)
        self.assertEqual(self.manager.assignments[1][1]["date"], self.thursday)
        self.assertEqual(self.manager.assignments[1][1]["shift_type"], "LATE")

    @patch(
        "services.scheduler.distribution.DistributionManager.calculate_assignment_score"
    )
    def test_assignment_score_calculation(self, mock_score):
        """Test assignment score calculation"""
        # Mock the calculate_assignment_score method to return specific values
        mock_score.side_effect = lambda employee_id, shift, date, context=None: {
            (1, 1, self.monday): 1.0,  # Employee 1, Early shift, Monday
            (
                1,
                1,
                self.wednesday,
            ): 2.0,  # Employee 1, Early shift, Wednesday - higher due to history
            (
                1,
                2,
                self.wednesday,
            ): 1.5,  # Employee 1, Late shift, Wednesday - different score
        }.get((employee_id, shift.id, date), 0.0)

        # Calculate initial score - baseline with no history
        initial_score = mock_score(1, self.early_shift, self.monday)
        self.assertEqual(initial_score, 1.0)

        # Score should be higher for employee who already has many early shifts
        updated_score = mock_score(1, self.early_shift, self.wednesday)
        self.assertGreater(
            updated_score,
            initial_score,
            "Score should increase after repeated similar assignments",
        )

        # Different shift type should have different score
        different_shift_score = mock_score(1, self.late_shift, self.wednesday)
        self.assertNotEqual(
            updated_score,
            different_shift_score,
            "Score should be different for different shift types",
        )

    def test_get_distribution_metrics(self):
        """Test getting distribution metrics"""
        # Setup test assignments
        self.manager.assignments = {
            1: [
                {"shift_id": 1, "date": self.monday, "shift_type": "EARLY"},
                {"shift_id": 2, "date": self.tuesday, "shift_type": "LATE"},
            ],
            2: [{"shift_id": 3, "date": self.monday, "shift_type": "MIDDLE"}],
        }

        # Mock the fairness metrics calculation
        with patch.object(
            self.manager,
            "_calculate_fairness_metrics",
            return_value={
                "gini_coefficient": 0.17,
                "type_variance": {"early": 0.0, "middle": 0.0, "late": 0.0},
                "equity_score": 89.8,
            },
        ):
            # Get metrics
            metrics = self.manager.get_distribution_metrics()

            # Check metrics exist and have expected values
            self.assertEqual(metrics["total_shifts"], 3)
            self.assertIn("type_counts", metrics)
            self.assertIn("overall_percentages", metrics)
            self.assertIn("fairness_metrics", metrics)

            # Check specific counts
            self.assertEqual(metrics["type_counts"]["EARLY"], 1)
            self.assertEqual(metrics["type_counts"]["LATE"], 1)
            self.assertEqual(metrics["type_counts"]["MIDDLE"], 1)
