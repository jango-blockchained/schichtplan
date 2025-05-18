import unittest
from unittest.mock import patch, MagicMock
from datetime import date, timedelta, time, datetime
from collections import defaultdict

from src.backend.services.scheduler.validator import (
    ScheduleValidator,
    ScheduleConfig,
    ValidationError,
)
from src.backend.services.scheduler.resources import ScheduleResources
from src.backend.models.employee import Employee as ActualEmployee, EmployeeGroup
from src.backend.services.scheduler.coverage_utils import get_required_staffing_for_interval


class MockScheduleEntry:
    def __init__(self, employee_id, date_obj, start_time_str, end_time_str, shift_id=None):
        self.employee_id = employee_id
        self.date = date_obj
        self.start_time = start_time_str
        self.end_time = end_time_str
        self.shift_id = shift_id if shift_id is not None else f"shift_{start_time_str}_{end_time_str}"
        self.id = f"assign_{employee_id}_{shift_id}_{date_obj.strftime('%Y%m%d')}"
        self.break_start = None
        self.break_end = None


class TestScheduleValidator(unittest.TestCase):
    """Test the ScheduleValidator class"""

    def setUp(self):
        """Set up test fixtures"""
        # Create mock resources
        self.mock_resources = MagicMock(spec=ScheduleResources)

        # Create validator
        self.validator = ScheduleValidator(self.mock_resources, test_mode=True)

        # Set up mock schedules
        self.mock_schedules = []
        for i in range(5):
            mock_schedule = MagicMock()
            mock_schedule.id = i + 1
            mock_schedule.employee_id = (i % 2) + 1  # Assign to 2 employees
            mock_schedule.date = date(2023, 1, 2) + timedelta(
                days=i // 2
            )  # Spread over 3 days
            mock_shift = MagicMock()
            mock_shift.start_time = "09:00"
            mock_shift.end_time = "17:00"
            mock_shift.duration_hours = 8
            mock_shift.requires_keyholder = (
                i == 0
            )  # Only first shift requires keyholder
            mock_schedule.shift = mock_shift
            self.mock_schedules.append(mock_schedule)

        # Set up mock employees
        self.mock_employees = []
        for i in range(2):
            mock_employee = MagicMock()
            mock_employee.id = i + 1
            mock_employee.first_name = f"Employee{i + 1}"
            mock_employee.last_name = "Test"
            mock_employee.employee_group = (
                EmployeeGroup.TZ if i == 0 else EmployeeGroup.GFB
            )
            mock_employee.is_keyholder = i == 0  # First employee is a keyholder
            mock_employee.contracted_hours = 30 if i == 0 else 15
            self.mock_employees.append(mock_employee)

        # Set up mock coverage
        self.mock_coverage = []
        for i in range(3):
            mock_cov = MagicMock()
            mock_cov.day_index = i
            mock_cov.date = date(2023, 1, 2) + timedelta(days=i)
            mock_cov.start_time = "09:00"
            mock_cov.end_time = "17:00"
            mock_cov.min_employees = 2
            self.mock_coverage.append(mock_cov)

        # Update resources
        self.mock_resources.employees = self.mock_employees
        self.mock_resources.coverage = self.mock_coverage

        # Mock for self.resources.get_employee used by new _validate_coverage
        def get_employee_side_effect(employee_id):
            for emp in self.mock_employees:
                if emp.id == employee_id:
                    return emp
            return None
        self.mock_resources.get_employee = MagicMock(side_effect=get_employee_side_effect)

    @patch('src.backend.services.scheduler.validator.get_required_staffing_for_interval')
    @patch('src.backend.services.scheduler.validator._time_str_to_datetime_time', new_callable=MagicMock)
    def test_validate_coverage_interval_perfect_match(self, mock_time_converter, mock_get_needs):
        # Setup: validator.INTERVAL_MINUTES is 60
        test_date = date(2023, 1, 2)
        mock_assignments = [
            MockScheduleEntry(employee_id=1, date_obj=test_date, start_time_str="09:00", end_time_str="17:00")
        ]
        self.mock_employees[0].is_keyholder = True
        self.mock_employees[0].employee_group = "SUPERVISOR"

        # Mock _time_str_to_datetime_time conversions
        def time_converter_side_effect(time_str, suppress_error=False):
            if not time_str: return None
            try: return datetime.strptime(time_str, '%H:%M').time()
            except ValueError: return None
        mock_time_converter.side_effect = time_converter_side_effect

        # Mock get_required_staffing_for_interval responses
        def get_needs_side_effect(date, interval_start_time, resources, interval_duration_minutes=None):
            if date == test_date and interval_start_time == time(9,0):
                return {"min_employees": 1, "requires_keyholder": True, "employee_types": ["SUPERVISOR"]}
            if date == test_date and interval_start_time == time(10,0):
                 return {"min_employees": 1, "requires_keyholder": True, "employee_types": ["SUPERVISOR"]}
            if date == test_date and time(9,0) <= interval_start_time < time(17,0):
                 return {"min_employees": 1, "requires_keyholder": True, "employee_types": ["SUPERVISOR"]}
            return {"min_employees": 0, "requires_keyholder": False, "employee_types": []}
        mock_get_needs.side_effect = get_needs_side_effect

        config = ScheduleConfig(enforce_minimum_coverage=True)
        errors = self.validator.validate(mock_assignments, config)
        
        understaffing_errors = [e for e in errors if e.error_type == 'Understaffing']
        keyholder_errors = [e for e in errors if e.error_type == 'MissingKeyholder']
        type_errors = [e for e in errors if e.error_type == 'MissingEmployeeType']
        
        self.assertEqual(len(understaffing_errors), 0, f"Understaffing errors: {understaffing_errors}")
        self.assertEqual(len(keyholder_errors), 0, f"Keyholder errors: {keyholder_errors}")
        self.assertEqual(len(type_errors), 0, f"Type errors: {type_errors}")
        self.assertEqual(len(errors), 0)

    @patch('src.backend.services.scheduler.validator.get_required_staffing_for_interval')
    @patch('src.backend.services.scheduler.validator._time_str_to_datetime_time', new_callable=MagicMock)
    def test_validate_coverage_interval_understaffing(self, mock_time_converter, mock_get_needs):
        test_date = date(2023, 1, 2)
        mock_assignments = []

        def time_converter_side_effect(time_str, suppress_error=False): return datetime.strptime(time_str, '%H:%M').time()
        mock_time_converter.side_effect = time_converter_side_effect
        
        mock_get_needs.return_value = {"min_employees": 1}

        config = ScheduleConfig(enforce_minimum_coverage=True)
        errors = self.validator.validate(mock_assignments, config)
        
        understaffing_errors = [e for e in errors if e.error_type == 'Understaffing']
        self.assertEqual(len(understaffing_errors), 24)
        if understaffing_errors:
            self.assertEqual(understaffing_errors[0].severity, "critical")
            self.assertEqual(understaffing_errors[0].details['required_min_employees'], 1)
            self.assertEqual(understaffing_errors[0].details['actual_assigned_employees'], 0)

    @patch('src.backend.services.scheduler.validator.get_required_staffing_for_interval')
    @patch('src.backend.services.scheduler.validator._time_str_to_datetime_time', new_callable=MagicMock)
    def test_validate_coverage_interval_missing_keyholder(self, mock_time_converter, mock_get_needs):
        test_date = date(2023, 1, 2)
        mock_assignments = [MockScheduleEntry(employee_id=2, date_obj=test_date, start_time_str="09:00", end_time_str="10:00")]
        self.mock_employees[1].is_keyholder = False

        def time_converter_side_effect(time_str, suppress_error=False): return datetime.strptime(time_str, '%H:%M').time()
        mock_time_converter.side_effect = time_converter_side_effect

        mock_get_needs.return_value = {"min_employees": 1, "requires_keyholder": True, "employee_types": []}

        config = ScheduleConfig(enforce_minimum_coverage=True, enforce_keyholder_coverage=True)
        errors = self.validator.validate(mock_assignments, config)

        keyholder_errors = [e for e in errors if e.error_type == 'MissingKeyholder']
        self.assertEqual(len(keyholder_errors), 1)
        if keyholder_errors:
            self.assertEqual(keyholder_errors[0].severity, "critical")
            self.assertTrue(keyholder_errors[0].details['required_keyholder'])
            self.assertEqual(keyholder_errors[0].details['actual_keyholders_present'], 0)

    @patch('src.backend.services.scheduler.validator.get_required_staffing_for_interval')
    @patch('src.backend.services.scheduler.validator._time_str_to_datetime_time', new_callable=MagicMock)
    def test_validate_coverage_interval_missing_employee_type(self, mock_time_converter, mock_get_needs):
        test_date = date(2023, 1, 2)
        self.mock_employees[0].employee_group = EmployeeGroup.GFB
        mock_assignments = [MockScheduleEntry(employee_id=1, date_obj=test_date, start_time_str="09:00", end_time_str="10:00")]
        
        def time_converter_side_effect(time_str, suppress_error=False): return datetime.strptime(time_str, '%H:%M').time()
        mock_time_converter.side_effect = time_converter_side_effect

        mock_get_needs.return_value = {"min_employees": 1, "requires_keyholder": False, "employee_types": ["SUPERVISOR"]}

        config = ScheduleConfig(enforce_minimum_coverage=True)
        errors = self.validator.validate(mock_assignments, config)
        
        type_errors = [e for e in errors if e.error_type == 'MissingEmployeeType']
        self.assertEqual(len(type_errors), 1)
        if type_errors:
            self.assertEqual(type_errors[0].severity, "warning")
            self.assertIn("SUPERVISOR", type_errors[0].details['unmet_types'])
            self.assertEqual(type_errors[0].details['actual_types_present_counts'].get(str(EmployeeGroup.GFB)), 1)

    @patch('src.backend.services.scheduler.validator.get_required_staffing_for_interval')
    def test_validate_coverage_interval_empty_schedule(self, mock_get_needs):
        config = ScheduleConfig(enforce_minimum_coverage=True)
        errors = self.validator.validate([], config)
        info_msgs = [e for e in errors if e.severity == 'info' and e.error_type == 'CoverageValidationSkip']
        self.assertEqual(len(info_msgs), 1)
        self.assertEqual(len(errors), 1)
        mock_get_needs.assert_not_called()

    @patch('src.backend.services.scheduler.validator.get_required_staffing_for_interval')
    @patch('src.backend.services.scheduler.validator._time_str_to_datetime_time', new_callable=MagicMock)
    def test_validate_coverage_interval_get_needs_exception(self, mock_time_converter, mock_get_needs):
        test_date = date(2023, 1, 2)
        mock_assignments = [MockScheduleEntry(employee_id=1, date_obj=test_date, start_time_str="09:00", end_time_str="10:00")]

        def time_converter_side_effect(time_str, suppress_error=False): return datetime.strptime(time_str, '%H:%M').time()
        mock_time_converter.side_effect = time_converter_side_effect
        
        mock_get_needs.side_effect = Exception("DB error!")

        config = ScheduleConfig(enforce_minimum_coverage=True)
        errors = self.validator.validate(mock_assignments, config)

        coverage_needs_errors = [e for e in errors if e.error_type == 'CoverageNeedsError']
        self.assertEqual(len(coverage_needs_errors), 1)
        if coverage_needs_errors:
            self.assertEqual(coverage_needs_errors[0].severity, "critical")
            self.assertIn("Failed to retrieve coverage needs", coverage_needs_errors[0].message)

    def test_validate_contracted_hours(self):
        """Test contracted hours validation"""
        # Configure validation to only check contracted hours
        config = ScheduleConfig(
            enforce_min_coverage=False,
            enforce_contracted_hours=True,
            enforce_keyholder=False,
            enforce_rest_periods=False,
            enforce_max_shifts=False,
            enforce_max_hours=False,
        )

        # Set up a schedule with insufficient hours for employee 1
        # Create one shift for employee 1 (8 hours, less than 75% of 30 hours)
        insufficient_schedule = [self.mock_schedules[0]]

        # Call validation
        errors = self.validator.validate(insufficient_schedule, config)

        # Check errors
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].error_type, "contracted_hours")
        self.assertEqual(errors[0].severity, "warning")

        # Set up a schedule with sufficient hours
        # Create 3 shifts for employee 1 (24 hours, more than 75% of 30 hours)
        sufficient_schedule = [
            self.mock_schedules[0],
            self.mock_schedules[2],
            self.mock_schedules[4],
        ]

        # Reset errors
        self.validator.errors = []

        # Call validation
        errors = self.validator.validate(sufficient_schedule, config)

        # Check errors
        self.assertEqual(len(errors), 0)

    def test_validate_keyholders(self):
        """Test keyholder validation"""
        # Configure validation to only check keyholders
        config = ScheduleConfig(
            enforce_min_coverage=False,
            enforce_contracted_hours=False,
            enforce_keyholder=True,
            enforce_rest_periods=False,
            enforce_max_shifts=False,
            enforce_max_hours=False,
        )

        # Set up a schedule without a keyholder for the shift requiring one
        # Assign employee 2 (non-keyholder) to the keyholder-required shift
        self.mock_schedules[0].employee_id = 2
        invalid_schedule = [self.mock_schedules[0]]

        # Call validation
        errors = self.validator.validate(invalid_schedule, config)

        # Check errors
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].error_type, "keyholder")
        self.assertEqual(errors[0].severity, "critical")

        # Set up a schedule with a keyholder for the shift requiring one
        # Assign employee 1 (keyholder) to the keyholder-required shift
        self.mock_schedules[0].employee_id = 1
        valid_schedule = [self.mock_schedules[0]]

        # Reset errors
        self.validator.errors = []

        # Call validation
        errors = self.validator.validate(valid_schedule, config)

        # Check errors
        self.assertEqual(len(errors), 0)

    def test_validate_rest_periods(self):
        """Test rest periods validation"""
        # Configure validation to only check rest periods
        config = ScheduleConfig(
            enforce_min_coverage=False,
            enforce_contracted_hours=False,
            enforce_keyholder=False,
            enforce_rest_periods=True,
            enforce_max_shifts=False,
            enforce_max_hours=False,
            min_rest_hours=11,
        )

        # Create a schedule with insufficient rest for employee 1
        # First shift
        shift1 = MagicMock()
        shift1.employee_id = 1
        shift1.date = date(2023, 1, 2)
        shift1.shift = MagicMock()
        shift1.shift.start_time = "13:00"
        shift1.shift.end_time = "21:00"

        # Second shift (starts 10 hours after the first ends)
        shift2 = MagicMock()
        shift2.employee_id = 1
        shift2.date = date(2023, 1, 3)
        shift2.shift = MagicMock()
        shift2.shift.start_time = "07:00"
        shift2.shift.end_time = "15:00"

        insufficient_rest_schedule = [shift1, shift2]

        # Patch the _calculate_rest_hours method to return a specific value
        with patch.object(self.validator, "_calculate_rest_hours", return_value=10):
            # Call validation
            errors = self.validator.validate(insufficient_rest_schedule, config)

            # Check errors
            self.assertEqual(len(errors), 1)
            self.assertEqual(errors[0].error_type, "rest_period")
            self.assertEqual(errors[0].severity, "warning")

        # Create a schedule with sufficient rest
        # First shift
        shift1 = MagicMock()
        shift1.employee_id = 1
        shift1.date = date(2023, 1, 2)
        shift1.shift = MagicMock()
        shift1.shift.start_time = "09:00"
        shift1.shift.end_time = "17:00"

        # Second shift (starts 16 hours after the first ends)
        shift2 = MagicMock()
        shift2.employee_id = 1
        shift2.date = date(2023, 1, 3)
        shift2.shift = MagicMock()
        shift2.shift.start_time = "09:00"
        shift2.shift.end_time = "17:00"

        sufficient_rest_schedule = [shift1, shift2]

        # Reset errors
        self.validator.errors = []

        # Patch the _calculate_rest_hours method to return a specific value
        with patch.object(self.validator, "_calculate_rest_hours", return_value=16):
            # Call validation
            errors = self.validator.validate(sufficient_rest_schedule, config)

            # Check errors
            self.assertEqual(len(errors), 0)

    def test_get_error_report(self):
        """Test error report generation"""
        # Add some validation errors
        self.validator.errors = [
            ValidationError(
                error_type="coverage",
                message="Insufficient staff for 2023-01-02 09:00-17:00",
                severity="critical",
                details={
                    "date": "2023-01-02",
                    "time": "09:00-17:00",
                    "required": 2,
                    "assigned": 1,
                },
            ),
            ValidationError(
                error_type="contracted_hours",
                message="Employee1 Test is scheduled for 8h but should have at least 22.5h",
                severity="warning",
                details={
                    "employee_id": 1,
                    "employee_name": "Employee1 Test",
                    "actual_hours": 8,
                    "contracted_hours": 30,
                    "min_hours": 22.5,
                },
            ),
            ValidationError(
                error_type="coverage",
                message="Insufficient staff for 2023-01-03 09:00-17:00",
                severity="critical",
                details={
                    "date": "2023-01-03",
                    "time": "09:00-17:00",
                    "required": 2,
                    "assigned": 0,
                },
            ),
        ]

        # Get error report
        report = self.validator.get_error_report()

        # Check report structure and content
        self.assertEqual(report["total_errors"], 3)
        self.assertEqual(report["severity_counts"]["critical"], 2)
        self.assertEqual(report["severity_counts"]["warning"], 1)
        self.assertEqual(len(report["errors_by_type"]["coverage"]), 2)
        self.assertEqual(len(report["errors_by_type"]["contracted_hours"]), 1)
        self.assertEqual(len(report["errors"]), 3)


if __name__ == "__main__":
    unittest.main()
