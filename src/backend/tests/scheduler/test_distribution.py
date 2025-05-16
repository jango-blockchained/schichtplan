import unittest
from datetime import date, timedelta, datetime
from unittest.mock import MagicMock, patch

from services.scheduler.distribution import DistributionManager, ShiftScore
from services.scheduler.constraints import ConstraintChecker
from services.scheduler.availability import AvailabilityChecker
from services.scheduler.resources import ScheduleResources
from models.employee import AvailabilityType


class TestDistributionManager(unittest.TestCase):
    """Test case for the DistributionManager class"""

    def setUp(self):
        """Set up test fixtures"""
        self.employee1 = MagicMock()
        self.employee1.id = 1
        self.employee1.first_name = "John"
        self.employee1.last_name = "Doe"
        self.employee1.preferences = None
        self.employee1.contracted_hours = 40.0
        self.employee1.is_keyholder = False
        self.employee1.employee_group = "GROUP_A"

        self.employee2 = MagicMock()
        self.employee2.id = 2
        self.employee2.first_name = "Jane"
        self.employee2.last_name = "Smith"
        self.employee2.preferences = None
        self.employee2.contracted_hours = 30.0
        self.employee2.is_keyholder = True
        self.employee2.employee_group = "GROUP_B"

        self.mock_resources = MagicMock(spec=ScheduleResources)
        self.mock_resources.employees = [self.employee1, self.employee2]
        self.mock_resources.version = 1 

        def side_effect_get_employee(emp_id):
            if emp_id == self.employee1.id: return self.employee1
            if emp_id == self.employee2.id: return self.employee2
            return None
        self.mock_resources.get_employee.side_effect = side_effect_get_employee

        def side_effect_get_shift(shift_id):
            if shift_id == self.early_shift.id: return self.early_shift
            if shift_id == self.late_shift.id: return self.late_shift
            if shift_id == self.standard_shift.id: return self.standard_shift
            return None
        self.mock_resources.get_shift.side_effect = side_effect_get_shift
        
        self.early_shift = MagicMock(name="EarlyShiftMock")
        self.early_shift.id = 1
        self.early_shift.start_time = "06:00"
        self.early_shift.end_time = "14:00"
        self.early_shift.shift_type = "EARLY"
        self.early_shift.shift_type_id = "EARLY_ID"
        self.early_shift.date = None

        self.late_shift = MagicMock(name="LateShiftMock")
        self.late_shift.id = 2
        self.late_shift.start_time = "14:00"
        self.late_shift.end_time = "22:00"
        self.late_shift.shift_type = "LATE"
        self.late_shift.shift_type_id = "LATE_ID"
        self.late_shift.date = None

        self.standard_shift = MagicMock(name="StandardShiftMock")
        self.standard_shift.id = 3
        self.standard_shift.start_time = "09:00"
        self.standard_shift.end_time = "17:00"
        self.standard_shift.shift_type = "STANDARD"
        self.standard_shift.shift_type_id = "STANDARD_ID"
        self.standard_shift.date = None
        
        self.mock_resources.shift_templates = [self.early_shift, self.late_shift, self.standard_shift]

        self.mock_constraint_checker_instance = MagicMock(spec=ConstraintChecker)
        self.mock_availability_checker_instance = MagicMock(spec=AvailabilityChecker)

        self.manager = DistributionManager(
            resources=self.mock_resources,
            constraint_checker=self.mock_constraint_checker_instance,
            availability_checker=self.mock_availability_checker_instance
        )
        self.manager.initialize(employees=self.mock_resources.employees, shifts=self.mock_resources.shift_templates, resources=self.mock_resources)

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
        local_mock_resources = MagicMock(spec=ScheduleResources)
        local_mock_resources.employees = [self.employee1, self.employee2]
        local_mock_resources.shift_templates = [self.early_shift, self.late_shift, self.standard_shift]
        local_mock_resources.version = 1
        
        def local_side_effect_get_employee(emp_id):
            if emp_id == self.employee1.id: return self.employee1
            if emp_id == self.employee2.id: return self.employee2
            return None
        local_mock_resources.get_employee.side_effect = local_side_effect_get_employee

        test_manager = DistributionManager(
            resources=local_mock_resources,
            constraint_checker=MagicMock(spec=ConstraintChecker),
            availability_checker=MagicMock(spec=AvailabilityChecker)
        )
        test_manager.initialize(employees=local_mock_resources.employees, shifts=local_mock_resources.shift_templates, resources=local_mock_resources)
        test_manager._initialize_employee_data(local_mock_resources.employees)

        self.assertIsNotNone(test_manager.employee_history)
        self.assertEqual(test_manager.employee_history.get(1, {}).get("total_hours", 0), 0)
        self.assertEqual(test_manager.employee_history.get(2, {}).get("total_hours", 0), 0)

        self.assertIn(1, test_manager.employee_preferences)
        expected_prefs = {"preferred_days": [], "preferred_shifts": [], "avoid_days": [], "avoid_shifts": []}
        self.assertEqual(test_manager.employee_preferences.get(1), expected_prefs)
        self.assertIn(2, test_manager.employee_preferences)
        self.assertEqual(test_manager.employee_preferences.get(2), expected_prefs)
        
        self.assertIn(self.early_shift.id, test_manager.shift_scores)
        self.assertIn(self.standard_shift.id, test_manager.shift_scores)

    def test_categorize_shift(self):
        """Test shift categorization based on actual logic in distribution.py"""
        # Test early shift ("06:00") -> "EARLY" (6 < 10 is True)
        self.early_shift.date = self.monday
        category = self.manager._categorize_shift(self.early_shift)
        self.assertEqual(category, "EARLY")

        # Test late shift ("14:00") -> "LATE" (14 not < 10, not 10-13, so LATE)
        self.late_shift.date = self.monday
        category = self.manager._categorize_shift(self.late_shift)
        self.assertEqual(category, "LATE")

        # Test standard shift ("09:00") -> "EARLY" (9 < 10 is True by current logic)
        self.standard_shift.date = self.monday
        category = self.manager._categorize_shift(self.standard_shift)
        self.assertEqual(category, "EARLY")

        # Weekend/Holiday logic is NOT in distribution.py _categorize_shift
        # So these will be categorized based on time only.
        # "09:00" on Saturday -> "EARLY"
        self.standard_shift.date = self.saturday 
        category = self.manager._categorize_shift(self.standard_shift)
        self.assertEqual(category, "EARLY")
        
        self.standard_shift.date = self.sunday 
        category = self.manager._categorize_shift(self.standard_shift)
        self.assertEqual(category, "EARLY")

    def test_calculate_base_score(self):
        """Test calculation of base shift scores"""
        # Test early shift score
        score = self.manager._calculate_base_score(self.early_shift, self.monday)
        self.assertEqual(score, 0.0)

        # Test late shift score
        score = self.manager._calculate_base_score(self.late_shift, self.monday)
        self.assertEqual(score, 0.0)

        # Test standard shift score
        score = self.manager._calculate_base_score(self.standard_shift, self.monday)
        self.assertEqual(score, 0.0)

        # Test weekend shift score
        score = self.manager._calculate_base_score(self.standard_shift, self.saturday)
        self.assertEqual(score, 0.0)

    @patch.object(DistributionManager, 'calculate_duration', return_value=8.0)
    def test_update_with_assignment(self, mock_calculate_duration_method):
        """Test updating metrics with a new assignment"""
        employees = [self.employee1, self.employee2]
        self.manager.initialize(employees, shifts=self.mock_resources.shift_templates, resources=self.mock_resources)
        self.manager._initialize_employee_data(employees) # type: ignore

        self.assertEqual(self.manager.employee_history.get(1, {}).get("EARLY", 0), 0)
        self.assertEqual(self.manager.employee_history.get(1, {}).get("LATE", 0), 0)
        self.assertEqual(self.manager.employee_history.get(1, {}).get("total", 0), 0)
        self.assertEqual(self.manager.employee_history.get(1, {}).get("hours", 0.0), 0.0)

        # Update with early shift - PROVIDE new_assignment_dict
        early_assignment_dict = {
            "employee_id": 1, "shift_id": self.early_shift.id, "date": self.monday, 
            "start_time": self.early_shift.start_time, "end_time": self.early_shift.end_time,
            "shift_type": self.early_shift.shift_type, "duration_hours": 8.0
        }
        self.manager.update_with_assignment(1, self.early_shift, self.monday, new_assignment_dict=early_assignment_dict)

        self.assertEqual(self.manager.employee_history[1].get("EARLY", 0), 1)
        self.assertEqual(self.manager.employee_history[1].get("total", 0), 1)
        self.assertEqual(self.manager.employee_history[1].get("hours", 0.0), 8.0)

        # Update with late shift - PROVIDE new_assignment_dict
        late_assignment_dict = {
            "employee_id": 1, "shift_id": self.late_shift.id, "date": self.tuesday,
            "start_time": self.late_shift.start_time, "end_time": self.late_shift.end_time,
            "shift_type": self.late_shift.shift_type, "duration_hours": 8.0
        }
        self.manager.update_with_assignment(1, self.late_shift, self.tuesday, new_assignment_dict=late_assignment_dict)

        self.assertEqual(self.manager.employee_history[1].get("EARLY", 0), 1)
        self.assertEqual(self.manager.employee_history[1].get("LATE", 0), 1)
        self.assertEqual(self.manager.employee_history[1].get("total", 0), 2)
        self.assertEqual(self.manager.employee_history[1].get("hours", 0.0), 16.0)

    def test_assignment_score_calculation(self):
        """Test calculation of assignment scores, focusing on shift desirability penalty.
        Assumes other adjustments (history, preference) are mocked to 0.
        """
        mock_target_needs = MagicMock()
        mock_target_needs.requires_keyholder = False
        mock_target_needs.employee_types = []
        dummy_context = {
            "target_interval_needs": mock_target_needs,
            "shift_covered_intervals": [],
            "full_day_staffing_snapshot": {},
            "current_staffing": MagicMock(num_assigned=0, required=1),
            "interval_details": MagicMock(required_employees=1)
        }
        default_availability = AvailabilityType.AVAILABLE

        # Reset history and assignments for self.employee1 for this specific test
        # to neutralize inline workload penalty and ensure history mock is clean.
        self.manager.employee_history[self.employee1.id] = {
            "EARLY": 0, "MIDDLE": 0, "LATE": 0, "weekend": 0, "holiday": 0, "total": 0, "hours": 0.0
        }
        self.manager.assignments_by_employee[self.employee1.id] = []

        # Patch relevant adjustment methods on the DistributionManager class
        with patch('services.scheduler.distribution.DistributionManager._calculate_history_adjustment_v2', return_value=0.0), \
             patch('services.scheduler.distribution.DistributionManager._calculate_preference_adjustment_v2', return_value=0.0):

            # DEBUG: Inspect shift_scores content
            print(f"DEBUG: shift_scores for early_shift ({self.early_shift.id}): {self.manager.shift_scores.get(self.early_shift.id)}")
            print(f"DEBUG: shift_scores for standard_shift ({self.standard_shift.id}): {self.manager.shift_scores.get(self.standard_shift.id)}")
            # DEBUG: Inspect assignments_by_employee for employee1 to check workload penalty source
            print(f"DEBUG: assignments_by_employee for {self.employee1.id}: {self.manager.assignments_by_employee.get(self.employee1.id)}")

            # Scenario 1: Employee 1, Early Shift
            # Expected score = Availability (+10.0) - Desirability_Penalty (-15.0) = -5.0
            # Desirability Penalty is calculated inside calculate_assignment_score based on self.manager.shift_scores.
            # Base score for EARLY_MORNING from self.manager.shift_scores (populated in setUp) should be ShiftScore.EARLY_MORNING (3.0)
            # Penalty factor = 5.0 (hardcoded in calculate_assignment_score)
            # Penalty = - (3.0 * 5.0) = -15.0
            score1 = self.manager.calculate_assignment_score(
                self.employee1.id, self.early_shift, self.monday, context=dummy_context, availability_type_override=default_availability
            )
            self.assertEqual(score1, -5.0)

            # Scenario 2: Employee 1, Standard Shift (categorized as EARLY by current _categorize_shift)
            # Same calculation as Scenario 1 because standard_shift is also categorized as EARLY.
            # Its base score in self.manager.shift_scores should also be ShiftScore.EARLY_MORNING (3.0)
            score2 = self.manager.calculate_assignment_score(
                self.employee1.id, self.standard_shift, self.monday, context=dummy_context, availability_type_override=default_availability
            )
            self.assertEqual(score2, -5.0)

    def test_get_distribution_metrics(self):
        """Test retrieving distribution metrics"""
        self.manager.resources = self.mock_resources
        employees = [self.employee1, self.employee2]
        self.manager.initialize(employees=employees, shifts=self.mock_resources.shift_templates, resources=self.mock_resources)
        self.manager._initialize_employee_data(employees) # type: ignore

        with patch.object(self.manager, 'calculate_duration', return_value=8.0):
            # Employee 1 assignments
            emp1_early1 = {"employee_id": self.employee1.id, "shift_id": self.early_shift.id, "date": self.monday, "start_time": self.early_shift.start_time, "end_time": self.early_shift.end_time, "shift_type": self.early_shift.shift_type, "duration_hours": 8.0}
            self.manager.update_with_assignment(self.employee1.id, self.early_shift, self.monday, new_assignment_dict=emp1_early1)
            emp1_early2 = {"employee_id": self.employee1.id, "shift_id": self.early_shift.id, "date": self.tuesday, "start_time": self.early_shift.start_time, "end_time": self.early_shift.end_time, "shift_type": self.early_shift.shift_type, "duration_hours": 8.0}
            self.manager.update_with_assignment(self.employee1.id, self.early_shift, self.tuesday, new_assignment_dict=emp1_early2)
            emp1_late1 = {"employee_id": self.employee1.id, "shift_id": self.late_shift.id, "date": self.wednesday, "start_time": self.late_shift.start_time, "end_time": self.late_shift.end_time, "shift_type": self.late_shift.shift_type, "duration_hours": 8.0}
            self.manager.update_with_assignment(self.employee1.id, self.late_shift, self.wednesday, new_assignment_dict=emp1_late1)
            # For weekend, _categorize_shift looks at date. Shift type in dict is for history.
            emp1_wknd1 = {"employee_id": self.employee1.id, "shift_id": self.standard_shift.id, "date": self.saturday, "start_time": self.standard_shift.start_time, "end_time": self.standard_shift.end_time, "shift_type": self.standard_shift.shift_type, "duration_hours": 8.0}
            self.standard_shift.date = self.saturday
            self.manager.update_with_assignment(self.employee1.id, self.standard_shift, self.saturday, new_assignment_dict=emp1_wknd1)
            emp1_wknd2 = {"employee_id": self.employee1.id, "shift_id": self.standard_shift.id, "date": self.sunday, "start_time": self.standard_shift.start_time, "end_time": self.standard_shift.end_time, "shift_type": self.standard_shift.shift_type, "duration_hours": 8.0}
            self.standard_shift.date = self.sunday
            self.manager.update_with_assignment(self.employee1.id, self.standard_shift, self.sunday, new_assignment_dict=emp1_wknd2)

            # Employee 2 assignments
            emp2_late1 = {"employee_id": self.employee2.id, "shift_id": self.late_shift.id, "date": self.monday, "start_time": self.late_shift.start_time, "end_time": self.late_shift.end_time, "shift_type": self.late_shift.shift_type, "duration_hours": 8.0}
            self.manager.update_with_assignment(self.employee2.id, self.late_shift, self.monday, new_assignment_dict=emp2_late1)
            emp2_late2 = {"employee_id": self.employee2.id, "shift_id": self.late_shift.id, "date": self.tuesday, "start_time": self.late_shift.start_time, "end_time": self.late_shift.end_time, "shift_type": self.late_shift.shift_type, "duration_hours": 8.0}
            self.manager.update_with_assignment(self.employee2.id, self.late_shift, self.tuesday, new_assignment_dict=emp2_late2)
            emp2_std1 = {"employee_id": self.employee2.id, "shift_id": self.standard_shift.id, "date": self.thursday, "start_time": self.standard_shift.start_time, "end_time": self.standard_shift.end_time, "shift_type": self.standard_shift.shift_type, "duration_hours": 8.0}
            self.standard_shift.date = self.thursday
            self.manager.update_with_assignment(self.employee2.id, self.standard_shift, self.thursday, new_assignment_dict=emp2_std1)

        metrics = self.manager.get_distribution_metrics()

        # Verify employee distribution data
        self.assertIn(self.employee1.id, metrics.get("employee_distribution", {}))
        self.assertIn(self.employee2.id, metrics.get("employee_distribution", {}))

        emp1_dist = metrics.get("employee_distribution", {}).get(self.employee1.id, {})
        emp1_percentages = emp1_dist.get("percentages", {})
        emp1_counts = emp1_dist.get("counts", {})

        self.assertEqual(emp1_counts.get("early", 0), 2)
        self.assertEqual(emp1_counts.get("late", 0), 1)
        self.assertEqual(emp1_counts.get("weekend", 0), 2) 
        self.assertEqual(emp1_counts.get("total",0), 5)

        # Verify overall totals (adjust based on actual assignments)
        # STANDARD shifts are currently counted as UNKNOWN by get_distribution_metrics
        category_totals = metrics.get("category_totals", {})
        self.assertEqual(category_totals.get("EARLY", 0), 2) # emp1_early1, emp1_early2
        self.assertEqual(category_totals.get("LATE", 0), 3)  # emp1_late1, emp2_late1, emp2_late2
        # emp2_std1 is a STANDARD shift, counted as UNKNOWN
        # emp1_wknd1 and emp1_wknd2 are also STANDARD shifts, but on weekends.
        # The current get_distribution_metrics counts STANDARD as UNKNOWN for category_totals.
        # It also has a separate weekend counter. Assignments made: emp1_early1, emp1_early2, emp1_late1, emp1_wknd1, emp1_wknd2, emp2_late1, emp2_late2, emp2_std1
        # Types: EARLY, EARLY, LATE, STANDARD, STANDARD, LATE, LATE, STANDARD
        # UNKNOWN count should be 3 (from the three STANDARD shifts)
        self.assertEqual(category_totals.get("UNKNOWN",0), 3) 
        self.assertEqual(category_totals.get("weekend", 0), 2) # emp1_wknd1, emp1_wknd2 (these are standard shifts on weekend days, history counts weekend days)
        self.assertEqual(category_totals.get("total", 0), 8)

    @patch('services.scheduler.distribution.ConstraintChecker')
    @patch('services.scheduler.distribution.AvailabilityChecker')
    @patch('services.scheduler.distribution.ScheduleResources')
    def test_assign_employees_by_type_successful_assignment(self, MockScheduleResources, MockAvailabilityChecker, MockConstraintChecker):
        """Test assign_employees_by_type: basic successful assignment."""
        # Setup Mocks for dependencies that might be re-instantiated or accessed globally
        mock_constraint_checker = MockConstraintChecker.return_value
        mock_constraint_checker.check_constraints.return_value = True

        mock_availability_checker = MockAvailabilityChecker.return_value
        mock_availability_checker.get_employee_availability_type_for_shift.return_value = AvailabilityType.AVAILABLE
        
        mock_resources_instance = MockScheduleResources.return_value
        # Configure manager with fresh mocks for this test if necessary,
        # or rely on those injected during setUp if appropriate.
        # For explicit control in this test:
        current_manager = DistributionManager(
            resources=mock_resources_instance, 
            constraint_checker=mock_constraint_checker, 
            availability_checker=mock_availability_checker
        )
        # Ensure mock_resources_instance.employees is set for _initialize_assignments
        mock_resources_instance.employees = [self.employee1] 
        # Also mock get_employee for calculate_assignment_score internal calls
        mock_resources_instance.get_employee.return_value = self.employee1

        current_manager.initialize([self.employee1], resources=mock_resources_instance)
        current_manager.assignments_by_employee.clear()
        current_manager.assignments_by_employee[self.employee1.id] = []

        test_shift_dict = {
            "id": self.early_shift.id,
            "start_time": self.early_shift.start_time,
            "end_time": self.early_shift.end_time,
            "shift_type_id": "EARLY_TYPE_ID",
            "required_skills": [],
            "max_employees": 1,
            "min_employees": 1,
            "assigned_employees": 0,
            "date": self.monday 
        }

        assignments = current_manager.assign_employees_by_type(
            current_date=self.monday,
            shifts=[test_shift_dict],
            available_employees=[self.employee1],
            shift_type="EARLY"
        )

        self.assertEqual(len(assignments), 1)
        assignment = assignments[0]
        self.assertEqual(assignment['employee_id'], self.employee1.id)
        self.assertEqual(assignment['shift_id'], self.early_shift.id)
        self.assertEqual(assignment['date'], self.monday)
        
        self.assertIn(assignment, current_manager.assignments_by_employee[self.employee1.id])
        self.assertEqual(test_shift_dict['assigned_employees'], 1)

    @patch('services.scheduler.distribution.ConstraintChecker')
    @patch('services.scheduler.distribution.AvailabilityChecker')
    @patch('services.scheduler.distribution.ScheduleResources')
    def test_assign_employees_by_type_no_available_employees(self, MockScheduleResources, MockAvailabilityChecker, MockConstraintChecker):
        """Test assign_employees_by_type: no available employees."""
        mock_constraint_checker = MockConstraintChecker.return_value
        mock_availability_checker = MockAvailabilityChecker.return_value
        mock_resources_instance = MockScheduleResources.return_value

        current_manager = DistributionManager(
            resources=mock_resources_instance, 
            constraint_checker=mock_constraint_checker, 
            availability_checker=mock_availability_checker
        )
        # Ensure mock_resources_instance.employees is set for _initialize_assignments
        mock_resources_instance.employees = []
        current_manager.initialize([], resources=mock_resources_instance)

        test_shift_dict = {
            "id": self.early_shift.id,
            "start_time": self.early_shift.start_time,
            "end_time": self.early_shift.end_time,
            "shift_type_id": "EARLY_TYPE_ID",
            "required_skills": [],
            "max_employees": 1,
            "min_employees": 1,
            "assigned_employees": 0,
            "date": self.monday
        }

        assignments = current_manager.assign_employees_by_type(
            current_date=self.monday,
            shifts=[test_shift_dict],
            available_employees=[],
            shift_type="EARLY"
        )

        self.assertEqual(len(assignments), 0)
        self.assertEqual(test_shift_dict['assigned_employees'], 0)


if __name__ == "__main__":
    unittest.main()
