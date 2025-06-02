"""
Version identifier utilities for the Schichtplan application.

This module provides functions to convert between week identifiers and date ranges,
supporting the week-based versioning system.
"""

from datetime import date, timedelta
from typing import Dict, List, Tuple, Optional
import re
from .week_utils import (
    WeekInfo, 
    WeekRange, 
    get_week_from_identifier, 
    get_iso_week_info,
    create_week_identifier,
    get_week_range
)


def parse_version_identifier(version_identifier: str) -> Dict[str, any]:
    """
    Parse a version identifier and extract its components.
    
    Args:
        version_identifier: Can be legacy numeric (e.g., "5") or week-based (e.g., "2024-W15")
        
    Returns:
        Dictionary with parsed information
    """
    # Check if it's a legacy numeric version
    if version_identifier.isdigit():
        return {
            "type": "legacy",
            "version": int(version_identifier),
            "is_week_based": False
        }    
    # Check if it's a single week identifier
    week_pattern = r"^(\d{4})-W(\d{1,2})$"
    match = re.match(week_pattern, version_identifier)
    if match:
        year = int(match.group(1))
        week = int(match.group(2))
        return {
            "type": "single_week",
            "year": year,
            "week": week,
            "is_week_based": True,
            "week_identifier": version_identifier
        }
    
    # Check if it's a week range identifier
    range_pattern = r"^(\d{4})-W(\d{1,2})-W(\d{1,2})$"
    match = re.match(range_pattern, version_identifier)
    if match:
        year = int(match.group(1))
        start_week = int(match.group(2))
        end_week = int(match.group(3))
        return {
            "type": "week_range",
            "year": year,
            "start_week": start_week,
            "end_week": end_week,
            "is_week_based": True
        }
    
    # Check for cross-year range
    cross_year_pattern = r"^(\d{4})-W(\d{1,2})-(\d{4})-W(\d{1,2})$"
    match = re.match(cross_year_pattern, version_identifier)
    if match:
        start_year = int(match.group(1))
        start_week = int(match.group(2))
        end_year = int(match.group(3))
        end_week = int(match.group(4))
        return {
            "type": "cross_year_range",
            "start_year": start_year,
            "start_week": start_week,
            "end_year": end_year,
            "end_week": end_week,
            "is_week_based": True
        }
    
    raise ValueError(f"Invalid version identifier format: {version_identifier}")def version_identifier_to_date_range(version_identifier: str) -> Tuple[date, date]:
    """
    Convert a version identifier to a date range.
    
    Args:
        version_identifier: Version identifier (legacy or week-based)
        
    Returns:
        Tuple of (start_date, end_date)
        
    Raises:
        ValueError: If the identifier cannot be converted to a date range
    """
    parsed = parse_version_identifier(version_identifier)
    
    if parsed["type"] == "legacy":
        raise ValueError("Legacy version identifiers cannot be converted to date ranges without additional context")
    
    elif parsed["type"] == "single_week":
        week_info = get_week_from_identifier(version_identifier)
        return (week_info.start_date, week_info.end_date)
    
    elif parsed["type"] == "week_range":
        start_identifier = f"{parsed['year']}-W{parsed['start_week']:02d}"
        end_identifier = f"{parsed['year']}-W{parsed['end_week']:02d}"
        start_week = get_week_from_identifier(start_identifier)
        end_week = get_week_from_identifier(end_identifier)
        return (start_week.start_date, end_week.end_date)
    
    elif parsed["type"] == "cross_year_range":
        start_identifier = f"{parsed['start_year']}-W{parsed['start_week']:02d}"
        end_identifier = f"{parsed['end_year']}-W{parsed['end_week']:02d}"
        start_week = get_week_from_identifier(start_identifier)
        end_week = get_week_from_identifier(end_identifier)
        return (start_week.start_date, end_week.end_date)
    
    raise ValueError(f"Unknown version identifier type: {parsed['type']}")


def date_range_to_week_identifier(start_date: date, end_date: date) -> str:
    """
    Convert a date range to a week identifier.
    
    Args:
        start_date: Start date of the range
        end_date: End date of the range
        
    Returns:
        Week identifier string
    """
    start_week = get_iso_week_info(start_date)
    end_week = get_iso_week_info(end_date)
    
    # If it's a single week
    if start_week.year == end_week.year and start_week.week_number == end_week.week_number:
        return create_week_identifier(start_week.year, start_week.week_number)
    
    # If it's a range within the same year
    if start_week.year == end_week.year:
        return f"{start_week.year}-W{start_week.week_number:02d}-W{end_week.week_number:02d}"
    
    # Cross-year range
    start_id = create_week_identifier(start_week.year, start_week.week_number)
    end_id = create_week_identifier(end_week.year, end_week.week_number)
    return f"{start_id}-{end_id}"