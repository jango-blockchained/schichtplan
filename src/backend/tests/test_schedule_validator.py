import unittest
from unittest.mock import patch, MagicMock
from datetime import date, timedelta
from services.scheduler.validator import (
    ScheduleValidator,
    ScheduleConfig,
    ValidationError,
)
from services.scheduler.resources import ScheduleResources
from models.employee import EmployeeGroup


class TestScheduleValidator(unittest.TestCase):
    """Test the ScheduleValidator class"""

    def setUp(self):
        """Set up test fixtures"""
        # Create mock resources
        self.mock_resources = MagicMock(spec=ScheduleResources)

        # Create validator
        self.validator = ScheduleValidator(self.mock_resources)

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

    def test_validate_coverage(self):
        """Test coverage validation"""
        # Use a simplified coverage list for this test
        # Create a mock coverage specifically for the test
        test_coverage = MagicMock()
        test_coverage.day_index = 0
        test_coverage.date = date(2023, 1, 2)
        test_coverage.start_time = "09:00"
        test_coverage.end_time = "17:00"
        test_coverage.min_employees = 2

        # Update the resources to only have one coverage item
        self.mock_resources.coverage = [test_coverage]

        # Configure validation to only check coverage
        config = ScheduleConfig(
            enforce_min_coverage=True,
            enforce_contracted_hours=False,
            enforce_keyholder=False,
            enforce_rest_periods=False,
            enforce_max_shifts=False,
            enforce_max_hours=False,
        )

        # Set up a schedule with insufficient coverage
        insufficient_schedule = [self.mock_schedules[0]]  # Only one employee on day 0

        # Call validation
        errors = self.validator.validate(insufficient_schedule, config)

        # Check errors - we should have one coverage error
        coverage_errors = [e for e in errors if e.error_type == "coverage"]
        self.assertEqual(len(coverage_errors), 1)
        self.assertEqual(coverage_errors[0].severity, "critical")

        # Set up a schedule with sufficient coverage
        sufficient_schedule = [
            self.mock_schedules[0],
            self.mock_schedules[1],
        ]  # Two employees on day 0

        # Reset errors
        self.validator.errors = []

        # Call validation
        errors = self.validator.validate(sufficient_schedule, config)

        # Check errors
        coverage_errors = [e for e in errors if e.error_type == "coverage"]
        self.assertEqual(len(coverage_errors), 0)

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
