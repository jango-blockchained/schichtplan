"""
Week calculation utilities for the Schichtplan application.

This module provides utilities for ISO week calculations with month boundary logic,
supporting the week-based versioning system.
"""

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum


class WeekendStart(Enum):
    """Weekend start preference."""

    SUNDAY = 0
    MONDAY = 1


class MonthBoundaryMode(Enum):
    """How to handle weeks that span month boundaries."""

    KEEP_INTACT = "keep_intact"  # Keep ISO weeks intact
    SPLIT_ON_MONTH = "split_on_month"  # Split weeks at month boundaries


@dataclass
class WeekInfo:
    """Information about a specific week."""

    year: int
    week_number: int
    start_date: date
    end_date: date
    spans_months: bool
    months: list[str]  # Month names that this week spans
    identifier: str  # Week identifier like "2024-W15"


@dataclass
class WeekRange:
    """A range of weeks."""

    start_week: WeekInfo
    end_week: WeekInfo
    total_weeks: int
    identifier: str  # e.g., "2024-W15" or "2024-W15-W17"


def get_iso_week_info(target_date: date) -> WeekInfo:
    """
    Get ISO week information for a given date.

    Args:
        target_date: The date to get week information for

    Returns:
        WeekInfo object with complete week information
    """
    iso_calendar = target_date.isocalendar()
    year = iso_calendar[0]
    week_number = iso_calendar[1]

    # Calculate start and end dates for the ISO week (Monday to Sunday)
    # Find the Monday of this week
    days_since_monday = target_date.weekday()
    start_date = target_date - timedelta(days=days_since_monday)
    end_date = start_date + timedelta(days=6)

    # Check if week spans multiple months
    spans_months = start_date.month != end_date.month

    # Get month names
    months = [calendar.month_name[start_date.month]]
    if spans_months:
        months.append(calendar.month_name[end_date.month])

    return WeekInfo(
        year=year,
        week_number=week_number,
        start_date=start_date,
        end_date=end_date,
        spans_months=spans_months,
        months=months,
        identifier=create_week_identifier(year, week_number),
    )


def get_week_from_identifier(week_identifier: str) -> WeekInfo:
    """
    Parse a week identifier and return week information.

    Args:
        week_identifier: Week identifier like "2024-W15"

    Returns:
        WeekInfo object

    Raises:
        ValueError: If identifier format is invalid
    """
    if not week_identifier.startswith(("20", "19")):  # Basic year validation
        raise ValueError(f"Invalid week identifier format: {week_identifier}")

    parts = week_identifier.split("-W")
    if len(parts) != 2:
        raise ValueError(f"Invalid week identifier format: {week_identifier}")

    try:
        year = int(parts[0])
        week_number = int(parts[1])
    except ValueError:
        raise ValueError(f"Invalid week identifier format: {week_identifier}")

    if not (1 <= week_number <= 53):
        raise ValueError(f"Invalid week number: {week_number}")

    # Find the first Monday of the year (start of week 1)
    # ISO 8601: Week 1 is the first week with at least 4 days in the new year
    jan_4 = date(year, 1, 4)  # Always in week 1
    week_1_monday = jan_4 - timedelta(days=jan_4.weekday())

    # Calculate the start date of the target week
    start_date = week_1_monday + timedelta(weeks=week_number - 1)
    end_date = start_date + timedelta(days=6)

    # Check if week spans multiple months
    spans_months = start_date.month != end_date.month

    # Get month names
    months = [calendar.month_name[start_date.month]]
    if spans_months:
        months.append(calendar.month_name[end_date.month])

    return WeekInfo(
        year=year,
        week_number=week_number,
        start_date=start_date,
        end_date=end_date,
        spans_months=spans_months,
        months=months,
        identifier=create_week_identifier(year, week_number),
    )


def create_week_identifier(year: int, week_number: int) -> str:
    """
    Create a week identifier string from year and week number.

    Args:
        year: The year
        week_number: The ISO week number

    Returns:
        Week identifier string like "2024-W15"
    """
    return f"{year}-W{week_number:02d}"


def get_week_range(start_week: str, end_week: str) -> WeekRange:
    """
    Get information about a range of weeks.

    Args:
        start_week: Start week identifier like "2024-W15"
        end_week: End week identifier like "2024-W17"

    Returns:
        WeekRange object with range information
    """
    start_info = get_week_from_identifier(start_week)
    end_info = get_week_from_identifier(end_week)

    # Calculate total weeks
    start_ordinal = start_info.start_date.toordinal()
    end_ordinal = end_info.end_date.toordinal()
    total_weeks = (end_ordinal - start_ordinal + 1) // 7

    # Create identifier
    if start_week == end_week:
        identifier = start_week
    elif start_info.year == end_info.year:
        identifier = f"{start_info.year}-W{start_info.week_number:02d}-W{end_info.week_number:02d}"
    else:
        identifier = f"{start_week}-{end_week}"

    return WeekRange(
        start_week=start_info,
        end_week=end_info,
        total_weeks=total_weeks,
        identifier=identifier,
    )


def handle_month_boundary(
    week_info: WeekInfo, mode: MonthBoundaryMode
) -> list[tuple[date, date]]:
    """
    Handle month boundary splitting based on the specified mode.

    Args:
        week_info: The week information
        mode: How to handle month boundaries

    Returns:
        List of (start_date, end_date) tuples for each period
    """
    if not week_info.spans_months or mode == MonthBoundaryMode.KEEP_INTACT:
        return [(week_info.start_date, week_info.end_date)]

    # Split on month boundary
    periods = []
    current_date = week_info.start_date

    while current_date <= week_info.end_date:
        # Find the last day of the current month
        last_day_of_month = date(
            current_date.year,
            current_date.month,
            calendar.monthrange(current_date.year, current_date.month)[1],
        )

        period_end = min(last_day_of_month, week_info.end_date)
        periods.append((current_date, period_end))

        # Move to first day of next month
        if period_end < week_info.end_date:
            if current_date.month == 12:
                current_date = date(current_date.year + 1, 1, 1)
            else:
                current_date = date(current_date.year, current_date.month + 1, 1)
        else:
            break

    return periods


@dataclass
class WeekSegmentInfo:
    """Information about a week segment when split at month boundaries."""

    week_identifier: str
    segment_id: str
    segment_number: int
    total_segments: int
    start_date: date
    end_date: date
    month: str
    year: int
    is_first_segment: bool
    is_last_segment: bool
    original_week_info: WeekInfo


def get_week_segments(
    week_info: WeekInfo, mode: MonthBoundaryMode
) -> list[WeekSegmentInfo]:
    """
    Get week segments based on month boundary mode.

    Args:
        week_info: The week information
        mode: How to handle month boundaries

    Returns:
        List of WeekSegmentInfo objects
    """
    periods = handle_month_boundary(week_info, mode)

    if len(periods) == 1:
        # No split needed
        return [
            WeekSegmentInfo(
                week_identifier=week_info.identifier,
                segment_id=week_info.identifier,
                segment_number=1,
                total_segments=1,
                start_date=periods[0][0],
                end_date=periods[0][1],
                month=periods[0][0].strftime("%B"),
                year=periods[0][0].year,
                is_first_segment=True,
                is_last_segment=True,
                original_week_info=week_info,
            )
        ]

    # Create segments for split weeks
    segments = []
    for i, (start, end) in enumerate(periods):
        segment_number = i + 1
        segments.append(
            WeekSegmentInfo(
                week_identifier=week_info.identifier,
                segment_id=f"{week_info.identifier}-S{segment_number}",
                segment_number=segment_number,
                total_segments=len(periods),
                start_date=start,
                end_date=end,
                month=start.strftime("%B"),
                year=start.year,
                is_first_segment=(i == 0),
                is_last_segment=(i == len(periods) - 1),
                original_week_info=week_info,
            )
        )

    return segments


def get_next_week(week_identifier: str) -> str:
    """Get the next week identifier."""
    week_info = get_week_from_identifier(week_identifier)
    next_date = week_info.end_date + timedelta(days=1)
    next_week_info = get_iso_week_info(next_date)
    return create_week_identifier(next_week_info.year, next_week_info.week_number)


def get_previous_week(week_identifier: str) -> str:
    """Get the previous week identifier."""
    week_info = get_week_from_identifier(week_identifier)
    prev_date = week_info.start_date - timedelta(days=1)
    prev_week_info = get_iso_week_info(prev_date)
    return create_week_identifier(prev_week_info.year, prev_week_info.week_number)


def get_current_week_identifier() -> str:
    """Get the current week identifier."""
    today = date.today()
    week_info = get_iso_week_info(today)
    return create_week_identifier(week_info.year, week_info.week_number)
