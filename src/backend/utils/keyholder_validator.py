"""
Keyholder Validation Utilities

Validates that keyholder shift assignments follow business rules:
1. Only one keyholder closing shift per day
2. Only one keyholder opening shift per day
3. Closing keyholder must have opening keyholder on next business day
4. Opening keyholder should have closing keyholder on previous business day
"""

from datetime import datetime, timedelta

from sqlalchemy import and_

from src.backend.models.schedule import Schedule
from src.backend.models.settings import Settings


class KeyholderValidationError(Exception):
    """Exception raised when keyholder validation fails"""

    pass


def get_next_business_day(date: datetime, settings: Settings) -> datetime | None:
    """Get the next business day based on store opening days"""
    opening_days = settings.opening_days or {}

    # Map Python weekday (0=Monday, 6=Sunday) to opening_days keys
    day_names = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]

    current = date + timedelta(days=1)
    max_attempts = 7  # Don't search forever

    for _ in range(max_attempts):
        day_name = day_names[current.weekday()]
        if opening_days.get(day_name, False):
            return current
        current += timedelta(days=1)

    return None


def get_previous_business_day(date: datetime, settings: Settings) -> datetime | None:
    """Get the previous business day based on store opening days"""
    opening_days = settings.opening_days or {}

    # Map Python weekday (0=Monday, 6=Sunday) to opening_days keys
    day_names = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]

    current = date - timedelta(days=1)
    max_attempts = 7

    for _ in range(max_attempts):
        day_name = day_names[current.weekday()]
        if opening_days.get(day_name, False):
            return current
        current -= timedelta(days=1)

    return None


def is_closing_shift(shift_time: str, settings: Settings) -> bool:
    """Check if a shift end time matches the store closing time"""
    return shift_time == settings.store_closing


def is_opening_shift(shift_time: str, settings: Settings) -> bool:
    """Check if a shift start time matches the store opening time"""
    return shift_time == settings.store_opening


def validate_single_keyholder_per_day(
    schedule_id: int | None,
    date: datetime,
    version: int,
    shift_start: str,
    shift_end: str,
    is_keyholder_shift: bool,
    settings: Settings,
) -> None:
    """
    Validate that there is only one keyholder opening and one keyholder closing per day.

    Args:
        schedule_id: ID of schedule being updated (None for new schedules)
        date: Date of the shift
        version: Schedule version
        shift_start: Shift start time (HH:MM)
        shift_end: Shift end time (HH:MM)
        is_keyholder_shift: Whether this shift is marked as keyholder
        settings: Settings object with store hours

    Raises:
        KeyholderValidationError: If validation fails
    """
    if not is_keyholder_shift:
        return  # No validation needed if not a keyholder shift

    # Determine if this is opening or closing shift
    # Opening shift: starts at store opening time (can end anytime)
    # Closing shift: ends at store closing time (can start anytime)
    # A shift can be BOTH opening and closing (full day)
    is_opening = is_opening_shift(shift_start, settings)
    is_closing = is_closing_shift(shift_end, settings)

    if not is_opening and not is_closing:
        raise KeyholderValidationError(
            "Keyholder shifts must be either opening shifts (starting at "
            f"{settings.store_opening}) or closing shifts (ending at "
            f"{settings.store_closing}), or both."
        )

    # Query for existing keyholder shifts on this date and version
    query = Schedule.query.filter(
        and_(
            Schedule.date == date,
            Schedule.version == version,
            Schedule.is_keyholder_shift == True,  # noqa: E712
        )
    )

    # Exclude the current schedule if updating
    if schedule_id is not None:
        query = query.filter(Schedule.id != schedule_id)

    existing_keyholders = query.all()

    # Check for conflicts
    for existing in existing_keyholders:
        # Check if existing is same type (opening/closing)
        existing_is_opening = is_opening_shift(existing.shift_start, settings)
        existing_is_closing = is_closing_shift(existing.shift_end, settings)

        if is_opening and existing_is_opening:
            raise KeyholderValidationError(
                f"There is already a keyholder opening shift on {date.strftime('%Y-%m-%d')}. "
                f"Only one keyholder can open the store per day."
            )

        if is_closing and existing_is_closing:
            raise KeyholderValidationError(
                f"There is already a keyholder closing shift on {date.strftime('%Y-%m-%d')}. "
                f"Only one keyholder can close the store per day."
            )


def validate_paired_keyholder_shifts(
    schedule_id: int | None,
    date: datetime,
    version: int,
    shift_start: str,
    shift_end: str,
    is_keyholder_shift: bool,
    settings: Settings,
    strict: bool = False,
) -> dict:
    """
    Validate that keyholder shifts are properly paired (closing with next opening).

    Args:
        schedule_id: ID of schedule being updated (None for new schedules)
        date: Date of the shift
        version: Schedule version
        shift_start: Shift start time (HH:MM)
        shift_end: Shift end time (HH:MM)
        is_keyholder_shift: Whether this shift is marked as keyholder
        settings: Settings object with store hours
        strict: If True, raise error on missing pair. If False, return warning.

    Returns:
        dict with validation info including paired shift details if found

    Raises:
        KeyholderValidationError: If strict=True and validation fails
    """
    result = {
        "valid": True,
        "warnings": [],
        "paired_shift": None,
        "paired_employee": None,
    }

    if not is_keyholder_shift:
        return result

    is_opening = is_opening_shift(shift_start, settings)
    is_closing = is_closing_shift(shift_end, settings)

    if is_closing:
        # Check for opening shift on next business day
        next_day = get_next_business_day(date, settings)
        if next_day is None:
            result["warnings"].append("Could not determine next business day")
            return result

        # Look for keyholder opening shift on next day
        paired_schedule = Schedule.query.filter(
            and_(
                Schedule.date == next_day,
                Schedule.version == version,
                Schedule.is_keyholder_shift == True,  # noqa: E712
                Schedule.shift_start == settings.store_opening,
            )
        ).first()

        if paired_schedule:
            result["paired_shift"] = paired_schedule
            result["paired_employee"] = paired_schedule.employee
        else:
            warning = (
                f"Closing keyholder shift on {date.strftime('%Y-%m-%d')} requires "
                f"an opening keyholder shift on {next_day.strftime('%Y-%m-%d')}"
            )
            result["warnings"].append(warning)
            result["valid"] = False

            if strict:
                raise KeyholderValidationError(warning)

    elif is_opening:
        # Check for closing shift on previous business day
        prev_day = get_previous_business_day(date, settings)
        if prev_day is None:
            result["warnings"].append("Could not determine previous business day")
            return result

        # Look for keyholder closing shift on previous day
        paired_schedule = Schedule.query.filter(
            and_(
                Schedule.date == prev_day,
                Schedule.version == version,
                Schedule.is_keyholder_shift == True,  # noqa: E712
                Schedule.shift_end == settings.store_closing,
            )
        ).first()

        if paired_schedule:
            result["paired_shift"] = paired_schedule
            result["paired_employee"] = paired_schedule.employee
        else:
            warning = (
                f"Opening keyholder shift on {date.strftime('%Y-%m-%d')} should have "
                f"a closing keyholder shift on {prev_day.strftime('%Y-%m-%d')}"
            )
            result["warnings"].append(warning)
            # For opening shifts, missing previous closing is a warning, not error
            # because the closing shift might be added later

    return result


def get_paired_shift_info(
    date: datetime,
    version: int,
    shift_start: str,
    shift_end: str,
    settings: Settings,
) -> dict | None:
    """
    Get information about the paired keyholder shift (for preview purposes).

    Args:
        date: Date of the shift
        version: Schedule version
        shift_start: Shift start time (HH:MM)
        shift_end: Shift end time (HH:MM)
        settings: Settings object with store hours

    Returns:
        dict with paired shift info or None if not found
    """
    is_opening = is_opening_shift(shift_start, settings)
    is_closing = is_closing_shift(shift_end, settings)

    if not is_opening and not is_closing:
        return None

    paired_date = None
    paired_shift_type = None

    if is_closing:
        paired_date = get_next_business_day(date, settings)
        paired_shift_type = "opening"
        search_time_field = "shift_start"
        search_time_value = settings.store_opening
    else:  # is_opening
        paired_date = get_previous_business_day(date, settings)
        paired_shift_type = "closing"
        search_time_field = "shift_end"
        search_time_value = settings.store_closing

    if paired_date is None:
        return None

    # Search for the paired shift
    query_filter = and_(
        Schedule.date == paired_date,
        Schedule.version == version,
        Schedule.is_keyholder_shift == True,  # noqa: E712
    )

    if search_time_field == "shift_start":
        query_filter = and_(query_filter, Schedule.shift_start == search_time_value)
    else:
        query_filter = and_(query_filter, Schedule.shift_end == search_time_value)

    paired_schedule = Schedule.query.filter(query_filter).first()

    if paired_schedule:
        employee = paired_schedule.employee
        return {
            "schedule_id": paired_schedule.id,
            "date": paired_date.strftime("%Y-%m-%d"),
            "shift_type": paired_shift_type,
            "shift_start": paired_schedule.shift_start,
            "shift_end": paired_schedule.shift_end,
            "employee_id": paired_schedule.employee_id,
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "employee": {
                "id": employee.id,
                "first_name": employee.first_name,
                "last_name": employee.last_name,
            },
            "missing": None,
        }
    else:
        return {
            "date": paired_date.strftime("%Y-%m-%d"),
            "shift_type": paired_shift_type,
            "shift_start": (
                search_time_value if paired_shift_type == "opening" else None
            ),
            "shift_end": (
                search_time_value if paired_shift_type == "closing" else None
            ),
            "missing": True,
        }
