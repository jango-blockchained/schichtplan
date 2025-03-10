"""
Utility functions for the scheduler package.
"""

import functools


def is_early_shift(shift):
    """Check if a shift starts early in the morning (before 8:00)"""
    start_hour = int(shift.start_time.split(":")[0])
    return start_hour < 8


def is_late_shift(shift):
    """Check if a shift ends late in the evening (after 18:00)"""
    end_hour = int(shift.end_time.split(":")[0])
    return end_hour >= 18


def requires_keyholder(shift):
    """Check if a shift requires a keyholder (early or late shifts)"""
    return is_early_shift(shift) or is_late_shift(shift)


@functools.lru_cache(maxsize=128)
def time_to_minutes(time_str: str) -> int:
    """
    Convert a time string (HH:MM) to minutes since midnight.
    This function is cached for performance with common time values.
    """
    hours, minutes = map(int, time_str.split(":"))
    return hours * 60 + minutes


def shifts_overlap(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if two shifts overlap in time"""
    start1_minutes = time_to_minutes(start1)
    end1_minutes = time_to_minutes(end1)
    start2_minutes = time_to_minutes(start2)
    end2_minutes = time_to_minutes(end2)

    return (start1_minutes < end2_minutes and end1_minutes > start2_minutes) or (
        start2_minutes < end1_minutes and end2_minutes > start1_minutes
    )


def time_overlaps(start1: str, end1: str, start2: str, end2: str) -> bool:
    """Check if two time periods overlap"""
    return shifts_overlap(start1, end1, start2, end2)


@functools.lru_cache(maxsize=128)
def calculate_duration(start_time: str, end_time: str) -> float:
    """
    Calculate the duration in hours between two time strings (HH:MM).
    This function is cached for performance with common time values.
    """
    start_minutes = time_to_minutes(start_time)
    end_minutes = time_to_minutes(end_time)

    # Handle case where end time is on the next day
    if end_minutes < start_minutes:
        end_minutes += 24 * 60

    return (end_minutes - start_minutes) / 60


@functools.lru_cache(maxsize=128)
def calculate_rest_hours(end_time_str: str, start_time_str: str) -> float:
    """
    Calculate the rest hours between the end of one shift and the start of another.
    This function is cached for performance with common time values.
    """
    end_minutes = time_to_minutes(end_time_str)
    start_minutes = time_to_minutes(start_time_str)

    # Handle case where start time is on the next day
    if start_minutes < end_minutes:
        start_minutes += 24 * 60

    return (start_minutes - end_minutes) / 60


# Clear caches function (useful for tests)
def clear_time_caches():
    """Clear all cached time calculations - useful for testing"""
    time_to_minutes.cache_clear()
    calculate_duration.cache_clear()
    calculate_rest_hours.cache_clear()
