import unittest
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import date, time, datetime
from collections import defaultdict

# Assuming models and DistributionManager are accessible
# Adjust imports based on your project structure
from models.employee import AvailabilityType, Employee as ActualEmployee
from models.shift_template import ShiftTemplate as ActualShiftTemplate
# If you have dummy/type hint versions for testing in DistributionManager, import them too
# from backend.services.scheduler.distribution import Employee as DummyEmployee, ShiftTemplate as DummyShiftTemplate

from services.scheduler.distribution import DistributionManager
from services.scheduler.resources import ScheduleResources
from services.scheduler.constraints import ConstraintChecker
from services.scheduler.availability import AvailabilityChecker

# Helper to create a mock employee with specific attributes
def create_mock_employee(id, is_keyholder=False, employee_group=None, contracted_hours=40.0, is_active=True):
    mock_emp = MagicMock(spec=ActualEmployee)
    mock_emp.id = id
    mock_emp.is_keyholder = is_keyholder
    mock_emp.employee_group = employee_group
    mock_emp.contracted_hours = contracted_hours
    mock_emp.is_active = is_active
    # Add other attributes as needed by your tests
    mock_emp.preferences = MagicMock() # Mock preferences object
    mock_emp.preferences.preferred_days = []
    mock_emp.preferences.avoid_days = []
    mock_emp.preferences.preferred_shifts = []
    mock_emp.preferences.avoid_shifts = []
    return mock_emp

# Helper to create a mock shift template
def create_mock_shift_template(id, start_time_str, end_time_str, shift_type="GENERAL", duration_hours=None):
    mock_st = MagicMock(spec=ActualShiftTemplate)
    mock_st.id = id
    mock_st.start_time = start_time_str
    mock_st.end_time = end_time_str
    mock_st.shift_type = shift_type
    mock_st.shift_type_id = shift_type # Assuming shift_type can serve as shift_type_id for categorization
    if duration_hours is None:
        # Basic duration calculation for mocks
        start_t = datetime.strptime(start_time_str, "%H:%M").time()
        end_t = datetime.strptime(end_time_str, "%H:%M").time()
        duration = (datetime.combine(date.min, end_t) - datetime.combine(date.min, start_t)).total_seconds() / 3600
        if duration < 0: duration += 24 # Handle overnight
        mock_st.duration_hours = duration
    else:
        mock_st.duration_hours = duration_hours
    # Add other attributes like required_skills if needed
    mock_st.required_skills = []
    return mock_st


class TestDistributionManagerInterval(unittest.TestCase):

    def setUp(self):
        self.mock_resources = MagicMock(spec=ScheduleResources)
        self.mock_constraint_checker = MagicMock(spec=ConstraintChecker)
        self.mock_availability_checker = MagicMock(spec=AvailabilityChecker)
        self.mock_logger = MagicMock()
        
        # Mock employees and shift templates that resources would provide
        self.employee1 = create_mock_employee(id=1, is_keyholder=True, employee_group="Supervisor")
        self.employee2 = create_mock_employee(id=2, is_keyholder=False, employee_group="Cashier")
        self.employee3 = create_mock_employee(id=3, is_keyholder=False, employee_group="Cashier", contracted_hours=20)
        self.employee_untyped = create_mock_employee(id=4, is_keyholder=False, employee_group=None)


        self.mock_resources.employees = [self.employee1, self.employee2, self.employee3, self.employee_untyped]
        self.mock_resources.get_employee_by_id.side_effect = lambda eid: next((e for e in self.mock_resources.employees if e.id == eid), None)

        self.shift_template_early = create_mock_shift_template(id=101, start_time_str="08:00", end_time_str="16:00", shift_type="EARLY")
        self.shift_template_late = create_mock_shift_template(id=102, start_time_str="14:00", end_time_str="22:00", shift_type="LATE")
        self.shift_template_short = create_mock_shift_template(id=103, start_time_str="10:00", end_time_str="14:00", shift_type="MIDDLE")
        
        self.mock_resources.shift_templates = [self.shift_template_early, self.shift_template_late, self.shift_template_short]
        self.mock_resources.get_shift_template_by_id.side_effect = lambda sid: next((st for st in self.mock_resources.shift_templates if st.id == sid), None)
        # Alias for older get_shift if used by DistributionManager's _calculate_shift_scores or similar
        self.mock_resources.get_shift = self.mock_resources.get_shift_template_by_id


        self.dist_manager = DistributionManager(
            resources=self.mock_resources,
            constraint_checker=self.mock_constraint_checker,
            availability_checker=self.mock_availability_checker,
            config=MagicMock(), # Basic config mock
            logger=self.mock_logger
        )
        
        # Initialize shift_scores which might be done in DM's init or a separate call
        # If DM._calculate_shift_scores() is called in __init__ and needs self.shifts
        self.dist_manager.shifts = self.mock_resources.shift_templates # Ensure DM has shifts for score calculation
        self.dist_manager._calculate_shift_scores() # Manually call if not in init or needs specific setup

        # Clear any pre-existing assignment data for clean tests
        self.dist_manager.assignments_by_employee.clear()
        self.dist_manager.employee_history.clear()
        self.current_date = date(2024, 1, 15) # Monday


    def test_dummy_test_to_ensure_setup_works(self):
        self.assertIsNotNone(self.dist_manager)
        self.mock_logger.info.assert_any_call("Initialized assignments for 4 employees")
        self.assertTrue(True)

    # --- Tests for calculate_assignment_score --- #

    def test_calculate_score_availability_types(self):
        """Test scoring based on different AvailabilityTypes."""
        context = {
            "target_interval_needs": {"min_employees": 1}, # Minimal needs
            "shift_covered_intervals": [time(10,0)],
            "full_day_staffing_snapshot": {time(10,0): {"current_employees": 0, "min_employees":1}},
            "interval_duration_minutes": 15
        }

        score_fixed = self.dist_manager.calculate_assignment_score(
            employee_id=self.employee1.id, 
            shift_template=self.shift_template_short, 
            shift_date=self.current_date, 
            context=context, 
            availability_type_override=AvailabilityType.FIXED
        )
        score_preferred = self.dist_manager.calculate_assignment_score(
            employee_id=self.employee1.id, 
            shift_template=self.shift_template_short, 
            shift_date=self.current_date, 
            context=context, 
            availability_type_override=AvailabilityType.PREFERRED
        )
        score_available = self.dist_manager.calculate_assignment_score(
            employee_id=self.employee1.id, 
            shift_template=self.shift_template_short, 
            shift_date=self.current_date, 
            context=context, 
            availability_type_override=AvailabilityType.AVAILABLE
        )

        self.assertGreater(score_fixed, score_preferred, "FIXED should score higher than PREFERRED")
        self.assertGreater(score_preferred, score_available, "PREFERRED should score higher than AVAILABLE")
        # Base scores are 100, 50, 10 for these types. Other factors are penalties or small bonuses.
        self.assertTrue(score_fixed > 90) # Expecting base 100 + other factors
        self.assertTrue(score_preferred > 40) # Expecting base 50 + other factors
        self.assertTrue(score_available > 0)   # Expecting base 10 + other factors

    def test_calculate_score_keyholder_need(self):
        """Test scoring with keyholder requirement."""
        context_keyholder_needed = {
            "target_interval_needs": {"min_employees": 1, "requires_keyholder": True},
            "shift_covered_intervals": [time(10,0)],
            "full_day_staffing_snapshot": {time(10,0): {"current_employees": 0, "min_employees":1}},
            "interval_duration_minutes": 15
        }
        context_no_keyholder_needed = {
            "target_interval_needs": {"min_employees": 1, "requires_keyholder": False},
            "shift_covered_intervals": [time(10,0)],
            "full_day_staffing_snapshot": {time(10,0): {"current_employees": 0, "min_employees":1}},
            "interval_duration_minutes": 15
        }

        # Employee1 is a keyholder
        score_keyholder_met = self.dist_manager.calculate_assignment_score(
            self.employee1.id, self.shift_template_short, self.current_date, context_keyholder_needed, AvailabilityType.AVAILABLE)
        
        # Employee2 is NOT a keyholder
        score_keyholder_not_met = self.dist_manager.calculate_assignment_score(
            self.employee2.id, self.shift_template_short, self.current_date, context_keyholder_needed, AvailabilityType.AVAILABLE)

        # Employee1 (keyholder) when no keyholder is needed (should be neutral or small positive)
        score_keyholder_not_needed_but_is = self.dist_manager.calculate_assignment_score(
            self.employee1.id, self.shift_template_short, self.current_date, context_no_keyholder_needed, AvailabilityType.AVAILABLE)

        self.assertGreater(score_keyholder_met, score_keyholder_not_met, "Keyholder meeting need should score much higher than not meeting")
        self.assertTrue(score_keyholder_met > 150) # Base 10 (AVAIL) + 150 (Keyholder bonus)
        self.assertTrue(score_keyholder_not_met < -500) # Base 10 (AVAIL) - 1000 (Keyholder penalty)
        self.assertAlmostEqual(score_keyholder_not_needed_but_is, score_keyholder_not_met + 1000, delta=10, msg="Keyholder when not needed should be similar to non-keyholder when not needed, ignoring the large penalty/bonus")

    def test_calculate_score_employee_type_need(self):
        """Test scoring with employee type requirement."""
        context_type_needed = {
            "target_interval_needs": {"min_employees": 1, "employee_types": ["Supervisor"]},
            "shift_covered_intervals": [time(10,0)],
            "full_day_staffing_snapshot": {time(10,0): {"current_employees": 0, "min_employees":1}},
            "interval_duration_minutes": 15
        }
        context_type_cashier_needed = {
            "target_interval_needs": {"min_employees": 1, "employee_types": ["Cashier"]},
            "shift_covered_intervals": [time(10,0)],
            "full_day_staffing_snapshot": {time(10,0): {"current_employees": 0, "min_employees":1}},
            "interval_duration_minutes": 15
        }

        # Employee1 is Supervisor
        score_type_supervisor_met = self.dist_manager.calculate_assignment_score(
            self.employee1.id, self.shift_template_short, self.current_date, context_type_needed, AvailabilityType.AVAILABLE)
        # Employee2 is Cashier (doesn't meet Supervisor need)
        score_type_supervisor_not_met = self.dist_manager.calculate_assignment_score(
            self.employee2.id, self.shift_template_short, self.current_date, context_type_needed, AvailabilityType.AVAILABLE)
        # Employee_untyped (doesn't meet Supervisor need)
        score_type_supervisor_untyped_emp = self.dist_manager.calculate_assignment_score(
            self.employee_untyped.id, self.shift_template_short, self.current_date, context_type_needed, AvailabilityType.AVAILABLE)
        # Employee2 (Cashier) meets Cashier need
        score_type_cashier_met = self.dist_manager.calculate_assignment_score(
            self.employee2.id, self.shift_template_short, self.current_date, context_type_cashier_needed, AvailabilityType.AVAILABLE)

        self.assertGreater(score_type_supervisor_met, score_type_supervisor_not_met)
        self.assertTrue(score_type_supervisor_met > 70) # Base AVAIL + 75 (type bonus) approx
        self.assertTrue(score_type_supervisor_not_met < -700) # Base AVAIL - 750 (type penalty)
        self.assertTrue(score_type_supervisor_untyped_emp < -80) # Base AVAIL - 100 (untyped penalty)
        self.assertGreater(score_type_cashier_met, score_type_supervisor_not_met) # Cashier meeting need vs not

    def test_calculate_score_overstaffing_penalty(self):
        """Test penalty for causing overstaffing."""
        # Interval 10:00 needs 1 employee, currently has 0.
        # Shift covers 10:00, 11:00. Interval 11:00 also needs 1, has 0.
        # Assigning this shift to 10:00 is fine, causes no overstaffing.
        context_no_overstaff = {
            "target_interval_needs": {"min_employees": 1}, # For 10:00
            "shift_covered_intervals": [time(10, 0), time(11, 0)],
            "full_day_staffing_snapshot": {
                time(10, 0): {"current_employees": 0, "min_employees": 1}, 
                time(11, 0): {"current_employees": 0, "min_employees": 1} 
            },
            "interval_duration_minutes": 60 # Assuming 1hr intervals for simplicity here
        }
        # Mock that resources.get_interval_needs_for_time returns the correct needs for each interval
        self.mock_resources.get_interval_needs_for_time.side_effect = lambda dt, t: context_no_overstaff["full_day_staffing_snapshot"][t]
        
        score_no_overstaff = self.dist_manager.calculate_assignment_score(
            self.employee2.id, self.shift_template_early, self.current_date, context_no_overstaff, AvailabilityType.AVAILABLE)

        # Interval 10:00 needs 1, has 0. Target this interval.
        # Shift covers 10:00, 11:00. Interval 11:00 needs 1, but already has 1.
        # Assigning this shift to 10:00 would overstaff 11:00.
        context_causes_overstaff = {
            "target_interval_needs": {"min_employees": 1}, # For 10:00, the interval we are trying to fill
            "shift_covered_intervals": [time(10, 0), time(11, 0)],
            "full_day_staffing_snapshot": {
                time(10, 0): {"current_employees": 0, "min_employees": 1}, 
                time(11, 0): {"current_employees": 1, "min_employees": 1} # 11:00 is already staffed
            },
            "interval_duration_minutes": 60
        }
        self.mock_resources.get_interval_needs_for_time.side_effect = lambda dt, t: context_causes_overstaff["full_day_staffing_snapshot"][t]

        score_causes_overstaff = self.dist_manager.calculate_assignment_score(
            self.employee2.id, self.shift_template_early, self.current_date, context_causes_overstaff, AvailabilityType.AVAILABLE)
        
        self.assertGreater(score_no_overstaff, score_causes_overstaff, "Score should be lower if it causes overstaffing")
        # Expected penalty for 1 overstaff: 50
        self.assertAlmostEqual(score_no_overstaff - 50, score_causes_overstaff, delta=5, msg="Score difference should reflect overstaffing penalty")

    # --- Tests for _try_find_and_make_assignment --- #

    def test_try_find_and_make_assignment_success(self):
        self.mock_availability_checker.check_employee_availability.return_value = (AvailabilityType.AVAILABLE, "Is available")
        self.mock_constraint_checker.check_all_constraints.return_value = [] # No violations
        
        # Mocking the global current_daily_interval_needs that _try_find_and_make_assignment uses
        self.dist_manager.current_daily_interval_needs = {
            time(10,0): {"min_employees": 1, "requires_keyholder": False, "employee_types": []}
        }

        # Spy on update_with_assignment
        with patch.object(self.dist_manager, 'update_with_assignment', wraps=self.dist_manager.update_with_assignment) as mock_update_assignment:
            assignment = self.dist_manager._try_find_and_make_assignment(
                current_date=self.current_date,
                interval_time=time(10, 0),
                candidate_shift_ids=[self.shift_template_short.id],
                potential_shifts_map={self.shift_template_short.id: self.shift_template_short.__dict__}, # Pass as dict
                resources=self.mock_resources,
                constraint_checker=self.mock_constraint_checker,
                availability_checker=self.mock_availability_checker,
                current_staffing_per_interval={
                    time(10,0): {"current_employees": 0, "min_employees":1, "current_keyholders":0, "current_employee_types_count": defaultdict(int)}
                },
                final_assignments_so_far=[],
                assigned_shift_ids_in_this_run=set(),
                interval_duration_minutes=60
            )

        self.assertIsNotNone(assignment)
        self.assertEqual(assignment['employee_id'], self.employee2.id) # Assuming emp2 is picked by default score
        self.assertEqual(assignment['shift_id'], self.shift_template_short.id)
        mock_update_assignment.assert_called_once()
        # Check that current_staffing_per_interval was updated correctly (it's updated by the caller, this only checks the assignment was made)

    def test_try_find_and_make_assignment_no_suitable_employee_unavailable(self):
        self.mock_availability_checker.check_employee_availability.return_value = (AvailabilityType.UNAVAILABLE, "Not available")
        self.mock_constraint_checker.check_all_constraints.return_value = [] 
        self.dist_manager.current_daily_interval_needs = {
            time(10,0): {"min_employees": 1}
        }

        with patch.object(self.dist_manager, 'update_with_assignment') as mock_update_assignment:
            assignment = self.dist_manager._try_find_and_make_assignment(
                current_date=self.current_date,
                interval_time=time(10, 0),
                candidate_shift_ids=[self.shift_template_short.id],
                potential_shifts_map={self.shift_template_short.id: self.shift_template_short.__dict__},
                resources=self.mock_resources,
                constraint_checker=self.mock_constraint_checker,
                availability_checker=self.mock_availability_checker,
                current_staffing_per_interval={time(10,0): {"current_employees": 0, "min_employees":1}},
                final_assignments_so_far=[],
                assigned_shift_ids_in_this_run=set(),
                interval_duration_minutes=60
            )
        self.assertIsNone(assignment)
        mock_update_assignment.assert_not_called()

    def test_try_find_and_make_assignment_no_suitable_employee_constraints(self):
        self.mock_availability_checker.check_employee_availability.return_value = (AvailabilityType.AVAILABLE, "Is available")
        self.mock_constraint_checker.check_all_constraints.return_value = [{"error": "Too many hours"}] # Violation
        self.dist_manager.current_daily_interval_needs = {
            time(10,0): {"min_employees": 1}
        }
        with patch.object(self.dist_manager, 'update_with_assignment') as mock_update_assignment:
            assignment = self.dist_manager._try_find_and_make_assignment(
                current_date=self.current_date,
                interval_time=time(10, 0),
                candidate_shift_ids=[self.shift_template_short.id],
                potential_shifts_map={self.shift_template_short.id: self.shift_template_short.__dict__},
                resources=self.mock_resources,
                constraint_checker=self.mock_constraint_checker,
                availability_checker=self.mock_availability_checker,
                current_staffing_per_interval={time(10,0): {"current_employees": 0, "min_employees":1}},
                final_assignments_so_far=[],
                assigned_shift_ids_in_this_run=set(),
                interval_duration_minutes=60
            )
        self.assertIsNone(assignment)
        mock_update_assignment.assert_not_called()

    def test_try_find_and_make_assignment_shift_already_taken(self):
        self.dist_manager.current_daily_interval_needs = {
            time(10,0): {"min_employees": 1}
        }
        assignment = self.dist_manager._try_find_and_make_assignment(
            current_date=self.current_date,
            interval_time=time(10, 0),
            candidate_shift_ids=[self.shift_template_short.id],
            potential_shifts_map={self.shift_template_short.id: self.shift_template_short.__dict__},
            resources=self.mock_resources,
            constraint_checker=self.mock_constraint_checker,
            availability_checker=self.mock_availability_checker,
            current_staffing_per_interval={time(10,0): {"current_employees": 0, "min_employees":1}},
            final_assignments_so_far=[],
            assigned_shift_ids_in_this_run={self.shift_template_short.id}, # Shift already assigned
            interval_duration_minutes=60
        )
        self.assertIsNone(assignment)

    # --- Tests for _perform_interval_based_assignments --- #

    @patch('backend.services.scheduler.distribution.get_required_staffing_for_interval')
    def test_perform_interval_based_assignments_simple_case(self, mock_get_needs):
        # Setup interval needs for the day
        daily_interval_needs_setup = {
            time(9,0): {"min_employees": 1, "requires_keyholder": False, "employee_types": []},
            time(10,0): {"min_employees": 1, "requires_keyholder": False, "employee_types": []}
        }
        current_staffing_setup = {
            time(8,0): {"current_employees": 0, "assigned_employee_ids": set(), "keyholder_present": False, "current_employee_types_count": defaultdict(int)},
            time(9,0): {"current_employees": 0, "assigned_employee_ids": set(), "keyholder_present": False, "current_employee_types_count": defaultdict(int)},
            time(10,0): {"current_employees": 0, "assigned_employee_ids": set(), "keyholder_present": False, "current_employee_types_count": defaultdict(int)}
        }

        mock_get_needs.side_effect = lambda date, interval_start_time, resources, interval_duration_minutes: \
            daily_interval_needs_setup.get(interval_start_time, {"min_employees": 0})

        # Mock dependencies of the *actual* _try_find_and_make_assignment
        self.mock_availability_checker.check_employee_availability.return_value = (AvailabilityType.AVAILABLE, "Is available")
        self.mock_constraint_checker.check_all_constraints.return_value = [] # No violations
        
        # Control scoring: make employee2 best for shift_early, employee3 for shift_short
        def mock_calculate_score(employee_id, shift_template_dict, shift_date, context, availability_type_override):
            if employee_id == self.employee2.id and shift_template_dict['id'] == self.shift_template_early.id:
                return 100
            if employee_id == self.employee3.id and shift_template_dict['id'] == self.shift_template_short.id:
                return 90
            if employee_id == self.employee1.id: # Make employee1 less attractive for these
                 return 50
            return 10 # Default low score for other combinations
        
        self.dist_manager.calculate_assignment_score = MagicMock(side_effect=mock_calculate_score)
        # Ensure get_employee_by_id is correctly mocked as used by _try_find_and_make_assignment
        self.mock_resources.get_employee_by_id.side_effect = lambda eid: next((e for e in self.mock_resources.employees if e.id == eid), None)
        # Mock current_daily_interval_needs as it's accessed by _try_find_and_make_assignment
        self.dist_manager.current_daily_interval_needs = daily_interval_needs_setup

        potential_shifts_for_day = [
            dict(self.shift_template_early.__dict__), 
            dict(self.shift_template_short.__dict__)
        ]
        potential_shifts_for_day[0]['id'] = self.shift_template_early.id
        potential_shifts_for_day[1]['id'] = self.shift_template_short.id
        
        # Spy on the real update_with_assignment to ensure it's called
        with patch.object(self.dist_manager, 'update_with_assignment', wraps=self.dist_manager.update_with_assignment) as mock_update_assignment_spy:
            final_assignments = self.dist_manager._perform_interval_based_assignments(
                current_date=self.current_date,
                potential_shifts=potential_shifts_for_day, 
                daily_interval_needs=daily_interval_needs_setup,
                current_staffing_per_interval=current_staffing_setup, 
                resources=self.mock_resources,
                constraint_checker=self.mock_constraint_checker,
                availability_checker=self.mock_availability_checker,
                interval_minutes=60
            )

        # Expectation: 
        # Interval 09:00 needs 1. shift_early (08-16) by employee2 is the best fit.
        # This assignment covers 08:00, 09:00, 10:00... current_staffing_setup for these intervals gets updated.
        # Interval 10:00 needs 1. After shift_early is assigned, the need at 10:00 is already met.
        # So, no second assignment should be made for the 10:00 target interval.
        self.assertEqual(len(final_assignments), 1, "Only one assignment should be made as the first shift covers both needed intervals")
        if final_assignments:
            self.assertEqual(final_assignments[0]['shift_id'], self.shift_template_early.id)
            self.assertEqual(final_assignments[0]['employee_id'], self.employee2.id)
            mock_update_assignment_spy.assert_called_once() # Check that history was updated for this one assignment

        # Check the mutated current_staffing_setup
        self.assertEqual(current_staffing_setup[time(8,0)]['current_employees'], 1) # Covered by shift_early
        self.assertEqual(current_staffing_setup[time(9,0)]['current_employees'], 1) # Target interval, covered by shift_early
        self.assertEqual(current_staffing_setup[time(10,0)]['current_employees'], 1) # Also covered by shift_early
        self.assertIn(self.employee2.id, current_staffing_setup[time(9,0)]['assigned_employee_ids'])
        self.assertEqual(current_staffing_setup[time(9,0)]['current_employee_types_count'][str(self.employee2.employee_group)], 1)
        self.assertFalse(current_staffing_setup[time(9,0)]['keyholder_present'])

    @patch('backend.services.scheduler.distribution.get_required_staffing_for_interval')
    def test_perform_interval_based_assignments_no_assignments_possible(self, mock_get_needs):
        daily_interval_needs_setup = {time(9,0): {"min_employees": 1}}
        current_staffing_setup = {time(9,0): {"current_employees": 0, "assigned_employee_ids": set(), "keyholder_present": False, "current_employee_types_count": defaultdict(int)}}
        mock_get_needs.return_value = {"min_employees": 1}

        # Make all employees unavailable or non-compliant
        self.mock_availability_checker.check_employee_availability.return_value = (AvailabilityType.UNAVAILABLE, "Not available")
        # OR self.mock_constraint_checker.check_all_constraints.return_value = [{"error": "violation"}]
        # OR mock_calculate_score to return very low scores / -inf
        self.dist_manager.calculate_assignment_score = MagicMock(return_value=-float('inf'))
        self.dist_manager.current_daily_interval_needs = daily_interval_needs_setup

        potential_shifts_for_day = [dict(self.shift_template_early.__dict__)]
        potential_shifts_for_day[0]['id'] = self.shift_template_early.id

        with patch.object(self.dist_manager, 'update_with_assignment') as mock_update_assignment_spy:
            final_assignments = self.dist_manager._perform_interval_based_assignments(
                current_date=self.current_date,
                potential_shifts=potential_shifts_for_day, 
                daily_interval_needs=daily_interval_needs_setup,
                current_staffing_per_interval=current_staffing_setup,
                resources=self.mock_resources,
                constraint_checker=self.mock_constraint_checker,
                availability_checker=self.mock_availability_checker,
                interval_minutes=60
            )
        self.assertEqual(len(final_assignments), 0)
        mock_update_assignment_spy.assert_not_called()

if __name__ == '__main__':
    unittest.main() 