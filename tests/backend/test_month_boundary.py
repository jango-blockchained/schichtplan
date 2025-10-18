"""
Tests for month boundary functionality in the weekly border feature.

These tests verify that weeks spanning multiple months are handled correctly
when using the SPLIT_ON_MONTH mode.
"""

import unittest

from src.backend.utils.week_utils import (
    MonthBoundaryMode,
    get_week_from_identifier,
    get_week_segments,
    handle_month_boundary,
)


class TestMonthBoundary(unittest.TestCase):
    """Test month boundary splitting functionality."""

    def test_regular_week_no_split(self):
        """Test that regular weeks within a single month are not split."""
        # Week 20, 2024 (May 13-19, 2024 - entirely in May)
        week_info = get_week_from_identifier("2024-W20")

        # Should not span months
        self.assertFalse(week_info.spans_months)

        # Should return single period even in split mode
        periods = handle_month_boundary(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
        self.assertEqual(len(periods), 1)
        self.assertEqual(periods[0], (week_info.start_date, week_info.end_date))

        # Should return single segment
        segments = get_week_segments(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].segment_number, 1)
        self.assertEqual(segments[0].total_segments, 1)
        self.assertTrue(segments[0].is_first_segment)
        self.assertTrue(segments[0].is_last_segment)

    def test_december_january_boundary(self):
        """Test week spanning December/January boundary (year boundary)."""
        # Week 1, 2025 (December 30, 2024 - January 5, 2025)
        week_info = get_week_from_identifier("2025-W01")

        # Should span months (December 2024 and January 2025)
        self.assertTrue(week_info.spans_months)
        self.assertIn("December", week_info.months)
        self.assertIn("January", week_info.months)

        # Should be split into two periods in split mode
        periods = handle_month_boundary(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
        self.assertEqual(len(periods), 2)

        # First period: December 30-31, 2024
        dec_start, dec_end = periods[0]
        self.assertEqual(dec_start.year, 2024)
        self.assertEqual(dec_start.month, 12)
        self.assertEqual(dec_end.year, 2024)
        self.assertEqual(dec_end.month, 12)
        self.assertEqual(dec_end.day, 31)  # Last day of December

        # Second period: January 1-5, 2025
        jan_start, jan_end = periods[1]
        self.assertEqual(jan_start.year, 2025)
        self.assertEqual(jan_start.month, 1)
        self.assertEqual(jan_start.day, 1)  # First day of January
        self.assertEqual(jan_end.year, 2025)
        self.assertEqual(jan_end.month, 1)

        # Test segments
        segments = get_week_segments(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
        self.assertEqual(len(segments), 2)

        # First segment (December part)
        dec_segment = segments[0]
        self.assertEqual(dec_segment.segment_number, 1)
        self.assertEqual(dec_segment.total_segments, 2)
        self.assertTrue(dec_segment.is_first_segment)
        self.assertFalse(dec_segment.is_last_segment)
        self.assertEqual(dec_segment.month, "December")
        self.assertEqual(dec_segment.year, 2024)
        self.assertEqual(dec_segment.segment_id, "2025-W01-S1")

        # Second segment (January part)
        jan_segment = segments[1]
        self.assertEqual(jan_segment.segment_number, 2)
        self.assertEqual(jan_segment.total_segments, 2)
        self.assertFalse(jan_segment.is_first_segment)
        self.assertTrue(jan_segment.is_last_segment)
        self.assertEqual(jan_segment.month, "January")
        self.assertEqual(jan_segment.year, 2025)
        self.assertEqual(jan_segment.segment_id, "2025-W01-S2")

    def test_february_march_boundary_leap_year(self):
        """Test February/March boundary in a leap year."""
        # Week 9, 2024 (February 26 - March 3, 2024) - 2024 is a leap year
        week_info = get_week_from_identifier("2024-W09")

        # Should span months
        self.assertTrue(week_info.spans_months)
        self.assertIn("February", week_info.months)
        self.assertIn("March", week_info.months)

        periods = handle_month_boundary(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
        self.assertEqual(len(periods), 2)

        # First period: February part (should end on Feb 29 in leap year)
        feb_start, feb_end = periods[0]
        self.assertEqual(feb_end.month, 2)
        self.assertEqual(feb_end.day, 29)  # Leap year has 29 days in February

        # Second period: March part
        mar_start, mar_end = periods[1]
        self.assertEqual(mar_start.month, 3)
        self.assertEqual(mar_start.day, 1)

    def test_february_march_boundary_regular_year(self):
        """Test February/March boundary in a regular (non-leap) year."""
        # Week 9, 2023 (February 27 - March 5, 2023) - 2023 is not a leap year
        week_info = get_week_from_identifier("2023-W09")

        # Should span months
        self.assertTrue(week_info.spans_months)

        periods = handle_month_boundary(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
        self.assertEqual(len(periods), 2)

        # First period: February part (should end on Feb 28 in regular year)
        feb_start, feb_end = periods[0]
        self.assertEqual(feb_end.month, 2)
        self.assertEqual(feb_end.day, 28)  # Regular year has 28 days in February

    def test_keep_intact_mode(self):
        """Test that KEEP_INTACT mode never splits weeks."""
        # Test with a week that spans months
        week_info = get_week_from_identifier("2025-W01")
        self.assertTrue(week_info.spans_months)

        # Should not be split in KEEP_INTACT mode
        periods = handle_month_boundary(week_info, MonthBoundaryMode.KEEP_INTACT)
        self.assertEqual(len(periods), 1)
        self.assertEqual(periods[0], (week_info.start_date, week_info.end_date))

        segments = get_week_segments(week_info, MonthBoundaryMode.KEEP_INTACT)
        self.assertEqual(len(segments), 1)
        self.assertEqual(segments[0].segment_id, week_info.identifier)

    def test_three_way_split_edge_case(self):
        """Test edge case where a week might theoretically span three months."""
        # This is highly unlikely with ISO weeks, but we should handle it gracefully
        # For now, just ensure our code doesn't break with unusual date ranges

        # Week 53 in some years might have interesting behavior
        week_info = get_week_from_identifier(
            "2020-W53"
        )  # December 28, 2020 - January 3, 2021

        periods = handle_month_boundary(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
        # Should be split into exactly 2 periods (December and January)
        self.assertEqual(len(periods), 2)

        # Verify no gaps or overlaps
        for i in range(len(periods) - 1):
            current_end = periods[i][1]
            next_start = periods[i + 1][0]
            # Next period should start immediately after current period ends
            self.assertEqual(
                (next_start - current_end).days,
                1,
                "Periods should be consecutive with no gaps",
            )


if __name__ == "__main__":
    unittest.main()
