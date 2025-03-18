import unittest
from unittest.mock import patch, MagicMock
from datetime import date
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import components to test
from services.scheduler.resources import ScheduleResources, ScheduleResourceError
from models.employee import AvailabilityType, EmployeeGroup


class TestScheduleResources(unittest.TestCase):
    """
    Test the ScheduleResources class which handles loading and
    caching database resources for schedule generation.
    """

    def setUp(self):
        """Set up test fixtures"""
        # Create a ScheduleResources instance
        self.resources = ScheduleResources()

        # Create mock data
        self.mock_settings = MagicMock()
        self.mock_settings.id = 1
        self.mock_settings.company_name = "Test Company"

        self.mock_employees = []
        for i in range(3):
            employee = MagicMock()
            employee.id = i + 1
            employee.first_name = f"Employee{i + 1}"
            employee.last_name = "Test"
            employee.employee_group = (
                EmployeeGroup.VZ
                if i == 0
                else (EmployeeGroup.TZ if i == 1 else EmployeeGroup.GFB)
            )
            employee.is_keyholder = i == 0  # First employee is keyholder
            self.mock_employees.append(employee)

        self.mock_shifts = []
        for i in range(3):
            shift = MagicMock()
            shift.id = i + 1
            shift.name = f"Shift {i + 1}"
            shift.start_time = "08:00" if i == 0 else "14:00" if i == 1 else "20:00"
            shift.end_time = "14:00" if i == 0 else "20:00" if i == 1 else "02:00"
            shift.duration_hours = 6.0
            self.mock_shifts.append(shift)

        self.mock_absences = []
        for i in range(2):
            absence = MagicMock()
            absence.id = i + 1
            absence.employee_id = i + 1
            absence.start_date = date(2023, 3, 1)
            absence.end_date = date(2023, 3, 5)
            absence.reason = "Vacation" if i == 0 else "Sick"
            self.mock_absences.append(absence)

        self.mock_availabilities = []
        for emp_id in range(1, 4):
            for day in range(7):  # 0-6 for days of week
                avail = MagicMock()
                avail.id = len(self.mock_availabilities) + 1
                avail.employee_id = emp_id
                avail.day_of_week = day
                avail.hour = 12  # Noon
                avail.is_available = True
                avail.availability_type = AvailabilityType.AVAILABLE
                self.mock_availabilities.append(avail)

        self.mock_coverage = []
        for day in range(5):  # Monday-Friday
            coverage = MagicMock()
            coverage.id = day + 1
            coverage.day_of_week = day
            coverage.shift_type = "DAY"
            coverage.min_employees = 2
            self.mock_coverage.append(coverage)

        self.mock_schedules = []
        for i in range(3):
            schedule = MagicMock()
            schedule.id = i + 1
            schedule.employee_id = (i % 3) + 1
            schedule.shift_id = (i % 3) + 1
            schedule.date = date(2023, 3, i + 1)
            self.mock_schedules.append(schedule)

    @patch("services.scheduler.resources.Settings")
    @patch("services.scheduler.resources.Employee")
    @patch("services.scheduler.resources.ShiftTemplate")
    @patch("services.scheduler.resources.Coverage")
    @patch("services.scheduler.resources.Absence")
    @patch("services.scheduler.resources.EmployeeAvailability")
    @patch("services.scheduler.resources.Schedule")
    @patch("services.scheduler.resources.db")
    def test_load_resources_success(
        self,
        mock_db,
        mock_Schedule,
        mock_EmployeeAvailability,
        mock_Absence,
        mock_Coverage,
        mock_ShiftTemplate,
        mock_Employee,
        mock_Settings,
    ):
        """Test successful loading of all resources"""
        # Set up query mocks
        mock_Settings.query.first.return_value = self.mock_settings

        mock_Employee.query.filter_by.return_value.order_by.return_value.all.return_value = self.mock_employees

        mock_ShiftTemplate.query.all.return_value = self.mock_shifts
        mock_Coverage.query.all.return_value = self.mock_coverage
        mock_Absence.query.all.return_value = self.mock_absences
        mock_EmployeeAvailability.query.all.return_value = self.mock_availabilities

        # Call the method
        result = self.resources.load()

        # Verify resources were loaded
        self.assertTrue(result)
        self.assertTrue(self.resources.is_loaded())

        # Verify properties were set
        self.assertEqual(self.resources.settings, self.mock_settings)
        self.assertEqual(self.resources.employees, self.mock_employees)
        self.assertEqual(self.resources.shifts, self.mock_shifts)
        self.assertEqual(self.resources.coverage, self.mock_coverage)
        self.assertEqual(self.resources.absences, self.mock_absences)
        self.assertEqual(self.resources.availabilities, self.mock_availabilities)

    @patch("services.scheduler.resources.Settings")
    @patch("services.scheduler.resources.db")
    def test_load_settings_creates_default(self, mock_db, mock_Settings):
        """Test that default settings are created if none exist"""
        # Set up mock
        mock_Settings.query.first.return_value = None

        # Set up db session mock
        mock_session = MagicMock()
        mock_db.session = mock_session

        # Call the method
        result = self.resources._load_settings()

        # Verify a new settings object was created and added to the session
        self.assertIsNotNone(result)
        mock_Settings.assert_called_once()
        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()

    @patch("services.scheduler.resources.Employee")
    def test_load_employees_filters_active(self, mock_Employee):
        """Test that only active employees are loaded"""
        # Call the method
        self.resources._load_employees()

        # Verify filter was applied
        mock_Employee.query.filter_by.assert_called_once_with(is_active=True)

    @patch("services.scheduler.resources.Coverage")
    def test_load_coverage(self, mock_Coverage):
        """Test loading coverage data"""
        # Set up mock
        mock_Coverage.query.all.return_value = self.mock_coverage

        # Call the method
        result = self.resources._load_coverage()

        # Verify query was made and result returned
        mock_Coverage.query.all.assert_called_once()
        self.assertEqual(result, self.mock_coverage)

    @patch("services.scheduler.resources.ShiftTemplate")
    def test_load_shifts(self, mock_ShiftTemplate):
        """Test loading shift templates"""
        # Set up mock
        mock_ShiftTemplate.query.all.return_value = self.mock_shifts

        # Call the method
        result = self.resources._load_shifts()

        # Verify query was made and result returned
        mock_ShiftTemplate.query.all.assert_called_once()
        self.assertEqual(result, self.mock_shifts)

    @patch("services.scheduler.resources.Absence")
    def test_load_absences(self, mock_Absence):
        """Test loading absence data"""
        # Set up mock
        mock_Absence.query.all.return_value = self.mock_absences

        # Call the method
        result = self.resources._load_absences()

        # Verify query was made and result returned
        mock_Absence.query.all.assert_called_once()
        self.assertEqual(result, self.mock_absences)

    @patch("services.scheduler.resources.EmployeeAvailability")
    def test_load_availabilities(self, mock_EmployeeAvailability):
        """Test loading availability data"""
        # Set up mock
        mock_EmployeeAvailability.query.all.return_value = self.mock_availabilities

        # Call the method
        result = self.resources._load_availabilities()

        # Verify query was made and result returned
        mock_EmployeeAvailability.query.all.assert_called_once()
        self.assertEqual(result, self.mock_availabilities)

    @patch("services.scheduler.resources.Settings")
    def test_load_error_handling(self, mock_Settings):
        """Test that errors during loading are handled properly"""
        # Set up mock to raise an exception
        mock_Settings.query.first.side_effect = Exception("Database error")

        # Call the method and verify exception is raised
        with self.assertRaises(ScheduleResourceError) as context:
            self.resources.load()

        self.assertIn("Failed to load resources", str(context.exception))

    def test_get_employee_absences(self):
        """Test retrieving absences for a specific employee and date range"""
        # Set up test data
        self.resources.absences = self.mock_absences

        # Cache employee
        self.resources._employee_cache = {1: self.mock_employees[0]}

        # Test case 1: Employee with absences in date range
        absences = self.resources.get_employee_absences(
            1, date(2023, 3, 3), date(2023, 3, 10)
        )
        self.assertEqual(len(absences), 1)
        self.assertEqual(absences[0].employee_id, 1)

        # Test case 2: Date range not overlapping with absences
        absences = self.resources.get_employee_absences(
            1, date(2023, 3, 6), date(2023, 3, 10)
        )
        self.assertEqual(len(absences), 0)

        # Test case 3: Employee without absences
        absences = self.resources.get_employee_absences(
            3, date(2023, 3, 1), date(2023, 3, 10)
        )
        self.assertEqual(len(absences), 0)

        # Test case 4: Employee not in cache
        absences = self.resources.get_employee_absences(
            99, date(2023, 3, 1), date(2023, 3, 10)
        )
        self.assertEqual(len(absences), 0)

    def test_get_employee_availability(self):
        """Test retrieving availability for a specific employee and day of week"""
        # Set up test data
        self.resources.availabilities = self.mock_availabilities

        # Cache employee
        self.resources._employee_cache = {
            1: self.mock_employees[0],
            2: self.mock_employees[1],
            3: self.mock_employees[2],
        }

        # Test case 1: Employee with availability on specified day
        availability = self.resources.get_employee_availability(1, 0)  # Monday
        self.assertEqual(len(availability), 1)
        self.assertEqual(availability[0].employee_id, 1)
        self.assertEqual(availability[0].day_of_week, 0)

        # Test case 2: Employee without availability on specified day
        # (All employees have availability for all days in our mock data)

        # Test case 3: Employee not in cache
        availability = self.resources.get_employee_availability(99, 0)
        self.assertEqual(len(availability), 0)

    def test_get_daily_coverage(self):
        """Test retrieving coverage for a specific date"""
        # Set up test data
        for cov in self.mock_coverage:
            # Update the mock coverage to use day_index instead of day_of_week
            cov.day_index = cov.day_of_week

        self.resources.coverage = self.mock_coverage

        # Test case 1: Weekday with coverage
        monday = date(2023, 3, 6)  # A Monday (weekday 0)
        coverage = self.resources.get_daily_coverage(monday)
        self.assertEqual(len(coverage), 1)
        self.assertEqual(coverage[0].day_index, 0)
        self.assertEqual(coverage[0].min_employees, 2)

        # Test case 2: Weekend without coverage
        saturday = date(2023, 3, 11)  # A Saturday (weekday 5)
        coverage = self.resources.get_daily_coverage(saturday)
        self.assertEqual(len(coverage), 0)

    def test_add_schedule_entry(self):
        """Test adding and retrieving schedule entries"""
        # Set up test schedule entry
        employee_id = 1
        test_date = date(2023, 3, 15)
        test_schedule = MagicMock()
        test_schedule.employee_id = employee_id
        test_schedule.date = test_date

        # Add entry
        self.resources.add_schedule_entry(employee_id, test_date, test_schedule)

        # Retrieve entry
        retrieved = self.resources.get_schedule_entry(employee_id, test_date)
        self.assertEqual(retrieved, test_schedule)

        # Test removing entry
        self.resources.remove_schedule_entry(employee_id, test_date)
        self.assertIsNone(self.resources.get_schedule_entry(employee_id, test_date))

    def test_clear_schedule_data(self):
        """Test clearing all schedule data"""
        # Add some entries
        for i in range(3):
            employee_id = i + 1
            test_date = date(2023, 3, i + 1)
            test_schedule = MagicMock()
            self.resources.add_schedule_entry(employee_id, test_date, test_schedule)

        # Verify entries exist
        self.assertEqual(len(self.resources.schedule_data), 3)

        # Clear data
        self.resources.clear_schedule_data()

        # Verify data was cleared
        self.assertEqual(len(self.resources.schedule_data), 0)

    def test_get_active_employees(self):
        """Test getting active employees"""
        # Set up test data
        self.resources.employees = self.mock_employees

        # Call method
        active_employees = self.resources.get_active_employees()

        # Verify results
        self.assertEqual(active_employees, self.mock_employees)

    def test_get_employee(self):
        """Test getting an employee by ID"""
        # Set up test data - cache some employees
        self.resources._employee_cache = {
            1: self.mock_employees[0],
            2: self.mock_employees[1],
        }

        # Test case 1: Cached employee
        employee = self.resources.get_employee(1)
        self.assertEqual(employee, self.mock_employees[0])

        # Test case 2: Employee not in cache
        employee = self.resources.get_employee(99)
        self.assertIsNone(employee)

    def test_get_employee_availabilities(self):
        """Test getting all availabilities for an employee on a specific date"""
        # Set up test data
        self.resources.availabilities = self.mock_availabilities

        # Test case 1: Employee with availabilities on date
        test_date = date(2023, 3, 6)  # Monday (weekday 0)
        availabilities = self.resources.get_employee_availabilities(1, test_date)
        self.assertEqual(len(availabilities), 1)
        self.assertEqual(availabilities[0].employee_id, 1)
        self.assertEqual(availabilities[0].day_of_week, 0)

        # Test case 2: Employee without availabilities on date
        # (All employees have availability for all days in our mock data)

    def test_get_shift(self):
        """Test getting a shift by ID"""
        # Set up test data
        self.resources.shifts = self.mock_shifts

        # Test case 1: Existing shift
        shift = self.resources.get_shift(1)
        self.assertEqual(shift, self.mock_shifts[0])

        # Test case 2: Non-existent shift
        shift = self.resources.get_shift(99)
        self.assertIsNone(shift)

        # Test case 3: Null shift ID
        shift = self.resources.get_shift(None)
        self.assertIsNone(shift)

    def test_clear_caches(self):
        """Test clearing all caches"""
        # Set up some cached data
        self.resources._employee_cache = {1: self.mock_employees[0]}
        self.resources._coverage_cache = {date(2023, 3, 6): self.mock_coverage}

        # Clear caches
        self.resources.clear_caches()

        # Verify caches were cleared
        self.assertEqual(self.resources._employee_cache, {})
        self.assertEqual(self.resources._coverage_cache, {})
        self.assertFalse(self.resources._date_caches_cleared)

    def test_is_employee_on_leave(self):
        """Test checking if an employee is on leave for a given date"""
        # Set up test data
        self.resources.absences = self.mock_absences

        # Test case 1: Employee on leave
        on_leave = self.resources.is_employee_on_leave(1, date(2023, 3, 3))
        self.assertTrue(on_leave)

        # Test case 2: Employee not on leave (outside date range)
        on_leave = self.resources.is_employee_on_leave(1, date(2023, 3, 6))
        self.assertFalse(on_leave)

        # Test case 3: Employee without absences
        on_leave = self.resources.is_employee_on_leave(3, date(2023, 3, 3))
        self.assertFalse(on_leave)


if __name__ == "__main__":
    unittest.main()
