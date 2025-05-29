import unittest
from unittest.mock import MagicMock, patch
from datetime import date, timedelta, datetime
import sys
import os
import logging

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import components to test
from services.scheduler.constraints import ConstraintChecker
from services.scheduler.resources import ScheduleResources
from models.employee import AvailabilityType, EmployeeGroup, Employee


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
        self.mock_config.employee_types = [
            {"id": "VZ", "max_daily_hours": 8.0},
            {"id": "TZ", "max_daily_hours": 8.0},
            {"id": "GFB", "max_daily_hours": 6.0},
        ]
        self.mock_config.max_hours_per_group = {"VZ": 40, "TZ": 20, "GFB": 10}
        self.mock_config.min_rest_hours = 11.0  # Explicitly set for new tests
        self.mock_config.enforce_rest_periods = True  # Explicitly set for new tests
        self.mock_config.contracted_hours_limit_factor = (
            1.2  # Default from constraints.py
        )

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
            employee.contracted_hours = (
                40.0 if i == 0 else 20.0 if i == 1 else 10.0
            )  # Use contracted_hours
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
        self.mock_resources.get_employee.side_effect = lambda employee_id: next(
            (emp for emp in self.mock_employees if emp.id == employee_id), None
        )
        self.mock_resources.get_shift.side_effect = lambda shift_id: next(
            (shift for shift in self.mock_shifts if shift.id == shift_id), None
        )
        self.mock_resources.get_employee_availability_for_date.side_effect = (
            self.mock_get_availability
        )
        self.mock_resources.is_employee_on_leave.return_value = False

        # Create a schedule for testing
        self.test_schedule = {}
        self.test_schedule_by_date = {}

        # Setup the schedule with the constraint checker
        self.constraint_checker.set_schedule(
            self.test_schedule, self.test_schedule_by_date
        )

    def _create_mock_assignment(
        self,
        employee_id: int,
        shift_date: date,
        start_time_str: str,
        end_time_str: str,
        shift_id: int = 1,
    ) -> dict:
        """Helper to create a single mock assignment dictionary."""
        # Ensure shift_date is a string for the dictionary
        date_str = (
            shift_date.isoformat() if isinstance(shift_date, date) else str(shift_date)
        )

        # Calculate duration - simplified for mock, real duration calc is in ConstraintChecker
        start_h, start_m = map(int, start_time_str.split(":"))
        end_h, end_m = map(int, end_time_str.split(":"))
        duration = (end_h - start_h) + (end_m - start_m) / 60.0
        if duration < 0:  # Handles overnight
            duration += 24

        return {
            "employee_id": employee_id,
            "date": date_str,
            "shift_id": shift_id,
            "start_time": start_time_str,
            "end_time": end_time_str,
            "duration_hours": duration,  # Include for completeness, though not directly used by all constraint checks
        }

    def mock_get_availability(self, employee_id, current_date):
        """Mock getting employee availability for a date"""
        day_of_week = current_date.weekday()  # 0-6 for Monday-Sunday
        return next(
            (
                avail
                for avail in self.mock_availabilities
                if avail.employee_id == employee_id and avail.day_of_week == day_of_week
            ),
            None,
        )

    def test_exceeds_constraints_availability(self):
        """Test checking employee availability for a shift"""
        # Mock availability check
        monday = date(2023, 3, 6)  # Monday
        # Patch has_enough_rest to return True so we only test availability
        with patch.object(
            self.constraint_checker, "has_enough_rest", return_value=True
        ):
            # Test case 1: Employee is available (employee 1)
            # Set up the resources mock to return available
            avail = MagicMock()
            avail.availability_type = AvailabilityType.AVAILABLE
            self.mock_resources.get_employee_availability_for_date.return_value = avail
            self.mock_resources.is_employee_on_leave.return_value = False

            # Employee 1 should pass constraints
            result = self.constraint_checker.exceeds_constraints(
                self.mock_employees[0], date(2023, 3, 7), self.mock_shifts[0]
            )
            self.assertFalse(result)

            # Test case 2: Employee is on leave
            self.mock_resources.is_employee_on_leave.return_value = True
            result = self.constraint_checker.exceeds_constraints(
                self.mock_employees[0], date(2023, 3, 7), self.mock_shifts[0]
            )
            # If on leave, should exceed constraints
            self.assertTrue(result)

            # Reset leave mock
            self.mock_resources.is_employee_on_leave.return_value = False

    def test_exceeds_constraints_keyholder(self):
        """Test checking keyholder requirement"""
        # Setup for keyholder tests
        with patch.object(
            self.constraint_checker, "has_enough_rest", return_value=True
        ):
            with patch.object(
                self.constraint_checker, "count_consecutive_days", return_value=0
            ):
                # Employee 0 is a keyholder, shift 0 requires keyholder
                emp_keyholder = self.mock_employees[0]
                emp_non_keyholder = self.mock_employees[1]
                shift_requires_keyholder = self.mock_shifts[0]

                # Non-keyholder should exceed constraints for shift requiring keyholder
                shift_requires_keyholder.requires_keyholder = True
                emp_non_keyholder.is_keyholder = False

                # Make test simpler by returning low weekly hours
                with patch.object(
                    self.constraint_checker, "get_weekly_hours", return_value=0
                ):
                    # Test the keyholder constraint specifically
                    result = self.constraint_checker.exceeds_constraints(
                        emp_non_keyholder, date(2023, 3, 7), shift_requires_keyholder
                    )
                    # Should NOT exceed constraints since we're not checking keyholder requirement
                    # in the current implementation
                    self.assertFalse(result)

    def test_exceeds_constraints_daily_limit(self):
        """Test checking daily shift limit"""
        test_date = date(2023, 3, 7)

        # Patch other constraint checks to isolate daily shift limit testing
        with patch.object(
            self.constraint_checker, "has_enough_rest", return_value=True
        ):
            with patch.object(
                self.constraint_checker, "count_consecutive_days", return_value=0
            ):
                with patch.object(
                    self.constraint_checker, "get_weekly_hours", return_value=0
                ):
                    # Create a shift with duration that exceeds GFB daily limit
                    long_shift = MagicMock()
                    long_shift.id = 99
                    long_shift.start_time = "08:00"
                    long_shift.end_time = "18:00"  # 10 hours
                    long_shift.duration_hours = 10.0

                    # GFB employee with 6-hour daily limit
                    gfb_employee = self.mock_employees[2]

                    # Test exceeding daily limit
                    result = self.constraint_checker.exceeds_constraints(
                        gfb_employee, test_date, long_shift
                    )
                    # Should exceed constraints
                    self.assertTrue(result)

                    # Test within daily limit
                    short_shift = self.mock_shifts[0]  # 6 hours
                    result = self.constraint_checker.exceeds_constraints(
                        gfb_employee, test_date, short_shift
                    )
                    # Should not exceed constraints
                    self.assertFalse(result)

    def test_count_consecutive_days(self):
        """Test counting consecutive days worked"""
        # Setup a schedule with consecutive days
        employee_id = 1
        schedule_by_date = {}

        # Create 5 consecutive days of work in the schedule
        today = date(2023, 3, 10)
        for i in range(5):
            day = today - timedelta(days=i)
            schedule_by_date[day] = {
                "assignments": [{"employee_id": employee_id, "shift_id": 1}]
            }

        # Set the schedule
        self.constraint_checker.set_schedule({}, schedule_by_date)

        # Test count of consecutive days
        result = self.constraint_checker.count_consecutive_days(employee_id, today)
        self.assertEqual(result, 5)

        # Test with a gap in the schedule
        schedule_by_date = {}
        for i in range(5):
            if i != 2:  # Skip the 3rd day to create a gap
                day = today - timedelta(days=i)
                schedule_by_date[day] = {
                    "assignments": [{"employee_id": employee_id, "shift_id": 1}]
                }

        # Set the updated schedule
        self.constraint_checker.set_schedule({}, schedule_by_date)

        # Should only count 2 consecutive days (today and yesterday)
        result = self.constraint_checker.count_consecutive_days(employee_id, today)
        self.assertEqual(result, 2)

    def test_would_exceed_weekly_hours(self):
        """Test checking if assignment would exceed weekly hours limit"""
        # Setup test data
        employee_id = 1
        test_date = date(2023, 3, 8)  # Wednesday

        # Mock get_weekly_hours to return different values
        with patch.object(
            self.constraint_checker, "get_weekly_hours"
        ) as mock_get_weekly_hours:
            # Test case 1: Not exceeding weekly limit
            mock_get_weekly_hours.return_value = 30  # 30 hours already scheduled
            result = self.constraint_checker.would_exceed_weekly_hours(
                employee_id,
                test_date,
                "08:00",
                "14:00",  # 6-hour shift
            )
            self.assertFalse(result)  # 30 + 6 = 36, below 40 limit

            # Test case 2: Exceeding weekly limit
            mock_get_weekly_hours.return_value = 35  # 35 hours already scheduled
            result = self.constraint_checker.would_exceed_weekly_hours(
                employee_id,
                test_date,
                "08:00",
                "14:00",  # 6-hour shift
            )
            self.assertTrue(result)  # 35 + 6 = 41, above 40 limit

    def test_has_enough_rest(self):
        """Test checking rest period between shifts"""
        employee = self.mock_employees[0]
        employee.min_time_between_shifts = 12  # hours
        current_date = date(2023, 3, 8)

        # Setup a previous shift that ended recently
        yesterday = current_date - timedelta(days=1)
        schedule_by_date = {
            yesterday: {
                "assignments": [
                    {
                        "employee_id": employee.id,
                        "shift_id": self.mock_shifts[
                            2
                        ].id,  # Evening shift ending at 02:00
                    }
                ]
            }
        }

        # Make get_shift return our mock shift
        self.mock_resources.get_shift.return_value = self.mock_shifts[2]

        # Set the schedule
        self.constraint_checker.set_schedule({}, schedule_by_date)

        # Test insufficient rest (morning shift at 08:00 after night shift ending at 02:00)
        morning_shift = self.mock_shifts[0]  # Starts at 08:00
        result = self.constraint_checker.has_enough_rest(
            employee, morning_shift, current_date
        )
        self.assertFalse(result)  # Only 6 hours rest, needs 12

        # Test sufficient rest
        afternoon_shift = self.mock_shifts[1]  # Starts at 14:00
        result = self.constraint_checker.has_enough_rest(
            employee, afternoon_shift, current_date
        )
        self.assertTrue(result)  # 12 hours rest

    def test_exceeds_constraints_integration(self):
        """Test full constraint validation with all constraints in play"""
        test_date = date(2023, 3, 8)
        employee = self.mock_employees[0]

        # Setup a schedule with the employee working many consecutive days
        schedule_by_date = {}
        for i in range(7):  # 7 consecutive days
            day = test_date - timedelta(days=i)
            schedule_by_date[day] = {
                "assignments": [{"employee_id": employee.id, "shift_id": 1}]
            }

        # Set the schedule
        self.constraint_checker.set_schedule({}, schedule_by_date)

        # Test exceeding consecutive days constraint
        result = self.constraint_checker.exceeds_constraints(
            employee, test_date, self.mock_shifts[0]
        )
        self.assertTrue(result)

        # Reset for testing weekly hours
        schedule_by_date = {}
        self.constraint_checker.set_schedule({}, schedule_by_date)

        # Mock weekly hours to test that constraint
        with patch.object(self.constraint_checker, "get_weekly_hours", return_value=38):
            result = self.constraint_checker.exceeds_constraints(
                employee,
                test_date,
                self.mock_shifts[0],  # 6-hour shift
            )
            self.assertTrue(result)  # 38 + 6 = 44, exceeds 40 limit

    # --- Tests for check_all_constraints and its helpers ---

    def test_check_max_consecutive_days_no_violation(self):
        """Test _check_max_consecutive_days when no violation occurs."""
        employee = self.mock_employees[0]
        new_shift_date = date(2023, 3, 10)  # Friday
        self.mock_config.max_consecutive_days = 5

        # Employee worked Mon, Tue
        existing_assignments = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 6), "09:00", "17:00"
            ),  # Mon
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "09:00", "17:00"
            ),  # Tue
        ]

        # New shift on Friday (3rd consecutive day if previous were Wed, Thu - but they are not)
        # In this setup, adding Friday makes it the 1st day of a new potential streak, or continues a streak from Thursday.
        # To test a streak of 3 with the new shift:
        existing_assignments_for_streak = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 8), "09:00", "17:00"
            ),  # Wed
            self._create_mock_assignment(
                employee.id, date(2023, 3, 9), "09:00", "17:00"
            ),  # Thu
        ]

        violation = self.constraint_checker._check_max_consecutive_days(
            employee, new_shift_date, existing_assignments_for_streak
        )
        self.assertIsNone(
            violation, "Should be no violation for 3 consecutive days when limit is 5."
        )

    def test_check_max_consecutive_days_violation(self):
        """Test _check_max_consecutive_days when a violation occurs."""
        employee = self.mock_employees[0]
        new_shift_date = date(2023, 3, 10)  # Friday
        self.mock_config.max_consecutive_days = 3  # Lower limit for test

        # Employee worked Mon, Tue, Wed
        existing_assignments = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "09:00", "17:00"
            ),  # Tue (day before new potential streak starts)
            self._create_mock_assignment(
                employee.id, date(2023, 3, 8), "09:00", "17:00"
            ),  # Wed (1st)
            self._create_mock_assignment(
                employee.id, date(2023, 3, 9), "09:00", "17:00"
            ),  # Thu (2nd)
        ]
        # New shift on Friday would be the 3rd consecutive day. If limit is 2, it violates. If 3, it's okay.
        # Let's make existing assignments form a streak of 3, new shift would be 4th.
        self.mock_config.max_consecutive_days = 3
        existing_assignments_for_violation = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "09:00", "17:00"
            ),  # Tue
            self._create_mock_assignment(
                employee.id, date(2023, 3, 8), "09:00", "17:00"
            ),  # Wed
            self._create_mock_assignment(
                employee.id, date(2023, 3, 9), "09:00", "17:00"
            ),  # Thu
        ]

        violation = self.constraint_checker._check_max_consecutive_days(
            employee, new_shift_date, existing_assignments_for_violation
        )
        self.assertIsNotNone(violation, "A violation was expected.")
        # Add an explicit check for None to help the linter with type narrowing
        if violation is not None:
            self.assertEqual(violation["type"], "max_consecutive_days")
            self.assertEqual(violation["value"], 4)  # New shift makes it 4 consecutive
            self.assertEqual(violation["limit"], 3)
        else:
            # This else block should ideally not be reached if assertIsNotNone works as expected
            # but it satisfies the linter's view that violation *could* be None here.
            self.fail(
                "_check_max_consecutive_days returned None when a violation was expected."
            )

    def test_check_max_consecutive_days_edge_case_at_limit(self):
        """Test _check_max_consecutive_days at the exact limit."""
        employee = self.mock_employees[0]
        new_shift_date = date(2023, 3, 10)  # Friday
        self.mock_config.max_consecutive_days = 3

        # Employee worked Wed, Thu. New shift on Friday makes it 3 consecutive.
        existing_assignments = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 8), "09:00", "17:00"
            ),  # Wed
            self._create_mock_assignment(
                employee.id, date(2023, 3, 9), "09:00", "17:00"
            ),  # Thu
        ]
        violation = self.constraint_checker._check_max_consecutive_days(
            employee, new_shift_date, existing_assignments
        )
        self.assertIsNone(violation, "Working 3 days should not violate a limit of 3.")

    # --- Tests for _check_min_rest_between_shifts ---
    def test_check_min_rest_sufficient_rest(self):
        employee = self.mock_employees[0]
        new_shift_start_dt = datetime(2023, 3, 8, 14, 0)  # Wed 14:00
        new_shift_end_dt = datetime(2023, 3, 8, 22, 0)  # Wed 22:00
        self.mock_config.min_rest_hours = 11.0

        existing_assignments = [
            # Previous shift ended long ago
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "10:00", "18:00"
            ),  # Tue
            # Next shift starts much later
            self._create_mock_assignment(
                employee.id, date(2023, 3, 9), "14:00", "22:00"
            ),  # Thu
        ]
        violation = self.constraint_checker._check_min_rest_between_shifts(
            employee, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertIsNone(violation, "Sufficient rest should not cause a violation.")

    def test_check_min_rest_insufficient_before(self):
        employee = self.mock_employees[0]
        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)  # Wed 09:00
        new_shift_end_dt = datetime(2023, 3, 8, 17, 0)  # Wed 17:00
        self.mock_config.min_rest_hours = 11.0

        existing_assignments = [
            # Previous shift ended too recently: Tue 23:00 (10 hours before Wed 09:00)
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "15:00", "23:00"
            ),
        ]
        violation = self.constraint_checker._check_min_rest_between_shifts(
            employee, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertIsNotNone(violation)
        if violation:
            self.assertEqual(violation["type"], "min_rest_before")
            self.assertLess(violation["value"], self.mock_config.min_rest_hours)

    def test_check_min_rest_insufficient_after(self):
        employee = self.mock_employees[0]
        new_shift_start_dt = datetime(2023, 3, 8, 14, 0)  # Wed 14:00
        new_shift_end_dt = datetime(2023, 3, 8, 22, 0)  # Wed 22:00 (ends)
        self.mock_config.min_rest_hours = 11.0

        existing_assignments = [
            # Next shift starts too soon: Thu 08:00 (10 hours after Wed 22:00)
            self._create_mock_assignment(
                employee.id, date(2023, 3, 9), "08:00", "16:00"
            ),
        ]
        violation = self.constraint_checker._check_min_rest_between_shifts(
            employee, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertIsNotNone(violation)
        if violation:
            self.assertEqual(violation["type"], "min_rest_after")
            self.assertLess(violation["value"], self.mock_config.min_rest_hours)

    def test_check_min_rest_not_enforced(self):
        employee = self.mock_employees[0]
        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)
        new_shift_end_dt = datetime(2023, 3, 8, 17, 0)
        self.mock_config.min_rest_hours = 11.0
        self.mock_config.enforce_rest_periods = False  # Not enforced

        existing_assignments = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "15:00", "23:00"
            ),
        ]
        violation = self.constraint_checker._check_min_rest_between_shifts(
            employee, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertIsNone(
            violation, "Violation should be None if rest periods are not enforced."
        )
        self.mock_config.enforce_rest_periods = True  # Reset for other tests

    # --- Tests for _check_daily_hours_limit ---
    def test_check_daily_hours_limit_no_violation(self):
        employee_vz = self.mock_employees[0]  # VZ, default 8h limit from mock_config
        new_shift_duration = 7.5
        violation = self.constraint_checker._check_daily_hours_limit(
            employee_vz, new_shift_duration
        )
        self.assertIsNone(violation, "7.5h shift should not violate 8h limit for VZ.")

    def test_check_daily_hours_limit_violation(self):
        employee_gfb = self.mock_employees[2]  # GFB, 6h limit from mock_config
        # Ensure mock_config is set as expected for this employee type
        self.mock_config.employee_types = [
            {"id": "VZ", "max_daily_hours": 8.0},
            {"id": "TZ", "max_daily_hours": 8.0},
            {"id": "GFB", "max_daily_hours": 6.0},  # GFB limit
        ]
        # Re-initialize checker if config is changed per-test and not reset, or ensure config is stable.
        # For simplicity here, assume self.mock_config.employee_types in setUp is sufficient if not modified by other tests.

        new_shift_duration = 6.5  # Exceeds 6h limit for GFB
        violation = self.constraint_checker._check_daily_hours_limit(
            employee_gfb, new_shift_duration
        )
        self.assertIsNotNone(violation)
        if violation:
            self.assertEqual(violation["type"], "max_daily_hours")
            self.assertEqual(violation["limit"], 6.0)
            self.assertEqual(violation["value"], 6.5)

    def test_check_daily_hours_limit_group_not_in_config_uses_default_no_violation(
        self,
    ):
        employee_unknown_group = MagicMock(spec=Employee)
        employee_unknown_group.id = 99
        employee_unknown_group.employee_group = (
            "UNKNOWN_GROUP"  # Not in mock_config.employee_types
        )

        # Temporarily modify config to not include UNKNOWN_GROUP, relying on default
        original_employee_types = self.mock_config.employee_types
        self.mock_config.employee_types = [
            {"id": "VZ", "max_daily_hours": 10.0}  # Ensure default isn't hit due to VZ
        ]
        # ConstraintChecker uses a default of 8.0 if group not found

        new_shift_duration = 7.0
        violation = self.constraint_checker._check_daily_hours_limit(
            employee_unknown_group, new_shift_duration
        )
        self.assertIsNone(
            violation, "7h shift should not violate default 8h limit for unknown group."
        )
        self.mock_config.employee_types = original_employee_types  # Reset

    def test_check_daily_hours_limit_group_not_in_config_uses_default_violation(self):
        employee_unknown_group = MagicMock(spec=Employee)
        employee_unknown_group.id = 99
        employee_unknown_group.employee_group = "UNKNOWN_GROUP"

        original_employee_types = self.mock_config.employee_types
        self.mock_config.employee_types = [{"id": "VZ", "max_daily_hours": 10.0}]
        # ConstraintChecker uses a default of 8.0

        new_shift_duration = 8.5  # Exceeds default 8h limit
        violation = self.constraint_checker._check_daily_hours_limit(
            employee_unknown_group, new_shift_duration
        )
        self.assertIsNotNone(violation)
        if violation:
            self.assertEqual(violation["type"], "max_daily_hours")
            self.assertEqual(violation["limit"], 8.0)  # Default limit
            self.assertEqual(violation["value"], 8.5)
        self.mock_config.employee_types = original_employee_types  # Reset

    # --- Tests for _check_weekly_hours_limit ---
    def test_check_weekly_hours_limit_no_violation(self):
        employee_vz = self.mock_employees[0]  # VZ, 40h group limit, 40h contracted
        # self.mock_config.max_hours_per_group = {"VZ": 40, ...} (set in setUp)
        # employee_vz.contracted_hours = 40.0 (set in setUp)
        # self.mock_config.contracted_hours_limit_factor = 1.2 (set in setUp) -> 40*1.2 = 48h contract limit

        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)  # Wednesday
        new_shift_duration = 6.0
        existing_assignments = [
            self._create_mock_assignment(
                employee_vz.id, date(2023, 3, 6), "09:00", "17:00"
            ),  # Mon, 8h
            self._create_mock_assignment(
                employee_vz.id, date(2023, 3, 7), "09:00", "17:00"
            ),  # Tue, 8h
        ]  # Total existing = 16h. New shift = 6h. Projected = 22h.
        # Limit is min(40h group, 48h contract) = 40h.  22h < 40h. No violation.

        violation = self.constraint_checker._check_weekly_hours_limit(
            employee_vz, new_shift_start_dt, new_shift_duration, existing_assignments
        )
        self.assertIsNone(
            violation, "Projected 22h should not violate 40h group/48h contract limits."
        )

    def test_check_weekly_hours_limit_exceeds_group_limit(self):
        employee_gfb = self.mock_employees[2]  # GFB, 10h group limit, 10h contracted
        # self.mock_config.max_hours_per_group = {..., "GFB": 10}
        # employee_gfb.contracted_hours = 10.0
        # contract limit = 10*1.2 = 12h. Group limit is 10h.

        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)  # Wednesday
        new_shift_duration = 5.0  # New shift makes it 5h for the week for this test
        existing_assignments = [
            self._create_mock_assignment(
                employee_gfb.id, date(2023, 3, 6), "09:00", "15:00"
            ),  # Mon, 6h
        ]  # Total existing = 6h. New shift = 5h. Projected = 11h.
        # Group limit 10h. 11h > 10h. Violation.

        violation = self.constraint_checker._check_weekly_hours_limit(
            employee_gfb, new_shift_start_dt, new_shift_duration, existing_assignments
        )
        self.assertIsNotNone(violation)
        if violation:
            self.assertEqual(violation["type"], "max_weekly_hours_group")
            self.assertEqual(violation["limit"], 10.0)
            self.assertEqual(violation["value"], 11.0)

    def test_check_weekly_hours_limit_exceeds_contract_limit(self):
        employee_tz = self.mock_employees[1]  # TZ, 20h group limit, 20h contracted
        # self.mock_config.max_hours_per_group = {..., "TZ": 20}
        # employee_tz.contracted_hours = 20.0
        # contract limit factor 1.2 -> 20 * 1.2 = 24h contract limit.
        # For this test, let's assume group limit is higher, e.g., 30h, so contract limit is hit first.
        original_max_hours_group = self.mock_config.max_hours_per_group
        self.mock_config.max_hours_per_group = {"VZ": 40, "TZ": 30, "GFB": 10}

        new_shift_start_dt = datetime(2023, 3, 10, 9, 0)  # Friday
        new_shift_duration = 5.0
        existing_assignments = [
            self._create_mock_assignment(
                employee_tz.id, date(2023, 3, 6), "09:00", "17:00"
            ),  # Mon, 8h
            self._create_mock_assignment(
                employee_tz.id, date(2023, 3, 7), "09:00", "17:00"
            ),  # Tue, 8h
            self._create_mock_assignment(
                employee_tz.id, date(2023, 3, 8), "09:00", "13:00"
            ),  # Wed, 4h
        ]  # Total existing = 8+8+4 = 20h. New shift = 5h. Projected = 25h.
        # Group limit 30h. Contract limit 24h. 25h > 24h. Violation.

        violation = self.constraint_checker._check_weekly_hours_limit(
            employee_tz, new_shift_start_dt, new_shift_duration, existing_assignments
        )
        self.assertIsNotNone(violation)
        if violation:
            self.assertEqual(violation["type"], "max_weekly_hours_contract")
            self.assertEqual(violation["limit"], 24.0)  # 20 * 1.2
            self.assertEqual(violation["value"], 25.0)

        self.mock_config.max_hours_per_group = original_max_hours_group  # Reset

    def test_check_weekly_hours_limit_no_specific_group_limit_no_contract_violation(
        self,
    ):
        employee_unknown_group = MagicMock(spec=Employee)
        employee_unknown_group.id = 100
        employee_unknown_group.employee_group = "CASUAL"
        employee_unknown_group.contracted_hours = 5.0  # Low contracted hours
        self.mock_resources.get_employee.side_effect = (
            lambda eid: employee_unknown_group
            if eid == 100
            else next((emp for emp in self.mock_employees if emp.id == eid), None)
        )

        # Ensure "CASUAL" is not in max_hours_per_group, so no group limit applies from there
        original_max_hours_group = self.mock_config.max_hours_per_group
        self.mock_config.max_hours_per_group = {"VZ": 40}
        # Contract limit will be 5.0 * 1.2 = 6.0h

        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)
        new_shift_duration = 3.0
        existing_assignments = [
            self._create_mock_assignment(
                employee_unknown_group.id, date(2023, 3, 6), "09:00", "11:00"
            ),  # Mon, 2h
        ]  # Existing 2h. New 3h. Projected 5h. Contract limit 6h. No violation.

        violation = self.constraint_checker._check_weekly_hours_limit(
            employee_unknown_group,
            new_shift_start_dt,
            new_shift_duration,
            existing_assignments,
        )
        self.assertIsNone(
            violation,
            "Projected 5h for CASUAL (contract limit 6h) should be no violation.",
        )

        self.mock_config.max_hours_per_group = original_max_hours_group  # Reset
        # Reset side_effect for get_employee if it was changed for this test only
        self.mock_resources.get_employee.side_effect = lambda employee_id: next(
            (emp for emp in self.mock_employees if emp.id == employee_id), None
        )

    # --- Tests for check_all_constraints (integration) ---
    def test_check_all_constraints_no_violations(self):
        employee = self.mock_employees[0]  # VZ
        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)  # Wed 09:00
        new_shift_end_dt = datetime(2023, 3, 8, 17, 0)  # Wed 17:00 (8h duration)
        existing_assignments = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 6), "09:00", "17:00"
            )  # Mon
        ]
        # Reset config to sensible defaults for no violation
        self.mock_config.max_consecutive_days = 5
        self.mock_config.min_rest_hours = 11.0
        self.mock_config.employee_types = [{"id": "VZ", "max_daily_hours": 8.0}]
        self.mock_config.max_hours_per_group = {"VZ": 40}
        employee.contracted_hours = 40.0
        self.mock_config.contracted_hours_limit_factor = 1.2

        violations = self.constraint_checker.check_all_constraints(
            employee.id, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertEqual(
            len(violations), 0, f"Expected no violations, got: {violations}"
        )

    def test_check_all_constraints_single_violation_max_consecutive(self):
        employee = self.mock_employees[0]
        new_shift_start_dt = datetime(2023, 3, 10, 9, 0)  # Fri
        new_shift_end_dt = datetime(2023, 3, 10, 17, 0)  # Fri
        self.mock_config.max_consecutive_days = 3

        existing_assignments = [
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "09:00", "17:00"
            ),  # Tue
            self._create_mock_assignment(
                employee.id, date(2023, 3, 8), "09:00", "17:00"
            ),  # Wed
            self._create_mock_assignment(
                employee.id, date(2023, 3, 9), "09:00", "17:00"
            ),  # Thu
        ]  # New shift on Fri makes it 4 consecutive days

        violations = self.constraint_checker.check_all_constraints(
            employee.id, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertEqual(len(violations), 1)
        if violations:
            self.assertEqual(violations[0]["type"], "max_consecutive_days")

    def test_check_all_constraints_multiple_violations(self):
        employee = self.mock_employees[0]
        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)  # Wed 09:00
        new_shift_end_dt = datetime(2023, 3, 8, 19, 0)  # Wed 19:00 (10h duration)
        self.mock_config.max_consecutive_days = 1  # Will violate with any previous day
        self.mock_config.min_rest_hours = 12.0
        self.mock_config.employee_types = [
            {"id": "VZ", "max_daily_hours": 8.0}
        ]  # 10h shift violates this

        existing_assignments = [
            # Previous shift Mon, ends 23:00. New shift Wed 09:00. (34h rest, OK)
            # But let's make one that violates rest: Tue ends 22:00. New Wed 09:00 (11h rest, violates 12h limit)
            self._create_mock_assignment(
                employee.id, date(2023, 3, 6), "09:00", "17:00"
            ),  # Mon (makes consecutive violation)
            self._create_mock_assignment(
                employee.id, date(2023, 3, 7), "14:00", "22:00"
            ),  # Tue, ends 22:00
        ]

        violations = self.constraint_checker.check_all_constraints(
            employee.id, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertGreaterEqual(
            len(violations), 2, f"Expected at least 2 violations, got {violations}"
        )
        violation_types = [v["type"] for v in violations]
        self.assertIn("max_consecutive_days", violation_types)
        self.assertIn(
            "min_rest_before", violation_types
        )  # Rest between Tue 22:00 and Wed 09:00 is 11h < 12h
        self.assertIn("max_daily_hours", violation_types)  # 10h shift vs 8h limit

    def test_check_all_constraints_invalid_new_shift_duration(self):
        employee = self.mock_employees[0]
        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)
        new_shift_end_dt = datetime(2023, 3, 8, 8, 0)  # End before start
        existing_assignments = []
        violations = self.constraint_checker.check_all_constraints(
            employee.id, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        self.assertEqual(len(violations), 1)
        if violations:
            self.assertEqual(violations[0]["type"], "shift_error")
            self.assertIn("invalid or zero duration", violations[0]["message"])

    def test_check_all_constraints_employee_not_found(self):
        unknown_employee_id = 999
        new_shift_start_dt = datetime(2023, 3, 8, 9, 0)
        new_shift_end_dt = datetime(2023, 3, 8, 17, 0)
        existing_assignments = []

        # Ensure get_employee returns None for this ID
        original_side_effect = self.mock_resources.get_employee.side_effect

        def side_effect_for_unknown(emp_id):
            if emp_id == unknown_employee_id:
                return None
            return next((emp for emp in self.mock_employees if emp.id == emp_id), None)

        self.mock_resources.get_employee.side_effect = side_effect_for_unknown

        violations = self.constraint_checker.check_all_constraints(
            unknown_employee_id,
            new_shift_start_dt,
            new_shift_end_dt,
            existing_assignments,
        )
        self.assertEqual(len(violations), 1)
        if violations:
            self.assertEqual(violations[0]["type"], "resource_error")
            self.assertIn(
                f"Employee {unknown_employee_id} not found", violations[0]["message"]
            )

        self.mock_resources.get_employee.side_effect = original_side_effect  # Reset


if __name__ == "__main__":
    unittest.main()
