import unittest
from unittest.mock import MagicMock, PropertyMock
from datetime import date, time
import pytest

# Assuming the utility function is in src.backend.services.scheduler.coverage_utils
# Adjust the import path if necessary based on your project structure and how you run tests.
from src.backend.services.scheduler.coverage_utils import get_required_staffing_for_interval, _time_str_to_datetime_time
from src.backend.services.scheduler.resources import ScheduleResources # For mocking
from src.backend.models import ShiftTemplate # Changed this line
from src.backend.models import Coverage # Assuming Coverage is also directly available from models

# Mocking a basic Coverage object structure
class MockCoverage:
    def __init__(self, id, day_index, start_time_str, end_time_str, min_employees, employee_types=None, requires_keyholder=False):
        self.id = id
        self.day_index = day_index  # 0=Monday, 6=Sunday
        self.start_time = start_time_str # "HH:MM"
        self.end_time = end_time_str   # "HH:MM"
        self.min_employees = min_employees
        self.employee_types = employee_types if employee_types is not None else [] # List of strings
        self.requires_keyholder = requires_keyholder

class TestGetRequiredStaffingForInterval(unittest.TestCase):

    def setUp(self):
        self.mock_resources = MagicMock(spec=ScheduleResources)
        # Default interval duration for tests, assuming the function might use it from resources or config
        # If get_required_staffing_for_interval takes interval_duration_minutes directly, this mock might not be needed for duration
        type(self.mock_resources.config).interval_duration_minutes = PropertyMock(return_value=60)


    def test_simple_coverage_match(self):
        # Monday, 09:00-17:00, 2 employees, Type A
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="09:00", end_time_str="17:00", min_employees=2, employee_types=["TypeA"])
        self.mock_resources.coverage = [coverage1]

        test_date = date(2023, 10, 23) # A Monday
        interval_start = time(10, 0) # 10:00

        # Call with interval_duration_minutes explicitly if the function signature demands it.
        # For now, assuming it might get it from resources.config or has a default.
        needs = get_required_staffing_for_interval(test_date, interval_start, self.mock_resources)

        self.assertEqual(needs['min_employees'], 2)
        self.assertIn("TypeA", needs['employee_types'])
        self.assertFalse(needs['requires_keyholder'])

    def test_no_coverage_match_time(self):
        # Monday, 09:00-12:00, 2 employees
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="09:00", end_time_str="12:00", min_employees=2)
        self.mock_resources.coverage = [coverage1]

        test_date = date(2023, 10, 23) # A Monday
        interval_start = time(14, 0) # 14:00 - outside coverage time

        needs = get_required_staffing_for_interval(test_date, interval_start, self.mock_resources)

        self.assertEqual(needs['min_employees'], 0)
        self.assertEqual(len(needs['employee_types']), 0)
        self.assertFalse(needs['requires_keyholder'])

    def test_no_coverage_match_day(self):
        # Monday, 09:00-17:00, 2 employees
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="09:00", end_time_str="17:00", min_employees=2)
        self.mock_resources.coverage = [coverage1]

        test_date = date(2023, 10, 24) # A Tuesday
        interval_start = time(10, 0) # 10:00

        needs = get_required_staffing_for_interval(test_date, interval_start, self.mock_resources)

        self.assertEqual(needs['min_employees'], 0)

    def test_overlapping_coverage_max_employees_and_combine_types_keyholder(self):
        # Monday, 09:00-12:00, 2 employees, Type A, No Keyholder
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="09:00", end_time_str="12:00", min_employees=2, employee_types=["TypeA"], requires_keyholder=False)
        # Monday, 10:00-13:00, 3 employees, Type B, Keyholder Required
        coverage2 = MockCoverage(id=2, day_index=0, start_time_str="10:00", end_time_str="13:00", min_employees=3, employee_types=["TypeB"], requires_keyholder=True)
        # Monday, 09:30-10:30, 1 employee, Type C
        coverage3 = MockCoverage(id=3, day_index=0, start_time_str="09:30", end_time_str="10:30", min_employees=1, employee_types=["TypeC"])
        
        self.mock_resources.coverage = [coverage1, coverage2, coverage3]

        test_date = date(2023, 10, 23) # A Monday
        # Interval 10:00-11:00 is covered by coverage1 and coverage2 and coverage3
        interval_start = time(10, 0) 

        needs = get_required_staffing_for_interval(test_date, interval_start, self.mock_resources, interval_duration_minutes=60)

        self.assertEqual(needs['min_employees'], 3, "Should take max of min_employees from overlapping coverages")
        self.assertIn("TypeA", needs['employee_types'], "Should combine employee types")
        self.assertIn("TypeB", needs['employee_types'], "Should combine employee types")
        self.assertIn("TypeC", needs['employee_types'], "Should combine employee types")
        self.assertEqual(len(needs['employee_types']), 3, "Should have 3 unique types")
        self.assertTrue(needs['requires_keyholder'], "Should be True if any overlapping coverage requires keyholder")

    def test_partial_overlap_start_of_coverage(self):
        # Coverage: 10:00-12:00, 1 emp
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="10:00", end_time_str="12:00", min_employees=1)
        self.mock_resources.coverage = [coverage1]
        test_date = date(2023, 10, 23) # Monday

        # Interval 09:30-10:30, using 60 min duration. The interval starts at 09:30.
        # The coverage starts at 10:00.
        # So, the interval 09:30 is NOT covered by this coverage record.
        interval_start = time(9, 30)
        needs = get_required_staffing_for_interval(test_date, interval_start, self.mock_resources, interval_duration_minutes=60)
        self.assertEqual(needs['min_employees'], 0, "Interval starts before coverage, should not match")

        # Interval 10:00-11:00. This interval IS covered.
        interval_start_covered = time(10,0)
        needs_covered = get_required_staffing_for_interval(test_date, interval_start_covered, self.mock_resources, interval_duration_minutes=60)
        self.assertEqual(needs_covered['min_employees'], 1, "Interval starts at coverage start, should match")


    def test_partial_overlap_end_of_coverage(self):
        # Coverage: 10:00-12:00, 1 emp
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="10:00", end_time_str="12:00", min_employees=1)
        self.mock_resources.coverage = [coverage1]
        test_date = date(2023, 10, 23) # Monday

        # Interval 11:30-12:30, using 60 min duration. Interval starts at 11:30.
        # Coverage ends at 12:00.
        # So the interval 11:30 IS covered.
        interval_start = time(11, 30)
        needs = get_required_staffing_for_interval(test_date, interval_start, self.mock_resources, interval_duration_minutes=60)
        self.assertEqual(needs['min_employees'], 1, "Interval ends after coverage start but before/at coverage end, should match")

        # Interval 12:00-13:00. This interval is NOT covered because coverage ends at 12:00 (exclusive for interval start).
        interval_start_not_covered = time(12,0)
        needs_not_covered = get_required_staffing_for_interval(test_date, interval_start_not_covered, self.mock_resources, interval_duration_minutes=60)
        self.assertEqual(needs_not_covered['min_employees'], 0, "Interval starts at coverage end, should not match")

    def test_coverage_boundary_conditions_exact_match(self):
        # Coverage: 10:00-11:00, 1 emp
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="10:00", end_time_str="11:00", min_employees=1)
        self.mock_resources.coverage = [coverage1]
        test_date = date(2023, 10, 23) # Monday
        
        # Interval 10:00-11:00 (assuming 60 min duration passed or default)
        interval_start = time(10, 0)
        needs = get_required_staffing_for_interval(test_date, interval_start, self.mock_resources, interval_duration_minutes=60)
        self.assertEqual(needs['min_employees'], 1)

    def test_coverage_just_outside_boundaries(self):
        # Coverage: 10:00-11:00, 1 emp
        coverage1 = MockCoverage(id=1, day_index=0, start_time_str="10:00", end_time_str="11:00", min_employees=1)
        self.mock_resources.coverage = [coverage1]
        test_date = date(2023, 10, 23) # Monday

        # Interval 09:00-10:00
        interval_start_before = time(9, 0)
        needs_before = get_required_staffing_for_interval(test_date, interval_start_before, self.mock_resources, interval_duration_minutes=60)
        self.assertEqual(needs_before['min_employees'], 0)
        
        # Interval 11:00-12:00
        interval_start_after = time(11, 0)
        needs_after = get_required_staffing_for_interval(test_date, interval_start_after, self.mock_resources, interval_duration_minutes=60)
        self.assertEqual(needs_after['min_employees'], 0)

    def test_time_str_to_datetime_time(self):
        self.assertEqual(_time_str_to_datetime_time("09:30"), time(9, 30))
        self.assertEqual(_time_str_to_datetime_time("00:00"), time(0, 0))
        self.assertEqual(_time_str_to_datetime_time("23:59"), time(23, 59))
        with self.assertRaises(ValueError):
            _time_str_to_datetime_time("24:00") # Invalid hour
        with self.assertRaises(ValueError):
            _time_str_to_datetime_time("09:60") # Invalid minute
        with self.assertRaises(ValueError):
            _time_str_to_datetime_time("9:30") # Needs leading zero for hour
        with self.assertRaises(AttributeError): # Or TypeError depending on handling of None
             _time_str_to_datetime_time(None)
        self.assertIsNone(_time_str_to_datetime_time("", suppress_error=True))
        self.assertIsNone(_time_str_to_datetime_time("invalid", suppress_error=True))


if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False) 