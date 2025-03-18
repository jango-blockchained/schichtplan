import unittest
from unittest.mock import MagicMock
from datetime import date
import sys
import os
import logging

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import components to test
from services.scheduler.constraints import ConstraintChecker
from services.scheduler.resources import ScheduleResources
from models.employee import AvailabilityType, EmployeeGroup


class TestConstraintChecker(unittest.TestCase):
    """
    Test the ConstraintChecker class which validates employee assignments
    against business rules and constraints.
    """

    def setUp(self):
        """Set up test fixtures"""
        # Create mock resources
        self.mock_resources = MagicMock(spec=ScheduleResources)

        # Create a mock config
        self.mock_config = MagicMock()
        self.mock_config.max_consecutive_days = 7
        self.mock_config.preferred_availability_bonus = 0.2

        # Create a mock logger
        self.mock_logger = MagicMock(spec=logging.Logger)

        # Create a ConstraintChecker instance with mocks
        self.constraint_checker = ConstraintChecker(
            self.mock_resources, self.mock_config, self.mock_logger
        )

        # Create mock employees
        self.mock_employees = []
        for i in range(3):
            employee = MagicMock()
            employee.id = i + 1
            employee.first_name = f"Employee{i + 1}"
            employee.last_name = "Test"
            employee.employee_group = (
                EmployeeGroup.VZ
                if i == 0
                else EmployeeGroup.TZ
                if i == 1
                else EmployeeGroup.GFB
            )
            employee.is_keyholder = i == 0  # First employee is keyholder
            employee.weekly_hours = 40 if i == 0 else 20 if i == 1 else 10
            employee.max_shifts_per_day = 1
            employee.min_time_between_shifts = 12  # hours
            self.mock_employees.append(employee)

        # Create mock shifts
        self.mock_shifts = []
        for i in range(3):
            shift = MagicMock()
            shift.id = i + 1
            shift.name = f"Shift {i + 1}"
            shift.start_time = "08:00" if i == 0 else "14:00" if i == 1 else "20:00"
            shift.end_time = "14:00" if i == 0 else "20:00" if i == 1 else "02:00"
            shift.duration_hours = 6.0
            shift.requires_keyholder = i == 0  # Morning shift requires keyholder
            self.mock_shifts.append(shift)

        # Create mock availabilities
        self.mock_availabilities = []
        for emp_id in range(1, 4):
            for day in range(7):  # 0-6 for days of week
                avail = MagicMock()
                avail.id = len(self.mock_availabilities) + 1
                avail.employee_id = emp_id
                avail.day_of_week = day
                avail.hour = 12  # Noon
                avail.is_available = True
                # Different availability types for different employees
                if emp_id == 1:  # Full-time employee available all days
                    avail.availability_type = AvailabilityType.AVAILABLE
                elif emp_id == 2:  # Part-time employee prefers weekdays
                    avail.availability_type = (
                        AvailabilityType.PREFERRED
                        if day < 5
                        else AvailabilityType.AVAILABLE
                    )
                else:  # GFB employee unavailable on Mondays
                    avail.availability_type = (
                        AvailabilityType.UNAVAILABLE
                        if day == 0
                        else AvailabilityType.AVAILABLE
                    )
                self.mock_availabilities.append(avail)

        # Configure mock resources
        self.mock_resources.get_employee.side_effect = lambda id: next(
            (e for e in self.mock_employees if e.id == id), None
        )
        self.mock_resources.get_shift.side_effect = lambda id: next(
            (s for s in self.mock_shifts if s.id == id), None
        )
        self.mock_resources.employees = self.mock_employees
        self.mock_resources.shifts = self.mock_shifts
        self.mock_resources.availabilities = self.mock_availabilities

        # Mock for employee availability checks
        def mock_get_employee_availabilities(employee_id, check_date):
            day_of_week = check_date.weekday()
            return [
                a
                for a in self.mock_availabilities
                if a.employee_id == employee_id and a.day_of_week == day_of_week
            ]

        self.mock_resources.get_employee_availabilities.side_effect = (
            mock_get_employee_availabilities
        )

        # Mock for employee leave checks
        self.mock_resources.is_employee_on_leave.return_value = False

        # Mock for schedule entry checks
        self.mock_resources.get_schedule_entry.return_value = None

    def test_check_availability(self):
        """Test checking employee availability for a shift"""
        # Test case 1: Employee is available
        result = self.constraint_checker.check_availability(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertTrue(result.is_valid)

        # Test case 2: Employee is unavailable on Mondays (employee 3)
        result = self.constraint_checker.check_availability(
            3,
            date(2023, 3, 6),
            self.mock_shifts[0],  # Monday
        )
        self.assertFalse(result.is_valid)
        self.assertIn("unavailable", result.message.lower())

        # Test case 3: Employee is on leave
        self.mock_resources.is_employee_on_leave.return_value = True
        result = self.constraint_checker.check_availability(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertFalse(result.is_valid)
        self.assertIn("on leave", result.message.lower())

        # Reset leave mock
        self.mock_resources.is_employee_on_leave.return_value = False

    def test_check_keyholder_requirement(self):
        """Test checking keyholder requirement for shifts"""
        # Test case 1: Keyholder assigned to shift that requires keyholder
        result = self.constraint_checker.check_keyholder_requirement(
            1,
            self.mock_shifts[0],  # Employee 1 is keyholder, shift 1 requires keyholder
        )
        self.assertTrue(result.is_valid)

        # Test case 2: Non-keyholder assigned to shift that requires keyholder
        result = self.constraint_checker.check_keyholder_requirement(
            2,
            self.mock_shifts[
                0
            ],  # Employee 2 is not keyholder, shift 1 requires keyholder
        )
        self.assertFalse(result.is_valid)
        self.assertIn("keyholder", result.message.lower())

        # Test case 3: Keyholder assigned to shift that doesn't require keyholder
        result = self.constraint_checker.check_keyholder_requirement(
            1,
            self.mock_shifts[
                1
            ],  # Employee 1 is keyholder, shift 2 doesn't require keyholder
        )
        self.assertTrue(result.is_valid)

        # Test case 4: Non-keyholder assigned to shift that doesn't require keyholder
        result = self.constraint_checker.check_keyholder_requirement(
            2,
            self.mock_shifts[
                1
            ],  # Employee 2 is not keyholder, shift 2 doesn't require keyholder
        )
        self.assertTrue(result.is_valid)

    def test_check_daily_shift_limit(self):
        """Test checking daily shift limit constraint"""
        # Test case 1: First assignment of the day
        result = self.constraint_checker.check_daily_shift_limit(1, date(2023, 3, 7))
        self.assertTrue(result.is_valid)

        # Test case 2: Employee already has a shift on the day
        # Mock an existing schedule entry
        mock_entry = MagicMock()
        mock_entry.employee_id = 1
        mock_entry.shift_id = 1
        self.mock_resources.get_schedule_entry.return_value = mock_entry

        result = self.constraint_checker.check_daily_shift_limit(1, date(2023, 3, 7))
        self.assertFalse(result.is_valid)
        self.assertIn("already assigned", result.message.lower())

        # Reset schedule entry mock
        self.mock_resources.get_schedule_entry.return_value = None

    def test_check_consecutive_days(self):
        """Test checking consecutive days worked constraint"""

        # Create mock schedule entries for previous days
        def mock_get_schedule_entries_for_dates(employee_id, date_range):
            # Return 5 consecutive days of work before the test date
            result = []
            for i in range(5):
                entry = MagicMock()
                entry.employee_id = employee_id
                entry.date = date_range[i]
                entry.shift_id = 1
                result.append(entry)
            return result

        # Test case 1: No consecutive days limit
        self.constraint_checker.max_consecutive_days = 0
        result = self.constraint_checker.check_consecutive_days(1, date(2023, 3, 7))
        self.assertTrue(result.is_valid)

        # Test case 2: Within consecutive days limit
        self.constraint_checker.max_consecutive_days = 6
        self.mock_resources.get_schedule_entries_for_dates = (
            mock_get_schedule_entries_for_dates
        )
        result = self.constraint_checker.check_consecutive_days(1, date(2023, 3, 7))
        self.assertTrue(result.is_valid)

        # Test case 3: Exceeds consecutive days limit
        self.constraint_checker.max_consecutive_days = 5
        result = self.constraint_checker.check_consecutive_days(1, date(2023, 3, 7))
        self.assertFalse(result.is_valid)
        self.assertIn("consecutive days", result.message.lower())

        # Reset consecutive days setting
        self.constraint_checker.max_consecutive_days = 7

    def test_check_weekly_hours(self):
        """Test checking weekly hours constraint"""

        # Create mock schedule entries for the week
        def mock_get_schedule_entries_for_dates(employee_id, date_range):
            # Return entries with shifts that sum to 30 hours
            result = []
            for i in range(5):  # 5 days with 6-hour shifts = 30 hours
                entry = MagicMock()
                entry.employee_id = employee_id
                entry.date = date_range[i]
                entry.shift_id = 1
                entry.shift = self.mock_shifts[0]  # 6-hour shift
                result.append(entry)
            return result

        # Mock the method to get shift duration
        def mock_get_shift_duration(shift):
            return shift.duration_hours

        self.constraint_checker._get_shift_duration = mock_get_shift_duration
        self.mock_resources.get_schedule_entries_for_dates = (
            mock_get_schedule_entries_for_dates
        )

        # Test case 1: VZ employee (40 hours) with 30 + 6 = 36 hours (within limit)
        result = self.constraint_checker.check_weekly_hours(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertTrue(result.is_valid)

        # Test case 2: TZ employee (20 hours) with 30 + 6 = 36 hours (exceeds limit)
        result = self.constraint_checker.check_weekly_hours(
            2, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertFalse(result.is_valid)
        self.assertIn("weekly hours", result.message.lower())

        # Test case 3: No weekly hours limit
        self.mock_employees[0].weekly_hours = 0
        result = self.constraint_checker.check_weekly_hours(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertTrue(result.is_valid)

        # Reset employee hours
        self.mock_employees[0].weekly_hours = 40

    def test_check_rest_period(self):
        """Test checking required rest period between shifts"""
        # Create a mock previous day's schedule entry
        previous_entry = MagicMock()
        previous_entry.employee_id = 1
        previous_entry.shift_id = 3  # Night shift (20:00-02:00)
        previous_entry.shift = self.mock_shifts[2]
        previous_entry.date = date(2023, 3, 6)  # Previous day

        # Mock to return the previous day's entry
        def mock_get_schedule_entry(employee_id, check_date):
            if check_date == date(2023, 3, 6) and employee_id == 1:
                return previous_entry
            return None

        self.mock_resources.get_schedule_entry.side_effect = mock_get_schedule_entry

        # Test case 1: Not enough rest time between shifts
        # Night shift ends at 02:00, morning shift starts at 08:00 (6 hours rest)
        result = self.constraint_checker.check_rest_period(
            1,
            date(2023, 3, 7),
            self.mock_shifts[0],  # Morning shift next day
        )
        self.assertFalse(result.is_valid)
        self.assertIn("rest period", result.message.lower())

        # Test case 2: Enough rest time between shifts
        # Night shift ends at 02:00, afternoon shift starts at 14:00 (12 hours rest)
        result = self.constraint_checker.check_rest_period(
            1,
            date(2023, 3, 7),
            self.mock_shifts[1],  # Afternoon shift next day
        )
        self.assertTrue(result.is_valid)

        # Test case 3: No previous shift
        self.mock_resources.get_schedule_entry.side_effect = (
            lambda employee_id, check_date: None
        )
        result = self.constraint_checker.check_rest_period(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertTrue(result.is_valid)

    def test_validate_assignment(self):
        """Test validating a complete assignment against all constraints"""
        # Set up mocks for individual constraint checks
        self.constraint_checker.check_availability = MagicMock(
            return_value=MagicMock(is_valid=True)
        )
        self.constraint_checker.check_keyholder_requirement = MagicMock(
            return_value=MagicMock(is_valid=True)
        )
        self.constraint_checker.check_daily_shift_limit = MagicMock(
            return_value=MagicMock(is_valid=True)
        )
        self.constraint_checker.check_consecutive_days = MagicMock(
            return_value=MagicMock(is_valid=True)
        )
        self.constraint_checker.check_weekly_hours = MagicMock(
            return_value=MagicMock(is_valid=True)
        )
        self.constraint_checker.check_rest_period = MagicMock(
            return_value=MagicMock(is_valid=True)
        )

        # Test case 1: All constraints passed
        result = self.constraint_checker.validate_assignment(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertTrue(result.is_valid)

        # Test case 2: One constraint failed
        self.constraint_checker.check_availability.return_value = MagicMock(
            is_valid=False, message="Employee is unavailable"
        )
        result = self.constraint_checker.validate_assignment(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertFalse(result.is_valid)
        self.assertIn("unavailable", result.message.lower())

        # Test case 3: Multiple constraints failed
        self.constraint_checker.check_keyholder_requirement.return_value = MagicMock(
            is_valid=False, message="Keyholder required"
        )
        result = self.constraint_checker.validate_assignment(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertFalse(result.is_valid)
        self.assertTrue(
            "unavailable" in result.message.lower()
            or "keyholder" in result.message.lower()
        )

    def test_get_validity_score(self):
        """Test calculating validity score for an assignment"""
        # Create mock validation result with different availability types

        # Test case 1: Employee is AVAILABLE (score = 1.0)
        avail = MagicMock()
        avail.availability_type = AvailabilityType.AVAILABLE

        self.mock_resources.get_employee_availabilities.return_value = [avail]
        self.mock_resources.is_employee_on_leave.return_value = False

        score = self.constraint_checker.get_validity_score(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertEqual(score, 1.0)

        # Test case 2: Employee is PREFERRED (score = 1.2)
        avail.availability_type = AvailabilityType.PREFERRED
        score = self.constraint_checker.get_validity_score(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertEqual(score, 1.2)

        # Test case 3: Employee is UNAVAILABLE (score = 0.0)
        avail.availability_type = AvailabilityType.UNAVAILABLE
        score = self.constraint_checker.get_validity_score(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertEqual(score, 0.0)

        # Test case 4: Employee is on leave (score = 0.0)
        avail.availability_type = AvailabilityType.AVAILABLE
        self.mock_resources.is_employee_on_leave.return_value = True
        score = self.constraint_checker.get_validity_score(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertEqual(score, 0.0)

        # Test case 5: No availability data (score = 0.5)
        self.mock_resources.get_employee_availabilities.return_value = []
        self.mock_resources.is_employee_on_leave.return_value = False
        score = self.constraint_checker.get_validity_score(
            1, date(2023, 3, 7), self.mock_shifts[0]
        )
        self.assertEqual(score, 0.5)


if __name__ == "__main__":
    unittest.main()
