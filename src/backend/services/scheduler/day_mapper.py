"""
Day index mapping utility for the scheduler.

This module provides functions to convert between different day index systems:
- Python's datetime.weekday(): 0=Monday, 6=Sunday
- Coverage day_index: 0=Monday, 5=Saturday (no Sunday)
- Shift template active_days: {"0": Sunday, "1": Monday, ..., "6": Saturday}
"""

from datetime import date
from typing import Dict, Optional, Any, Union


# Day name lists for different systems
PYTHON_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
SHIFT_TEMPLATE_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def get_python_weekday(check_date: date) -> int:
    """
    Get Python's weekday (0=Monday, 6=Sunday).
    
    Args:
        check_date: Date to get weekday for
        
    Returns:
        Integer representing weekday (0=Monday, 6=Sunday)
    """
    return check_date.weekday()


def get_coverage_day_index(check_date: date) -> Optional[int]:
    """
    Get coverage day_index (0=Monday, 5=Saturday, None for Sunday).
    
    Args:
        check_date: Date to get day index for
        
    Returns:
        Integer representing coverage day index or None for Sunday
    """
    weekday = check_date.weekday()
    # No Sunday in coverage system
    if weekday == 6:
        return None
    return weekday  # Python's weekday directly maps to coverage day_index


def get_template_day_key(check_date: date) -> str:
    """
    Get shift template day key (string keys where "0"=Sunday, "6"=Saturday).
    
    Args:
        check_date: Date to get template day key for
        
    Returns:
        String key for template active_days dict
    """
    weekday = check_date.weekday()
    # Convert Python weekday to template day key
    # Monday (0) -> "1", Sunday (6) -> "0"
    template_day = (weekday + 1) % 7
    return str(template_day)


def is_template_active_for_date(active_days: Dict[str, bool], check_date: date) -> bool:
    """
    Check if a shift template is active for a given date.
    
    Args:
        active_days: Dictionary of active days from shift template
        check_date: Date to check
        
    Returns:
        True if template is active for this date, False otherwise
    """
    day_key = get_template_day_key(check_date)
    return active_days.get(day_key, False)


def get_day_index_mapping() -> Dict[str, Any]:
    """
    Get standard day index mapping configuration for the scheduler.
    
    Returns:
        Dictionary with mapping configuration for scheduler API
    """
    return {
        "apply_day_index_mapping": True,
        "map_coverage_by_weekday": True,
        "day_index_map": {
            "0": 0,      # Monday (Python) -> day_index 0 (Coverage)
            "1": 1,      # Tuesday (Python) -> day_index 1 (Coverage)
            "2": 2,      # Wednesday (Python) -> day_index 2 (Coverage)
            "3": 3,      # Thursday (Python) -> day_index 3 (Coverage)
            "4": 4,      # Friday (Python) -> day_index 4 (Coverage)
            "5": 5,      # Saturday (Python) -> day_index 5 (Coverage)
            "6": None    # Sunday (Python) -> No coverage
        },
        "template_day_map": {
            "0": "1",    # day_index 0 (Coverage/Monday) -> active_days key "1" (Template/Monday)
            "1": "2",    # day_index 1 (Coverage/Tuesday) -> active_days key "2" (Template/Tuesday)
            "2": "3",    # day_index 2 (Coverage/Wednesday) -> active_days key "3" (Template/Wednesday)
            "3": "4",    # day_index 3 (Coverage/Thursday) -> active_days key "4" (Template/Thursday)
            "4": "5",    # day_index 4 (Coverage/Friday) -> active_days key "5" (Template/Friday)
            "5": "6"     # day_index 5 (Coverage/Saturday) -> active_days key "6" (Template/Saturday)
        }
    } 