"""
Tests for keyholder validation utilities

Tests cover:
- Single keyholder per day validation
- Paired keyholder shift validation
- Business day calculations
- Edge cases (weekends, holidays, missing data)
"""

from datetime import datetime

import pytest

from src.backend.models import db
from src.backend.models.employee import Employee
from src.backend.models.schedule import Schedule
from src.backend.models.settings import Settings
from src.backend.utils.keyholder_validator import (
    KeyholderValidationError,
    get_next_business_day,
    get_paired_shift_info,
    get_previous_business_day,
    is_closing_shift,
    is_opening_shift,
    validate_paired_keyholder_shifts,
    validate_single_keyholder_per_day,
)


@pytest.fixture
def test_settings():
    """Create test settings with standard store hours"""
    settings = Settings(
        store_name="Test Store",
        store_opening="09:00",
        store_closing="20:00",
        keyholder_before_minutes=30,
        keyholder_after_minutes=30,
        opening_days={
            "monday": True,
            "tuesday": True,
            "wednesday": True,
            "thursday": True,
            "friday": True,
            "saturday": True,
            "sunday": False,  # Closed on Sunday
        },
    )
    return settings


@pytest.fixture
def test_employee(app):
    """Create a test employee"""
    with app.app_context():
        employee = Employee(
            first_name="John",
            last_name="Doe",
            email="john@test.com",
            phone="1234567890",
            employee_group="VZ",
            contracted_hours=40,
            is_keyholder=True,
            is_active=True,
        )
        db.session.add(employee)
        db.session.commit()
        yield employee
        db.session.delete(employee)
        db.session.commit()


class TestBusinessDayCalculations:
    """Test business day calculation functions"""

    def test_next_business_day_monday_to_tuesday(self, test_settings):
        """Test next business day from Monday to Tuesday"""
        monday = datetime(2025, 11, 10)  # Monday
        next_day = get_next_business_day(monday, test_settings)
        assert next_day == datetime(2025, 11, 11)  # Tuesday

    def test_next_business_day_skip_sunday(self, test_settings):
        """Test next business day skips Sunday (closed)"""
        saturday = datetime(2025, 11, 15)  # Saturday
        next_day = get_next_business_day(saturday, test_settings)
        assert next_day == datetime(2025, 11, 17)  # Monday (skips Sunday)

    def test_previous_business_day_tuesday_to_monday(self, test_settings):
        """Test previous business day from Tuesday to Monday"""
        tuesday = datetime(2025, 11, 11)  # Tuesday
        prev_day = get_previous_business_day(tuesday, test_settings)
        assert prev_day == datetime(2025, 11, 10)  # Monday

    def test_previous_business_day_skip_sunday(self, test_settings):
        """Test previous business day skips Sunday (closed)"""
        monday = datetime(2025, 11, 17)  # Monday
        prev_day = get_previous_business_day(monday, test_settings)
        assert prev_day == datetime(2025, 11, 15)  # Saturday (skips Sunday)

    def test_next_business_day_all_days_closed(self):
        """Test next business day when all days are closed returns None"""
        settings = Settings(
            store_name="Test",
            opening_days={
                day: False
                for day in [
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday",
                ]
            },
        )
        date = datetime(2025, 11, 10)
        result = get_next_business_day(date, settings)
        assert result is None

    def test_consecutive_closed_days(self, test_settings):
        """Test skipping multiple consecutive closed days"""
        # Close both Saturday and Sunday
        test_settings.opening_days["saturday"] = False
        test_settings.opening_days["sunday"] = False

        friday = datetime(2025, 11, 14)  # Friday
        next_day = get_next_business_day(friday, test_settings)
        assert next_day == datetime(2025, 11, 17)  # Monday (skips Sat & Sun)


class TestShiftTypeDetection:
    """Test shift type detection functions"""

    def test_is_opening_shift_exact_match(self, test_settings):
        """Test opening shift detection with exact time match"""
        assert is_opening_shift("09:00", test_settings) is True

    def test_is_opening_shift_not_match(self, test_settings):
        """Test opening shift detection with different time"""
        assert is_opening_shift("10:00", test_settings) is False

    def test_is_closing_shift_exact_match(self, test_settings):
        """Test closing shift detection with exact time match"""
        assert is_closing_shift("20:00", test_settings) is True

    def test_is_closing_shift_not_match(self, test_settings):
        """Test closing shift detection with different time"""
        assert is_closing_shift("19:00", test_settings) is False


class TestSingleKeyholderValidation:
    """Test single keyholder per day validation"""

    def test_single_keyholder_opening_shift_allowed(
        self, app, test_settings, test_employee
    ):
        """Test creating first keyholder opening shift is allowed"""
        with app.app_context():
            date = datetime(2025, 11, 10)
            # Should not raise exception
            validate_single_keyholder_per_day(
                schedule_id=None,
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
                settings=test_settings,
            )

    def test_single_keyholder_closing_shift_allowed(
        self, app, test_settings, test_employee
    ):
        """Test creating first keyholder closing shift is allowed"""
        with app.app_context():
            date = datetime(2025, 11, 10)
            # Should not raise exception
            validate_single_keyholder_per_day(
                schedule_id=None,
                date=date,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
                settings=test_settings,
            )

    def test_duplicate_opening_keyholder_rejected(
        self, app, test_settings, test_employee
    ):
        """Test second keyholder opening shift on same day is rejected"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Create first opening keyholder shift
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule1)
            db.session.commit()

            # Try to create second opening keyholder shift - should fail
            with pytest.raises(KeyholderValidationError) as exc_info:
                validate_single_keyholder_per_day(
                    schedule_id=None,
                    date=date,
                    version=1,
                    shift_start="09:00",
                    shift_end="17:00",
                    is_keyholder_shift=True,
                    settings=test_settings,
                )

            assert "already a keyholder opening shift" in str(exc_info.value)

    def test_duplicate_closing_keyholder_rejected(
        self, app, test_settings, test_employee
    ):
        """Test second keyholder closing shift on same day is rejected"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Create first closing keyholder shift
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=date,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule1)
            db.session.commit()

            # Try to create second closing keyholder shift - should fail
            with pytest.raises(KeyholderValidationError) as exc_info:
                validate_single_keyholder_per_day(
                    schedule_id=None,
                    date=date,
                    version=1,
                    shift_start="13:00",
                    shift_end="20:00",
                    is_keyholder_shift=True,
                    settings=test_settings,
                )

            assert "already a keyholder closing shift" in str(exc_info.value)

    def test_opening_and_closing_keyholder_same_day_allowed(
        self, app, test_settings, test_employee
    ):
        """Test having both opening and closing keyholder same day"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Create opening keyholder shift
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule1)
            db.session.commit()

            # Create closing keyholder shift - should succeed
            validate_single_keyholder_per_day(
                schedule_id=None,
                date=date,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
                settings=test_settings,
            )

    def test_update_existing_schedule_allowed(self, app, test_settings, test_employee):
        """Test updating existing keyholder schedule no self-conflict"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Create keyholder shift
            schedule = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule)
            db.session.commit()

            # Update same schedule - should not conflict with itself
            validate_single_keyholder_per_day(
                schedule_id=schedule.id,  # Exclude this schedule
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
                settings=test_settings,
            )

    def test_non_keyholder_shift_not_validated(self, app, test_settings, test_employee):
        """Test non-keyholder shifts are not validated"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Create multiple non-keyholder shifts - should all succeed
            for i in range(3):
                validate_single_keyholder_per_day(
                    schedule_id=None,
                    date=date,
                    version=1,
                    shift_start="09:00",
                    shift_end="17:00",
                    is_keyholder_shift=False,  # Not a keyholder shift
                    settings=test_settings,
                )

    def test_middle_shift_keyholder_rejected(self, app, test_settings):
        """Test keyholder flag on non-opening/closing shift is rejected"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Try to mark a middle shift as keyholder - should fail
            with pytest.raises(KeyholderValidationError) as exc_info:
                validate_single_keyholder_per_day(
                    schedule_id=None,
                    date=date,
                    version=1,
                    shift_start="11:00",  # Not opening time
                    shift_end="19:00",  # Not closing time
                    is_keyholder_shift=True,
                    settings=test_settings,
                )

            assert "must be either opening shifts" in str(exc_info.value)

    def test_different_versions_independent(self, app, test_settings, test_employee):
        """Test keyholder validation is independent per version"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Create keyholder in version 1
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule1)
            db.session.commit()

            # Create keyholder in version 2 - should succeed
            validate_single_keyholder_per_day(
                schedule_id=None,
                date=date,
                version=2,  # Different version
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
                settings=test_settings,
            )


class TestPairedKeyholderValidation:
    """Test paired keyholder shift validation"""

    def test_closing_with_next_opening_valid(self, app, test_settings, test_employee):
        """Test closing shift with next-day opening shift is valid"""
        with app.app_context():
            monday = datetime(2025, 11, 10)
            tuesday = datetime(2025, 11, 11)

            # Create closing shift on Monday
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule1)

            # Create opening shift on Tuesday
            schedule2 = Schedule(
                employee_id=test_employee.id,
                shift_id=2,
                date=tuesday,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule2)
            db.session.commit()

            # Validate closing shift - should find paired opening
            result = validate_paired_keyholder_shifts(
                schedule_id=schedule1.id,
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
                settings=test_settings,
                strict=False,
            )

            assert result["valid"] is True
            assert len(result["warnings"]) == 0
            assert result["paired_shift"] is not None

    def test_closing_without_next_opening_warning(
        self, app, test_settings, test_employee
    ):
        """Test closing shift without next-day opening generates warning"""
        with app.app_context():
            monday = datetime(2025, 11, 10)

            # Create only closing shift
            schedule = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule)
            db.session.commit()

            # Validate - should generate warning
            result = validate_paired_keyholder_shifts(
                schedule_id=schedule.id,
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
                settings=test_settings,
                strict=False,
            )

            assert result["valid"] is False
            assert len(result["warnings"]) > 0
            assert "requires an opening keyholder shift" in result["warnings"][0]

    def test_closing_without_next_opening_strict_error(
        self, app, test_settings, test_employee
    ):
        """Test closing shift without next opening strict mode error"""
        with app.app_context():
            monday = datetime(2025, 11, 10)

            # Validate in strict mode - should raise error
            with pytest.raises(KeyholderValidationError) as exc_info:
                validate_paired_keyholder_shifts(
                    schedule_id=None,
                    date=monday,
                    version=1,
                    shift_start="13:00",
                    shift_end="20:00",
                    is_keyholder_shift=True,
                    settings=test_settings,
                    strict=True,  # Strict mode
                )

            assert "requires an opening keyholder shift" in str(exc_info.value)

    def test_opening_with_previous_closing_valid(
        self, app, test_settings, test_employee
    ):
        """Test opening shift with previous-day closing shift is valid"""
        with app.app_context():
            monday = datetime(2025, 11, 10)
            tuesday = datetime(2025, 11, 11)

            # Create closing shift on Monday
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule1)

            # Create opening shift on Tuesday
            schedule2 = Schedule(
                employee_id=test_employee.id,
                shift_id=2,
                date=tuesday,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule2)
            db.session.commit()

            # Validate opening shift - should find paired closing
            result = validate_paired_keyholder_shifts(
                schedule_id=schedule2.id,
                date=tuesday,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
                settings=test_settings,
                strict=False,
            )

            assert result["valid"] is True
            assert result["paired_shift"] is not None

    def test_pairing_skips_closed_days(self, app, test_settings, test_employee):
        """Test paired shift validation skips closed days (Sunday)"""
        with app.app_context():
            saturday = datetime(2025, 11, 15)  # Saturday
            monday = datetime(2025, 11, 17)  # Monday (Sunday closed)

            # Create closing shift on Saturday
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=saturday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule1)

            # Create opening shift on Monday (skipping Sunday)
            schedule2 = Schedule(
                employee_id=test_employee.id,
                shift_id=2,
                date=monday,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule2)
            db.session.commit()

            # Validate Saturday closing - should find Monday opening
            result = validate_paired_keyholder_shifts(
                schedule_id=schedule1.id,
                date=saturday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
                settings=test_settings,
                strict=False,
            )

            assert result["valid"] is True
            assert result["paired_shift"] is not None


class TestGetPairedShiftInfo:
    """Test paired shift info retrieval for preview"""

    def test_get_paired_opening_info(self, app, test_settings, test_employee):
        """Test getting paired opening shift info for closing shift"""
        with app.app_context():
            monday = datetime(2025, 11, 10)
            tuesday = datetime(2025, 11, 11)

            # Create closing and opening shifts
            schedule1 = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
            )
            schedule2 = Schedule(
                employee_id=test_employee.id,
                shift_id=2,
                date=tuesday,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
            )
            db.session.add_all([schedule1, schedule2])
            db.session.commit()

            # Get paired info for closing shift
            info = get_paired_shift_info(
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                settings=test_settings,
            )

            assert info is not None
            assert info["shift_type"] == "opening"
            assert info["date"] == "2025-11-11"
            assert info["employee_name"] == "John Doe"
            assert info.get("missing") is None

    def test_get_paired_missing_info(self, app, test_settings, test_employee):
        """Test getting paired shift info when paired shift is missing"""
        with app.app_context():
            monday = datetime(2025, 11, 10)

            # Create only closing shift
            schedule = Schedule(
                employee_id=test_employee.id,
                shift_id=1,
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                is_keyholder_shift=True,
            )
            db.session.add(schedule)
            db.session.commit()

            # Get paired info - should indicate missing
            info = get_paired_shift_info(
                date=monday,
                version=1,
                shift_start="13:00",
                shift_end="20:00",
                settings=test_settings,
            )

            assert info is not None
            assert info["shift_type"] == "opening"
            assert info["date"] == "2025-11-11"
            assert info["missing"] is True

    def test_get_paired_info_non_keyholder_shift(self, app, test_settings):
        """Test getting paired info for non-keyholder shift returns None"""
        with app.app_context():
            monday = datetime(2025, 11, 10)

            # Get paired info for middle shift (not opening/closing)
            info = get_paired_shift_info(
                date=monday,
                version=1,
                shift_start="11:00",  # Not opening
                shift_end="19:00",  # Not closing
                settings=test_settings,
            )

            assert info is None


class TestEdgeCases:
    """Test edge cases and error conditions"""

    def test_validation_with_no_opening_days(self, app):
        """Test validation when no days are open"""
        settings = Settings(
            store_name="Test",
            store_opening="09:00",
            store_closing="20:00",
            opening_days={
                day: False
                for day in [
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday",
                ]
            },
        )

        with app.app_context():
            date = datetime(2025, 11, 10)

            # Validation should still work for single day
            validate_single_keyholder_per_day(
                schedule_id=None,
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="20:00",
                is_keyholder_shift=True,
                settings=settings,
            )

    def test_validation_with_all_days_open(self, test_settings):
        """Test validation when all days including Sunday are open"""
        test_settings.opening_days["sunday"] = True

        saturday = datetime(2025, 11, 15)
        sunday = datetime(2025, 11, 16)

        # Should find Sunday as next day
        next_day = get_next_business_day(saturday, test_settings)
        assert next_day == sunday

    def test_year_boundary_next_day(self, test_settings):
        """Test next business day across year boundary"""
        dec_31 = datetime(2025, 12, 31)  # Wednesday
        next_day = get_next_business_day(dec_31, test_settings)
        assert next_day == datetime(2026, 1, 1)  # Thursday

    def test_year_boundary_previous_day(self, test_settings):
        """Test previous business day across year boundary"""
        jan_1 = datetime(2026, 1, 1)  # Thursday
        prev_day = get_previous_business_day(jan_1, test_settings)
        assert prev_day == datetime(2025, 12, 31)  # Wednesday

    def test_validation_with_datetime_object(self, app, test_settings, test_employee):
        """Test validation accepts datetime objects"""
        with app.app_context():
            date = datetime(2025, 11, 10, 14, 30)  # With time component

            # Should handle datetime with time component
            validate_single_keyholder_per_day(
                schedule_id=None,
                date=date,
                version=1,
                shift_start="09:00",
                shift_end="17:00",
                is_keyholder_shift=True,
                settings=test_settings,
            )

    def test_multiple_versions_same_date(self, app, test_settings, test_employee):
        """Test multiple schedule versions on same date are independent"""
        with app.app_context():
            date = datetime(2025, 11, 10)

            # Create keyholders in versions 1, 2, and 3
            for version in [1, 2, 3]:
                schedule = Schedule(
                    employee_id=test_employee.id,
                    shift_id=version,
                    date=date,
                    version=version,
                    shift_start="09:00",
                    shift_end="17:00",
                    is_keyholder_shift=True,
                )
                db.session.add(schedule)
            db.session.commit()

            # Each version should be valid independently
            for version in [1, 2, 3]:
                schedules = Schedule.query.filter_by(
                    date=date, version=version, is_keyholder_shift=True
                ).all()
                assert len(schedules) == 1
