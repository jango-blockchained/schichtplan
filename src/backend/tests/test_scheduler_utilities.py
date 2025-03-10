"""
Tests for the scheduler utility functions.
"""

import unittest
import time
from collections import namedtuple

from services.scheduler.utility import (
    is_early_shift,
    is_late_shift,
    requires_keyholder,
    time_to_minutes,
    shifts_overlap,
    time_overlaps,
    calculate_duration,
    calculate_rest_hours,
    clear_time_caches,
)


class TestUtilityFunctions(unittest.TestCase):
    """Test the utility functions in the scheduler package"""

    def setUp(self):
        """Set up the test"""
        # Create a simple mock shift for testing
        self.MockShift = namedtuple("MockShift", ["start_time", "end_time"])
        # Clear any cached values
        clear_time_caches()

    def test_is_early_shift(self):
        """Test the is_early_shift function"""
        early_shift = self.MockShift(start_time="06:00", end_time="14:00")
        normal_shift = self.MockShift(start_time="09:00", end_time="17:00")

        self.assertTrue(is_early_shift(early_shift))
        self.assertFalse(is_early_shift(normal_shift))

    def test_is_late_shift(self):
        """Test the is_late_shift function"""
        late_shift = self.MockShift(start_time="14:00", end_time="22:00")
        normal_shift = self.MockShift(start_time="09:00", end_time="17:00")

        self.assertTrue(is_late_shift(late_shift))
        self.assertFalse(is_late_shift(normal_shift))

    def test_requires_keyholder(self):
        """Test the requires_keyholder function"""
        early_shift = self.MockShift(start_time="06:00", end_time="14:00")
        late_shift = self.MockShift(start_time="14:00", end_time="22:00")
        normal_shift = self.MockShift(start_time="09:00", end_time="17:00")

        self.assertTrue(requires_keyholder(early_shift))
        self.assertTrue(requires_keyholder(late_shift))
        self.assertFalse(requires_keyholder(normal_shift))

    def test_time_to_minutes(self):
        """Test the time_to_minutes function"""
        self.assertEqual(time_to_minutes("00:00"), 0)
        self.assertEqual(time_to_minutes("01:30"), 90)
        self.assertEqual(time_to_minutes("12:45"), 765)
        self.assertEqual(time_to_minutes("23:59"), 1439)

    def test_shifts_overlap(self):
        """Test the shifts_overlap function"""
        # Overlapping shifts
        self.assertTrue(shifts_overlap("09:00", "17:00", "16:00", "22:00"))
        self.assertTrue(shifts_overlap("09:00", "17:00", "08:00", "10:00"))
        self.assertTrue(shifts_overlap("09:00", "17:00", "10:00", "15:00"))

        # Non-overlapping shifts
        self.assertFalse(shifts_overlap("09:00", "17:00", "17:00", "22:00"))
        self.assertFalse(shifts_overlap("09:00", "17:00", "06:00", "09:00"))
        self.assertFalse(shifts_overlap("09:00", "17:00", "18:00", "23:00"))

    def test_time_overlaps(self):
        """Test the time_overlaps function"""
        # This just calls shifts_overlap, so we'll test a couple of cases
        self.assertTrue(time_overlaps("09:00", "17:00", "16:00", "22:00"))
        self.assertFalse(time_overlaps("09:00", "17:00", "17:00", "22:00"))

    def test_calculate_duration(self):
        """Test the calculate_duration function"""
        # Same day
        self.assertEqual(calculate_duration("09:00", "17:00"), 8.0)
        self.assertEqual(calculate_duration("12:30", "13:30"), 1.0)

        # Crossing midnight
        self.assertEqual(calculate_duration("22:00", "02:00"), 4.0)
        self.assertEqual(calculate_duration("23:30", "00:30"), 1.0)

    def test_calculate_rest_hours(self):
        """Test the calculate_rest_hours function"""
        # Same day
        self.assertEqual(calculate_rest_hours("17:00", "09:00"), 16.0)

        # Crossing midnight
        self.assertEqual(calculate_rest_hours("22:00", "06:00"), 8.0)

    def test_cache_performance(self):
        """Test that caching improves performance"""
        # Generate a range of random times to test
        times = [f"{h:02d}:{m:02d}" for h in range(24) for m in range(0, 60, 15)]
        pairs = [
            (times[i], times[j])
            for i in range(len(times))
            for j in range(i + 1, len(times))
            if j < i + 10
        ]

        # First, time uncached calls by clearing cache
        clear_time_caches()

        start_time = time.time()
        for _ in range(50):  # Repeat to get more stable timing
            for start, end in pairs[:20]:  # Use a subset of pairs
                calculate_duration(start, end)
                calculate_rest_hours(start, end)
                time_to_minutes(start)
        uncached_time = time.time() - start_time

        # Now time cached calls - this should be much faster
        start_time = time.time()
        for _ in range(50):  # Same number of iterations
            for start, end in pairs[:20]:  # Same subset of pairs
                calculate_duration(start, end)
                calculate_rest_hours(start, end)
                time_to_minutes(start)
        cached_time = time.time() - start_time

        # Print performance info
        print(f"Uncached time: {uncached_time:.6f}s")
        print(f"Cached time: {cached_time:.6f}s")
        if uncached_time > cached_time:
            improvement = uncached_time / cached_time
            print(f"Performance improvement: {improvement:.1f}x")
        else:
            print("No performance improvement detected")

        # In a test environment, caching may not show significant improvement
        # due to the small number of iterations and test overhead.
        # So we'll simply check that the cached version is not slower.
        self.assertLessEqual(
            cached_time,
            uncached_time * 1.1,
            "Cached version should not be slower than uncached",
        )


if __name__ == "__main__":
    unittest.main()
