"""
Utility functions for processing coverage data in the scheduler.
"""
import datetime
from typing import Dict, List, Set, Optional

# Assuming ScheduleResources is in a sibling file resources.py
# and Coverage model is two levels up in models directory
# Adjust paths if necessary based on actual project structure
from .resources import ScheduleResources
from src.backend.models.coverage import Coverage
from src.backend.models.employee import EmployeeGroup # For default employee_types


def _time_str_to_datetime_time(time_str: str) -> Optional[datetime.time]:
    """Converts an 'HH:MM' string to a datetime.time object."""
    if not time_str or len(time_str) != 5 or time_str[2] != ':':
        # Basic validation, can be enhanced
        return None
    try:
        return datetime.time.fromisoformat(time_str)
    except ValueError:
        return None

def get_required_staffing_for_interval(
    target_date: datetime.date,
    interval_start_time: datetime.time,
    resources: ScheduleResources,
    # Default interval duration to 15 minutes, can be made configurable
    interval_duration_minutes: int = 15
) -> Dict:
    """
    Calculates the specific staffing needs for a given time interval on a target date.

    This function iterates through all coverage rules defined in `resources.coverage`
    and determines which ones apply to the specified `interval_start_time` on the
    `target_date` based on the rule's `day_index` and `start_time`/`end_time`.

    Overlap Handling:
    If multiple `Coverage` rules overlap and apply to the same interval:
        - `min_employees`: The maximum value from all applicable rules is taken.
        - `employee_types`: A set union of all specified types is created.
        - `allowed_employee_groups`: A set union of all specified groups is created.
        - `requires_keyholder`: Set to True if *any* applicable rule requires it.
        - `keyholder_before/after_minutes`: The maximum value specified is taken.

    Args:
        target_date: The date for which to calculate staffing needs.
        interval_start_time: The start time of the interval (e.g., 15-min slot).
        resources: ScheduleResources object containing all loaded coverage data.
        interval_duration_minutes: The duration of the interval in minutes.

    Returns:
        A dictionary detailing staffing needs for that specific interval, e.g.,
        {
            'min_employees': 2,
            'employee_types': {'TypeA', 'TypeB'}, # Using a set for unique types
            'allowed_employee_groups': {'Group1', 'Group2'}, # Using a set
            'requires_keyholder': True,
            'keyholder_before_minutes': 30, # Max of applicable values
            'keyholder_after_minutes': 30   # Max of applicable values
        }
        Returns default zero/empty needs if no coverage applies.
    """
    required_staffing = {
        'min_employees': 0,
        'employee_types': set(),
        'allowed_employee_groups': set(),
        'requires_keyholder': False,
        'keyholder_before_minutes': None, # Use None for no requirement
        'keyholder_after_minutes': None,  # Use None for no requirement
    }

    target_day_index: int = target_date.weekday() # Monday is 0 and Sunday is 6

    # Calculate the end time of the interval for checking against Coverage.end_time
    # interval_end_time will be exclusive for comparisons
    interval_start_dt = datetime.datetime.combine(target_date, interval_start_time)
    interval_end_dt = interval_start_dt + datetime.timedelta(minutes=interval_duration_minutes)
    # interval_end_time_for_comparison = interval_end_dt.time() # This might cross midnight

    applicable_coverage_found = False

    for coverage_rule in resources.coverage:
        # Ensure coverage_rule has the necessary attributes
        if not all(hasattr(coverage_rule, attr) for attr in ['day_index', 'start_time', 'end_time', 'min_employees']):
            # log a warning or skip
            continue

        if coverage_rule.day_index != target_day_index:
            continue

        coverage_start_time_obj = _time_str_to_datetime_time(coverage_rule.start_time)
        coverage_end_time_obj = _time_str_to_datetime_time(coverage_rule.end_time)

        if not coverage_start_time_obj or not coverage_end_time_obj:
            # log a warning about invalid time format in coverage rule
            continue
        
        # Check if the interval_start_time is within the coverage rule's time span.
        # Coverage applies if: coverage_start_time <= interval_start_time < coverage_end_time
        if not (coverage_start_time_obj <= interval_start_time < coverage_end_time_obj):
            continue
            
        # If we reach here, this coverage rule applies to this interval
        applicable_coverage_found = True

        # 1. min_employees: take the maximum
        required_staffing['min_employees'] = max(
            required_staffing['min_employees'],
            coverage_rule.min_employees
        )

        # 2. employee_types: union of sets
        current_employee_types = getattr(coverage_rule, 'employee_types', [])
        if isinstance(current_employee_types, list): # Ensure it's iterable
            required_staffing['employee_types'].update(current_employee_types)
        
        # 3. allowed_employee_groups: union of sets
        current_allowed_groups = getattr(coverage_rule, 'allowed_employee_groups', [])
        if isinstance(current_allowed_groups, list): # Ensure it's iterable
            required_staffing['allowed_employee_groups'].update(current_allowed_groups)

        # 4. requires_keyholder: OR condition
        if getattr(coverage_rule, 'requires_keyholder', False):
            required_staffing['requires_keyholder'] = True
        
        # 5. keyholder_before_minutes: max of defined values
        kb_minutes = getattr(coverage_rule, 'keyholder_before_minutes', None)
        if kb_minutes is not None:
            if required_staffing['keyholder_before_minutes'] is None:
                required_staffing['keyholder_before_minutes'] = kb_minutes
            else:
                required_staffing['keyholder_before_minutes'] = max(
                    required_staffing['keyholder_before_minutes'],
                    kb_minutes
                )

        # 6. keyholder_after_minutes: max of defined values
        ka_minutes = getattr(coverage_rule, 'keyholder_after_minutes', None)
        if ka_minutes is not None:
            if required_staffing['keyholder_after_minutes'] is None:
                required_staffing['keyholder_after_minutes'] = ka_minutes
            else:
                required_staffing['keyholder_after_minutes'] = max(
                    required_staffing['keyholder_after_minutes'],
                    ka_minutes
                )
                
    # If no coverage rules applied, ensure min_employees is 0.
    # The default employee_types and allowed_employee_groups will be empty sets,
    # and requires_keyholder will be False, which is correct.
    if not applicable_coverage_found:
        required_staffing['min_employees'] = 0
        # Defaults for keyholder_before/after_minutes remain None if no rule set them.

    # If min_employees > 0 but types/groups are empty, populate with all EmployeeGroup values as a fallback.
    # This depends on business rules: should it enforce types/groups if specified by *any* rule,
    # or only if *all* contributing rules agree, or have a default?
    # For now, if any coverage applied, the union is used. If no coverage applied, types/groups are empty.
    # If min_employees > 0 due to some coverage rule, but that rule had no types/groups,
    # it might be desirable to fall back to all groups.
    # The current logic: if a coverage rule contributes to min_employees, its types/groups (even if empty list)
    # will be part of the union. So if min_employees > 0, but employee_types is empty, it means
    # the contributing coverage rule(s) had empty employee_types.

    # Consider if default 'employee_types' or 'allowed_employee_groups' should be applied
    # if min_employees > 0 and these sets are still empty.
    # For example, if min_employees > 0 and not required_staffing['allowed_employee_groups']:
    #     required_staffing['allowed_employee_groups'] = {group.value for group in EmployeeGroup}

    return required_staffing 