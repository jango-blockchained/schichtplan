import unittest
from unittest.mock import MagicMock, call
from datetime import date, timedelta
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import components to test
from services.scheduler.generator import (
    ScheduleGenerator,
    ScheduleContainer,
    ScheduleAssignment,
    ScheduleGenerationError,
)
from services.scheduler.resources import ScheduleResources, ScheduleResourceError
from services.scheduler.config import SchedulerConfig
from services.scheduler.constraints import ConstraintChecker
from services.scheduler.availability import AvailabilityChecker
from services.scheduler.distribution import DistributionManager
from services.scheduler.serialization import ScheduleSerializer

from models.employee import AvailabilityType, EmployeeGroup


class TestSchedulerIntegration(unittest.TestCase):
    """
    Test the integration of different scheduler components.
    This test suite focuses on how components work together
    rather than individual component functionality.
    """

    def setUp(self):
        """Set up test fixtures"""
        # Create mock components
        self.mock_resources = MagicMock(spec=ScheduleResources)
        self.mock_config = MagicMock(spec=SchedulerConfig)
        self.mock_constraints = MagicMock(spec=ConstraintChecker)
        self.mock_availability = MagicMock(spec=AvailabilityChecker)
        self.mock_distribution = MagicMock(spec=DistributionManager)
        self.mock_serializer = MagicMock(spec=ScheduleSerializer)

        # Set up the generator with mocked components
        self.generator = ScheduleGenerator(
            resources=self.mock_resources, config=self.mock_config
        )

        # Replace the generator's components with our mocks
        self.generator.constraint_checker = self.mock_constraints
        self.generator.availability_checker = self.mock_availability
        self.generator.distribution_manager = self.mock_distribution
        self.generator.serializer = self.mock_serializer

        # Set up test dates
        self.start_date = date(2023, 3, 6)  # Monday
        self.end_date = date(2023, 3, 10)  # Friday

        # Set up mock employees
        self.mock_employees = []
        for i in range(5):
            employee = MagicMock()
            employee.id = i + 1
            employee.first_name = f"Employee{i + 1}"
            employee.last_name = "Test"
            employee.employee_group = (
                EmployeeGroup.VZ
                if i < 2
                else (EmployeeGroup.TZ if i < 4 else EmployeeGroup.GFB)
            )
            employee.is_keyholder = i == 0  # First employee is keyholder
            self.mock_employees.append(employee)

        # Set up mock shifts
        self.mock_shifts = []
        shift_times = [
            ("08:00", "16:00", "EARLY"),
            ("10:00", "18:00", "MIDDLE"),
            ("14:00", "22:00", "LATE"),
        ]
        for i, (start, end, shift_type) in enumerate(shift_times):
            shift = MagicMock()
            shift.id = i + 1
            shift.start_time = start
            shift.end_time = end
            shift.shift_type = shift_type
            shift.duration_hours = 8.0
            self.mock_shifts.append(shift)

        # Mock availability data
        self.mock_availabilities = []
        for emp_id in range(1, 6):
            for day in range(7):  # 0-6 for days of week
                for hour in range(8, 22):  # Work hours 8am-10pm
                    avail = MagicMock()
                    avail.employee_id = emp_id
                    avail.day_of_week = day
                    avail.hour = hour
                    avail.is_available = True
                    avail.availability_type = AvailabilityType.AVAILABLE
                    self.mock_availabilities.append(avail)

        # Mock coverage data
        self.mock_coverage = []
        for day in range(5):  # Monday-Friday
            for shift_type in ["EARLY", "MIDDLE", "LATE"]:
                coverage = MagicMock()
                coverage.day_of_week = day
                coverage.shift_type = shift_type
                coverage.min_employees = 1
                self.mock_coverage.append(coverage)

        # Set up mock resources return values
        self.mock_resources.is_loaded.return_value = False
        self.mock_resources.employees = self.mock_employees
        self.mock_resources.shifts = self.mock_shifts
        self.mock_resources.availabilities = self.mock_availabilities
        self.mock_resources.coverage = self.mock_coverage

        # Mock distribution manager to return assignments
        def mock_assign_employees(date_val, shifts, employees_needed):
            assignments = []
            for i, shift in enumerate(shifts):
                # Assign employee based on shift type
                emp_id = i % len(self.mock_employees) + 1
                assignment = ScheduleAssignment(
                    employee_id=emp_id,
                    shift_id=shift["shift_id"],
                    date=date_val,
                    shift_template=shift["shift_template"],
                    availability_type=AvailabilityType.AVAILABLE.value,
                    status="PENDING",
                    version=1,
                )
                assignments.append(assignment)
            return assignments

        self.mock_distribution.assign_employees_with_distribution.side_effect = (
            mock_assign_employees
        )

        # Mock serializer to return expected format
        def mock_create_entries(assignments, status, version):
            entries = []
            for a in assignments:
                entry = MagicMock()
                entry.employee_id = a.employee_id
                entry.shift_id = a.shift_id
                entry.date = a.date
                entries.append(entry)
            return entries

        self.mock_serializer.create_schedule_entries.side_effect = mock_create_entries

        def mock_convert_schedule(schedule):
            return {
                "schedule_id": getattr(schedule, "id", None),
                "version": schedule.version,
                "status": schedule.status,
                "start_date": schedule.start_date.isoformat(),
                "end_date": schedule.end_date.isoformat(),
                "entries": [{"id": i} for i in range(len(schedule.entries))],
            }

        self.mock_serializer.convert_schedule_to_dict.side_effect = (
            mock_convert_schedule
        )

    def test_schedule_container_initialization(self):
        """Test that the ScheduleContainer is initialized correctly"""
        container = ScheduleContainer(
            start_date=self.start_date, end_date=self.end_date, status="TEST", version=2
        )

        self.assertEqual(container.start_date, self.start_date)
        self.assertEqual(container.end_date, self.end_date)
        self.assertEqual(container.status, "TEST")
        self.assertEqual(container.version, 2)
        self.assertEqual(container.entries, [])

    def test_generate_schedule_calls_components(self):
        """Test that generate_schedule calls the appropriate components"""
        # Call the method
        result = self.generator.generate_schedule(self.start_date, self.end_date)

        # Verify resources were loaded
        self.mock_resources.load.assert_called_once()

        # Verify distribution manager was called for each day
        expected_calls = []
        current_date = self.start_date
        while current_date <= self.end_date:
            expected_calls.append(
                call(current_date, unittest.mock.ANY, unittest.mock.ANY)
            )
            current_date += timedelta(days=1)

        self.assertEqual(
            len(
                self.mock_distribution.assign_employees_with_distribution.call_args_list
            ),
            len(expected_calls),
        )

        # Verify serializer was called
        self.mock_serializer.create_schedule_entries.assert_called_once()
        self.mock_serializer.convert_schedule_to_dict.assert_called_once()

        # Verify result is returned
        self.assertIsInstance(result, dict)
        self.assertIn("schedule_id", result)
        self.assertIn("version", result)
        self.assertIn("entries", result)

    def test_constraint_and_availability_integration(self):
        """Test that constraint and availability checkers are used properly"""
        # Call the method
        self.generator.generate_schedule(self.start_date, self.end_date)

        # Verify constraint checker was updated with schedule
        self.mock_constraints.set_schedule.assert_called()

        # Verify distribution manager was updated with constraint and availability checkers
        self.assertEqual(
            self.mock_distribution.constraint_checker, self.mock_constraints
        )

    def test_error_handling_resources_not_loaded(self):
        """Test that an error is raised if resources fail to load"""
        # Setup
        self.mock_resources.load.side_effect = ScheduleResourceError("Failed to load")

        # Execute and assert
        with self.assertRaises(ScheduleGenerationError) as context:
            self.generator.generate_schedule(self.start_date, self.end_date)

        self.assertIn("Failed to load", str(context.exception))

    def test_validate_shift_durations(self):
        """Test validation of shift durations"""
        # Setup - make one shift have no duration
        bad_shift = MagicMock()
        bad_shift.id = 99
        bad_shift.duration_hours = None
        bad_shift.start_time = None
        bad_shift.end_time = None

        self.mock_resources.shifts = [bad_shift]

        # Execute and assert
        with self.assertRaises(ScheduleGenerationError) as context:
            self.generator.generate_schedule(self.start_date, self.end_date)

        self.assertIn("Schichtdauer fehlt", str(context.exception))

    def test_process_coverage_match_by_day(self):
        """Test that coverage is correctly matched by day of week"""
        # Setup
        current_date = date(2023, 3, 8)  # Wednesday = day 2
        day_specific_coverage = MagicMock()
        day_specific_coverage.day_of_week = 2  # Wednesday
        day_specific_coverage.shift_type = "SPECIAL"
        day_specific_coverage.min_employees = 3

        self.mock_resources.coverage = [day_specific_coverage]

        # Execute
        result = self.generator._process_coverage(current_date)

        # Assert
        self.assertIn("SPECIAL", result)
        self.assertEqual(result["SPECIAL"], 3)

    def test_process_coverage_match_by_date(self):
        """Test that coverage is correctly matched by specific date"""
        # Setup
        current_date = date(2023, 3, 8)  # A specific date
        date_specific_coverage = MagicMock()
        date_specific_coverage.day_of_week = None
        date_specific_coverage.date = current_date
        date_specific_coverage.shift_type = "HOLIDAY"
        date_specific_coverage.min_employees = 2

        self.mock_resources.coverage = [date_specific_coverage]

        # Execute
        result = self.generator._process_coverage(current_date)

        # Assert
        self.assertIn("HOLIDAY", result)
        self.assertEqual(result["HOLIDAY"], 2)

    def test_create_date_shifts(self):
        """Test creation of shifts for a specific date"""
        # Setup
        current_date = self.start_date

        # Execute
        result = self.generator._create_date_shifts(current_date)

        # Assert
        self.assertEqual(len(result), len(self.mock_shifts))
        for i, shift in enumerate(result):
            self.assertEqual(shift["shift_id"], self.mock_shifts[i].id)
            self.assertEqual(shift["shift_template"], self.mock_shifts[i])
            self.assertEqual(shift["date"], current_date)
            self.assertEqual(shift["shift_type"], self.mock_shifts[i].shift_type)

    def test_empty_schedule_when_no_coverage(self):
        """Test behavior when there is no coverage for a date"""
        # Setup - clear coverage data
        self.mock_resources.coverage = []

        # Execute
        result = self.generator.generate_schedule(
            self.start_date, self.end_date, create_empty_schedules=True
        )

        # Assert - should still create a valid schedule structure but with empty assignments
        self.assertIsInstance(result, dict)
        self.assertIn("entries", result)

        # Distribution should not be called for staffing
        self.mock_distribution.assign_employees_with_distribution.assert_not_called()


if __name__ == "__main__":
    unittest.main()
