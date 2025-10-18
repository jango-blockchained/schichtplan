import unittest
from unittest.mock import patch, MagicMock
from datetime import date, timedelta
from services.scheduler.generator import (
    ScheduleGenerator,
    ScheduleGenerationError,
    ScheduleAssignment,
)
from services.scheduler.resources import ScheduleResources
from models.employee import EmployeeGroup
from src.backend.app import create_app


class TestScheduleGenerator(unittest.TestCase):
    """Test the ScheduleGenerator class"""

    def setUp(self):
        """Set up test fixtures"""
        # Create generator
        self.generator = ScheduleGenerator()

        # Mock resources class
        self.generator.resources = MagicMock(spec=ScheduleResources)

        # Mock the ScheduleValidator class that will be instantiated by ScheduleGenerator
        # The patch ensures that any instantiation of ScheduleValidator within the scope
        # of the test will use mock_validator_instance.
        self.mock_validator_instance = MagicMock()
        self.mock_validator_instance.validate.return_value = []  # No validation errors by default
        # Assume get_coverage_summary and get_error_report are methods that will be called on the instance
        self.mock_validator_instance.get_coverage_summary.return_value = {
            "total_intervals_checked": 0
        }
        self.mock_validator_instance.get_error_report.return_value = {"errors": []}

        patch_validator = patch(
            "services.scheduler.generator.ScheduleValidator",  # Patch ScheduleValidator in the generator's module
            return_value=self.mock_validator_instance,
        )
        patch_validator.start()
        self.addCleanup(patch_validator.stop)

        # Mock ScheduleSerializer
        self.mock_serializer_instance = MagicMock()
        self.mock_serializer_instance.serialize_schedule.return_value = {
            "schedule": [],
            "metrics": {},
        }  # Basic return
        patch_serializer = patch(
            "services.scheduler.generator.ScheduleSerializer",
            return_value=self.mock_serializer_instance,
        )
        patch_serializer.start()
        self.addCleanup(patch_serializer.stop)

        # Set test dates
        self.start_date = date(2023, 3, 6)  # Monday
        self.end_date = date(2023, 3, 10)  # Friday

        # Create mock shifts
        self.mock_shifts = []
        for i in range(3):
            mock_shift = MagicMock()
            mock_shift.id = i + 1
            mock_shift.start_time = (
                "09:00" if i == 0 else ("13:00" if i == 1 else "17:00")
            )
            mock_shift.end_time = (
                "13:00" if i == 0 else ("17:00" if i == 1 else "21:00")
            )
            mock_shift.duration_hours = 4.0
            mock_shift.requires_keyholder = i == 2  # Evening shift requires keyholder
            self.mock_shifts.append(mock_shift)

        # Create mock employees
        self.mock_employees = []
        for i in range(5):
            mock_employee = MagicMock()
            mock_employee.id = i + 1
            mock_employee.first_name = f"Employee{i + 1}"
            mock_employee.last_name = "Test"
            mock_employee.employee_group = (
                EmployeeGroup.TZ if i < 3 else EmployeeGroup.GFB
            )
            mock_employee.is_keyholder = i == 0  # First employee is a keyholder
            self.mock_employees.append(mock_employee)

        # Create mock coverage
        self.mock_coverage = []
        for i in range(3):
            mock_cov = MagicMock()
            mock_cov.id = i + 1
            mock_cov.day_index = 0  # Monday
            mock_cov.start_time = (
                "09:00" if i == 0 else ("13:00" if i == 1 else "17:00")
            )
            mock_cov.end_time = "13:00" if i == 0 else ("17:00" if i == 1 else "21:00")
            mock_cov.min_employees = 2
            self.mock_coverage.append(mock_cov)

        # Set up resources
        self.generator.resources.shifts = self.mock_shifts
        self.generator.resources.employees = self.mock_employees
        self.generator.resources.coverage = self.mock_coverage
        self.generator.resources.get_daily_coverage.return_value = self.mock_coverage
        self.generator.resources.is_employee_available.return_value = (
            True  # All employees available by default
        )
        # Add mock availabilities attribute to prevent AttributeError
        self.generator.resources.availabilities = []

    def test_generate_basic_schedule(self):
        """Test generating a basic schedule, focusing on orchestration."""
        app = create_app()
        mock_daily_assignments = [
            ScheduleAssignment(
                employee_id=1,
                shift_id=101,
                date_val=self.start_date,
                status="PENDING",
                version=1,
                shift_template=None,
                availability_type="AVAILABLE",
                break_start=None,
                break_end=None,
                notes=None,
            ),
            ScheduleAssignment(
                employee_id=2,
                shift_id=102,
                date_val=self.start_date,
                status="PENDING",
                version=1,
                shift_template=None,
                availability_type="AVAILABLE",
                break_start=None,
                break_end=None,
                notes=None,
            ),
        ]
        with (
            patch.object(
                self.generator,
                "_generate_assignments_for_date",
                return_value=mock_daily_assignments,
            ) as mock_gen_assignments_for_date,
            patch(
                "services.scheduler.generator.ScheduleContainer.get_assignments",
                return_value=mock_daily_assignments,
            ),
        ):
            with app.app_context():
                result = self.generator.generate(self.start_date, self.end_date)
            # Assert for serializer output keys
            for key in [
                "schedule_id",
                "entries",
                "start_date",
                "end_date",
                "version",
                "status",
            ]:
                self.assertIn(key, result)
            self.generator.resources.load.assert_called_once()
            num_days = (self.end_date - self.start_date).days + 1
            self.assertEqual(mock_gen_assignments_for_date.call_count, num_days)
            for i in range(num_days):
                expected_date = self.start_date + timedelta(days=i)
                mock_gen_assignments_for_date.assert_any_call(expected_date)

    def test_with_validation_errors(self):
        """Test generation when the validator returns errors."""
        app = create_app()
        mock_validation_error = MagicMock()
        mock_validation_error.error_type = "coverage"
        mock_validation_error.message = "Insufficient staff"
        mock_validation_error.severity = "warning"
        mock_validation_error.details = {
            "date": "2023-03-06",
            "required": 2,
            "assigned": 1,
        }
        self.mock_validator_instance.validate.return_value = [mock_validation_error]
        self.mock_validator_instance.get_error_report.return_value = {
            "errors": [mock_validation_error]
        }
        mock_daily_assignments = [
            ScheduleAssignment(
                employee_id=1,
                shift_id=101,
                date_val=self.start_date,
                status="PENDING",
                version=1,
                shift_template=None,
                availability_type="AVAILABLE",
                break_start=None,
                break_end=None,
                notes=None,
            )
        ]
        with (
            patch.object(
                self.generator,
                "_generate_assignments_for_date",
                return_value=mock_daily_assignments,
            ) as mock_gen_assignments,
            patch(
                "services.scheduler.generator.ScheduleContainer.get_assignments",
                return_value=mock_daily_assignments,
            ),
        ):
            with app.app_context():
                result = self.generator.generate(self.start_date, self.end_date)
            for key in [
                "schedule_id",
                "entries",
                "start_date",
                "end_date",
                "version",
                "status",
            ]:
                self.assertIn(key, result)
            mock_gen_assignments.assert_called()

    def test_error_handling(self):
        """Test error handling during generation"""
        app = create_app()
        # Make resources.load raise an exception
        self.generator.resources.load.side_effect = Exception("Test error")

        # Verify exception gets wrapped in ScheduleGenerationError
        with app.app_context():
            with self.assertRaises(ScheduleGenerationError):
                self.generator.generate(self.start_date, self.end_date)

    # --- Tests for _create_date_shifts ---
    def test_create_date_shifts_active_days_list_match(self):
        """Test _create_date_shifts with active_days as a list, matching the day."""
        mock_template1 = MagicMock()
        mock_template1.id = 1001
        mock_template1.active_days = [0, 1, 2]  # Mon, Tue, Wed
        mock_template1.start_time = "09:00"
        mock_template1.end_time = "17:00"
        mock_template1.duration_hours = 8.0
        mock_template1.shift_type_id = "DAY"
        mock_template1.requires_keyholder = False

        self.generator.resources.shifts = [mock_template1]

        # Test for Monday (weekday 0)
        test_date_mon = date(2023, 3, 6)  # Monday
        date_shifts = self.generator._create_date_shifts(test_date_mon)
        self.assertEqual(len(date_shifts), 1)
        self.assertEqual(date_shifts[0]["id"], 1001)
        self.assertEqual(date_shifts[0]["active_days"], [0, 1, 2])

    def test_create_date_shifts_active_days_list_no_match(self):
        """Test _create_date_shifts with active_days as a list, not matching the day."""
        mock_template1 = MagicMock()
        mock_template1.id = 1002
        mock_template1.active_days = [2, 3]  # Wed, Thu
        mock_template1.start_time = "10:00"
        mock_template1.end_time = "18:00"
        mock_template1.duration_hours = 8.0
        mock_template1.shift_type_id = "REGULAR"

        self.generator.resources.shifts = [mock_template1]

        # Test for Monday (weekday 0)
        test_date_mon = date(2023, 3, 6)  # Monday
        date_shifts = self.generator._create_date_shifts(test_date_mon)
        self.assertEqual(len(date_shifts), 0)

    def test_create_date_shifts_active_days_json_string_match(self):
        """Test _create_date_shifts with active_days as a JSON string, matching."""
        mock_template1 = MagicMock()
        mock_template1.id = 1003
        mock_template1.active_days = "[0, 1]"  # Mon, Tue as JSON string
        mock_template1.start_time = "08:00"
        mock_template1.end_time = "16:00"
        mock_template1.duration_hours = 8.0
        mock_template1.shift_type_id = "EARLY"

        self.generator.resources.shifts = [mock_template1]

        test_date_tue = date(2023, 3, 7)  # Tuesday (weekday 1)
        date_shifts = self.generator._create_date_shifts(test_date_tue)
        self.assertEqual(len(date_shifts), 1)
        self.assertEqual(date_shifts[0]["id"], 1003)
        self.assertEqual(date_shifts[0]["active_days"], [0, 1])  # Expect parsed list

    def test_create_date_shifts_active_days_csv_string_match(self):
        """Test _create_date_shifts with active_days as a CSV string, matching."""
        mock_template1 = MagicMock()
        mock_template1.id = 1004
        mock_template1.active_days = "2, 3,4"  # Wed, Thu, Fri as CSV string
        mock_template1.start_time = "12:00"
        mock_template1.end_time = "20:00"
        mock_template1.duration_hours = 8.0
        mock_template1.shift_type_id = "LATE"

        self.generator.resources.shifts = [mock_template1]

        test_date_fri = date(2023, 3, 10)  # Friday (weekday 4)
        date_shifts = self.generator._create_date_shifts(test_date_fri)
        self.assertEqual(len(date_shifts), 1)
        self.assertEqual(date_shifts[0]["id"], 1004)
        self.assertEqual(date_shifts[0]["active_days"], [2, 3, 4])  # Expect parsed list

    def test_create_date_shifts_active_days_empty_list(self):
        """Test _create_date_shifts with active_days as an empty list."""
        mock_template1 = MagicMock()
        mock_template1.id = 1005
        mock_template1.active_days = []
        mock_template1.start_time = "09:00"
        mock_template1.end_time = "17:00"

        self.generator.resources.shifts = [mock_template1]
        test_date_mon = date(2023, 3, 6)  # Monday
        date_shifts = self.generator._create_date_shifts(test_date_mon)
        self.assertEqual(len(date_shifts), 0)

    def test_create_date_shifts_active_days_malformed_string(self):
        """Test _create_date_shifts with malformed active_days string."""
        mock_template1 = MagicMock()
        mock_template1.id = 1006
        mock_template1.active_days = "Mon,Tue,Wed"  # Not numbers or valid JSON
        mock_template1.start_time = "09:00"
        mock_template1.end_time = "17:00"

        self.generator.resources.shifts = [mock_template1]
        # Patch logger to check for warnings
        with patch.object(self.generator.logger, "warning") as mock_log_warning:
            test_date_mon = date(2023, 3, 6)  # Monday
            date_shifts = self.generator._create_date_shifts(test_date_mon)
            self.assertEqual(len(date_shifts), 0)
            mock_log_warning.assert_called_with(
                f"Could not parse active_days for shift {mock_template1.id}: {mock_template1.active_days}"
            )

    def test_create_date_shifts_template_missing_id(self):
        """Test _create_date_shifts with a shift template missing an ID."""
        mock_template_no_id = MagicMock(
            spec=[  # Use spec to control available attributes
                "active_days",
                "start_time",
                "end_time",
                "duration_hours",
                "shift_type_id",
                "requires_keyholder",
            ]
        )
        # Deliberately don't set mock_template_no_id.id
        # To make getattr(mock_template_no_id, 'id', None) return None,
        # we need to ensure 'id' is not even in the mock's spec if we want getattr to hit the default.
        # A simpler way is to mock it to return None when 'id' is accessed.
        del mock_template_no_id.id  # Ensure it's not there

        mock_template_no_id.active_days = [0]
        mock_template_no_id.start_time = "09:00"
        mock_template_no_id.end_time = "17:00"

        self.generator.resources.shifts = [mock_template_no_id]
        with patch.object(self.generator.logger, "warning") as mock_log_warning:
            test_date_mon = date(2023, 3, 6)  # Monday
            date_shifts = self.generator._create_date_shifts(test_date_mon)
            self.assertEqual(len(date_shifts), 0)
            # The warning message includes the representation of the shift template object.
            # We can check if the call occurred without matching the exact string for simplicity if the repr is complex.
            mock_log_warning.assert_any_call(
                f"Shift template has no ID, skipping: {mock_template_no_id}"
            )

    def test_create_date_shifts_shift_type_fallback(self):
        """Test fallback logic for shift_type if not specified."""
        mock_template_early = MagicMock()
        mock_template_early.id = 2001
        mock_template_early.active_days = [0]  # Monday
        mock_template_early.start_time = "08:00"  # Should result in "EARLY"
        mock_template_early.end_time = "12:00"
        # No shift_type or shift_type_id provided

        mock_template_middle = MagicMock()
        mock_template_middle.id = 2002
        mock_template_middle.active_days = [0]
        mock_template_middle.start_time = "11:30"  # Should result in "MIDDLE"
        mock_template_middle.end_time = "15:30"

        mock_template_late = MagicMock()
        mock_template_late.id = 2003
        mock_template_late.active_days = [0]
        mock_template_late.start_time = "14:00"  # Should result in "LATE"
        mock_template_late.end_time = "18:00"

        mock_template_default_type = MagicMock()
        mock_template_default_type.id = 2004
        mock_template_default_type.active_days = [0]
        mock_template_default_type.start_time = (
            "invalid_time"  # Should default to "MIDDLE"
        )
        mock_template_default_type.end_time = "20:00"

        self.generator.resources.shifts = [
            mock_template_early,
            mock_template_middle,
            mock_template_late,
            mock_template_default_type,
        ]
        test_date_mon = date(2023, 3, 6)  # Monday
        date_shifts = self.generator._create_date_shifts(test_date_mon)

        self.assertEqual(len(date_shifts), 4)
        self.assertEqual(date_shifts[0]["shift_type"], "EARLY")
        self.assertEqual(
            date_shifts[0]["shift_type_id"], "EARLY"
        )  # shift_type_id should also be set
        self.assertEqual(date_shifts[1]["shift_type"], "MIDDLE")
        self.assertEqual(date_shifts[2]["shift_type"], "LATE")
        self.assertEqual(
            date_shifts[3]["shift_type"], "MIDDLE"
        )  # Fallback for invalid start_time


if __name__ == "__main__":
    unittest.main()
