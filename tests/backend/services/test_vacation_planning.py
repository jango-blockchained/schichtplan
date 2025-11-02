"""Tests for vacation planning service.

Tests the VacationPlanningService with various scenarios involving
store opening days, special days, and vacation period validation.
"""

from datetime import date
from unittest.mock import MagicMock

import pytest

from src.backend.services.vacation_planning import VacationPlanningService


class TestVacationPlanningService:
    """Test cases for VacationPlanningService."""

    @pytest.fixture
    def mock_settings(self):
        """Create mock settings with predefined special days."""
        settings = MagicMock()

        # Set opening days (Monday-Friday, closed Saturday-Sunday)
        settings.opening_days = {
            "0": True,  # Monday
            "1": True,  # Tuesday
            "2": True,  # Wednesday
            "3": True,  # Thursday
            "4": True,  # Friday
            "5": False,  # Saturday
            "6": False,  # Sunday
        }

        # Add special days (Christmas and Boxing Day)
        settings.special_days = {
            "2024-12-25": {
                "name": "Weihnachtstag",
                "is_closed": True,
                "is_holiday": True,
            },
            "2024-12-26": {
                "name": "2. Weihnachtstag",
                "is_closed": True,
                "is_holiday": True,
            },
            "2024-12-31": {
                "name": "Silvester",
                "is_closed": False,
                "custom_hours": {"opening": "09:00", "closing": "16:00"},
            },
        }

        settings.store_opening = "09:00"
        settings.store_closing = "20:00"

        return settings

    @pytest.fixture
    def service(self, mock_settings):
        """Create vacation planning service with mock settings."""
        return VacationPlanningService(mock_settings)

    def test_is_store_open_on_regular_weekday(self, service):
        """Test store open check for regular weekday."""
        # Monday, Dec 23, 2024 (regular weekday)
        assert service.is_store_open_on_date(date(2024, 12, 23)) is True

    def test_is_store_closed_on_weekend(self, service):
        """Test store closed check for weekend."""
        # Saturday, Dec 21, 2024
        assert service.is_store_open_on_date(date(2024, 12, 21)) is False
        # Sunday, Dec 22, 2024
        assert service.is_store_open_on_date(date(2024, 12, 22)) is False

    def test_is_store_closed_on_special_holiday(self, service):
        """Test store closed check for special holiday."""
        # Christmas Day (marked as closed in special_days)
        assert service.is_store_open_on_date(date(2024, 12, 25)) is False

    def test_is_store_open_with_custom_hours(self, service):
        """Test store open check for day with custom hours."""
        # New Year's Eve (custom hours)
        assert service.is_store_open_on_date(date(2024, 12, 31)) is True

    def test_get_store_hours_regular_day(self, service):
        """Test getting hours for regular day."""
        opening, closing = service.get_store_hours(date(2024, 12, 23))
        assert opening == "09:00"
        assert closing == "20:00"

    def test_get_store_hours_custom_hours(self, service):
        """Test getting hours for day with custom hours."""
        opening, closing = service.get_store_hours(date(2024, 12, 31))
        assert opening == "09:00"
        assert closing == "16:00"

    def test_get_working_days_in_week(self, service):
        """Test counting working days in a week."""
        # Dec 23-27, 2024 (Mon-Fri, but 25-26 are Christmas holidays)
        working_days = service.get_working_days_in_range(
            date(2024, 12, 23),
            date(2024, 12, 27),
        )
        # Mon, Tue, Fri only (Wed-Thu are closed)
        assert len(working_days) == 3

    def test_get_working_days_across_weekend(self, service):
        """Test counting working days across weekend."""
        # Dec 23-29, 2024 (Mon-Sun, with 25-26 closed)
        working_days = service.get_working_days_in_range(
            date(2024, 12, 23),
            date(2024, 12, 29),
        )
        # Mon, Tue, Fri only (25-26 closed + 28-29 weekend)
        assert len(working_days) == 3

    def test_get_working_days_with_holiday(self, service):
        """Test counting working days with holiday."""
        # Dec 23-27, 2024 - includes Christmas (Dec 25-26)
        working_days = service.get_working_days_in_range(
            date(2024, 12, 23),
            date(2024, 12, 27),
        )
        # Mon, Tue, Fri only (Wed-Thu are closed)
        assert len(working_days) == 3
        assert date(2024, 12, 25) not in working_days

    def test_get_closed_days_in_range(self, service):
        """Test getting closed days list."""
        closed_days = service.get_closed_days_in_range(
            date(2024, 12, 21),
            date(2024, 12, 29),
        )

        # Should include Sat-Sun (21-22, 28-29) and holidays (25-26)
        assert len(closed_days) == 6

        # Check specific closed days
        assert "2024-12-21" in closed_days  # Saturday
        assert "2024-12-22" in closed_days  # Sunday
        assert "2024-12-25" in closed_days  # Christmas
        assert "2024-12-26" in closed_days  # Boxing Day
        assert "2024-12-28" in closed_days  # Saturday
        assert "2024-12-29" in closed_days  # Sunday

    def test_validate_vacation_all_working_days(self, service):
        """Test validation for vacation on all working days."""
        analysis = service.validate_vacation_dates(
            date(2024, 12, 23),
            date(2024, 12, 24),
        )

        assert analysis["is_valid"] is True
        assert analysis["working_days"] == 2
        assert analysis["closed_days"] == 0
        assert analysis["total_days"] == 2
        assert len(analysis["warnings"]) == 0

    def test_validate_vacation_with_weekend(self, service):
        """Test validation for vacation including weekend."""
        analysis = service.validate_vacation_dates(
            date(2024, 12, 20),
            date(2024, 12, 22),
        )

        assert analysis["is_valid"] is True
        assert analysis["working_days"] == 1
        assert analysis["closed_days"] == 2
        assert analysis["total_days"] == 3
        assert len(analysis["warnings"]) > 0
        assert "non-working day" in analysis["warnings"][0].lower()

    def test_validate_vacation_with_holiday(self, service):
        """Test validation for vacation including special holiday."""
        analysis = service.validate_vacation_dates(
            date(2024, 12, 23),
            date(2024, 12, 27),
        )

        assert analysis["is_valid"] is True
        assert analysis["working_days"] == 3
        assert analysis["closed_days"] == 2  # Christmas + Boxing Day
        assert analysis["total_days"] == 5

    def test_validate_vacation_all_closed(self, service):
        """Test validation for vacation on all closed days."""
        analysis = service.validate_vacation_dates(
            date(2024, 12, 21),
            date(2024, 12, 22),
        )

        assert analysis["is_valid"] is True
        assert analysis["working_days"] == 0
        assert analysis["closed_days"] == 2
        assert analysis["total_days"] == 2
        assert len(analysis["warnings"]) > 0

    def test_validate_vacation_invalid_dates(self, service):
        """Test validation with invalid date range."""
        analysis = service.validate_vacation_dates(
            date(2024, 12, 27),
            date(2024, 12, 23),
        )

        assert analysis["is_valid"] is False
        assert "error" in analysis

    def test_get_vacation_summary_for_period(self, service):
        """Test getting period summary."""
        summary = service.get_vacation_summary_for_period(
            date(2024, 12, 23),
            date(2024, 12, 27),
        )

        assert summary["total_days"] == 5
        assert summary["working_days_count"] == 3
        assert summary["closed_days_count"] == 2
        assert len(summary["working_days"]) == 3
        assert len(summary["closed_days"]) == 2

    def test_count_working_days(self, service):
        """Test simple working day count."""
        count = service.count_working_days(
            date(2024, 12, 23),
            date(2024, 12, 27),
        )

        assert count == 3

    def test_closed_day_details(self, service):
        """Test that closed day details are complete."""
        closed_days = service.get_closed_days_in_range(
            date(2024, 12, 25),
            date(2024, 12, 26),
        )

        # Check Christmas details
        xmas = closed_days.get("2024-12-25", {})
        assert xmas["reason"] == "special_day"
        assert xmas["type"] == "closed"
        assert "weihnacht" in xmas["description"].lower()

        # Check Boxing Day details
        boxing = closed_days.get("2024-12-26", {})
        assert boxing["reason"] == "special_day"
        assert boxing["type"] == "closed"

    def test_closed_day_with_custom_hours(self, service):
        """Test closed day entry with custom hours."""
        closed_days = service.get_closed_days_in_range(
            date(2024, 12, 31),
            date(2024, 12, 31),
        )

        # New Year's Eve should be in closed_days with custom_hours type
        assert "2024-12-31" in closed_days
        nye = closed_days["2024-12-31"]
        assert nye["type"] == "custom_hours"
        assert nye["custom_hours"] == ("09:00", "16:00")
