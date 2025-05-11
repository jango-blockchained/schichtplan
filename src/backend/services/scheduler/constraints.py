"""Constraint checking module for the scheduler."""

from datetime import date, timedelta, datetime
import sys
import os
from typing import List, Dict, Optional

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Try to handle imports in different environments
try:
    from models import Employee, ShiftTemplate
    from utils.logger import logger
except ImportError:
    try:
        from backend.models import Employee, ShiftTemplate
        from backend.utils.logger import logger
    except ImportError:
        try:
            from src.backend.models import Employee, ShiftTemplate
            from src.backend.utils.logger import logger
        except ImportError:
            # Create type hint classes for standalone testing
            class Employee:
                """Type hint class for Employee"""

                id: int
                employee_group: str
                contracted_hours: float

            class ShiftTemplate:
                """Type hint class for ShiftTemplate"""

                id: int
                start_time: str
                end_time: str
                shift_type: str
                duration_hours: float


class ConstraintChecker:
    """Class for checking schedule constraints"""

    def __init__(self, resources, config, logger):
        self.resources = resources
        self.config = config
        self.logger = logger
        self.schedule = []
        self.schedule_by_date = {}

    def set_schedule(self, schedule, schedule_by_date):
        """Set the current schedule for constraint checking (used by older methods)"""
        self.schedule = schedule
        self.schedule_by_date = schedule_by_date

    def _calculate_shift_duration_from_datetimes(self, start_dt: datetime, end_dt: datetime) -> float:
        """Calculate duration in hours between two datetime objects."""
        if not start_dt or not end_dt or end_dt < start_dt:
            return 0.0
        duration_timedelta = end_dt - start_dt
        return duration_timedelta.total_seconds() / 3600.0

    def _get_assignments_for_employee(self, employee_id: int, assignments_list: List[Dict]) -> List[Dict]:
        """Helper to filter a list of assignment dicts for a specific employee."""
        return [asn for asn in assignments_list if asn.get("employee_id") == employee_id]

    def _parse_assignment_datetime(self, assignment: Dict, field_name: str, on_date: date) -> Optional[datetime]:
        """Safely parse a time string from an assignment dict into a datetime object on a given date."""
        time_str = assignment.get(field_name)
        if not time_str: # Check if time_str is None or empty
            self.logger.debug(f"Time string is None or empty for field {field_name} in assignment {assignment.get('id')}")
            return None
        try:
            # Ensure on_date is a date object
            if not isinstance(on_date, date):
                if isinstance(on_date, str):
                    on_date = date.fromisoformat(on_date)
                else: # If not a date or string, cannot proceed
                    self.logger.warning(f"Invalid 'on_date' type ({type(on_date)}) for parsing time string in assignment {assignment.get('id')}")
                    return None

            h, m = map(int, time_str.split(':'))
            return datetime.combine(on_date, datetime.min.time().replace(hour=h, minute=m))
        except ValueError as e:
            self.logger.warning(f"Invalid time string '{time_str}' (ValueError: {e}) in assignment for employee {assignment.get('employee_id')} on date {on_date}")
            return None
        except TypeError as e: # Catch errors if on_date is not a valid type for combine
            self.logger.warning(f"TypeError during time string parsing for '{time_str}' on date {on_date} (Error: {e}) assignment {assignment.get('id')}")
            return None

    def check_all_constraints(
        self, 
        employee_id: int, 
        new_shift_start_dt: datetime, 
        new_shift_end_dt: datetime, 
        existing_assignments: List[Dict]
    ) -> List[Dict]:
        """
        Checks all constraints for a potential new shift against existing assignments.
        Args:
            employee_id: The ID of the employee.
            new_shift_start_dt: The start datetime of the new potential shift.
            new_shift_end_dt: The end datetime of the new potential shift.
            existing_assignments: A list of assignment dictionaries already made.
        Returns:
            A list of violation detail dictionaries. Empty if no violations.
        """
        violations = []
        employee = self.resources.get_employee(employee_id)
        if not employee:
            self.logger.error(f"Constraint Check: Employee {employee_id} not found in resources.")
            violations.append({"type": "resource_error", "message": f"Employee {employee_id} not found."})
            return violations

        new_shift_duration = self._calculate_shift_duration_from_datetimes(new_shift_start_dt, new_shift_end_dt)
        if new_shift_duration <= 0:
            violations.append({"type": "shift_error", "message": "New shift has invalid or zero duration."})
            return violations # If duration is invalid, many other checks are moot or will fail unexpectedly.
            
        # 1. Max Consecutive Days
        consecutive_days_violation = self._check_max_consecutive_days(
            employee, new_shift_start_dt.date(), existing_assignments
        )
        if consecutive_days_violation:
            violations.append(consecutive_days_violation)

        # Call the remaining new helper methods
        rest_violation = self._check_min_rest_between_shifts(
            employee, new_shift_start_dt, new_shift_end_dt, existing_assignments
        )
        if rest_violation:
            violations.append(rest_violation)

        daily_hours_violation = self._check_daily_hours_limit(
            employee, new_shift_duration # new_shift_duration is calculated at the start of check_all_constraints
        )
        if daily_hours_violation:
            violations.append(daily_hours_violation)
            
        weekly_hours_violation = self._check_weekly_hours_limit(
            employee, new_shift_start_dt, new_shift_duration, existing_assignments
        )
        if weekly_hours_violation:
            violations.append(weekly_hours_violation)

        return violations

    def _check_max_consecutive_days(
        self, employee: Employee, new_shift_date: date, existing_assignments: List[Dict]
    ) -> Optional[Dict]:
        """Checks if adding a shift on new_shift_date would exceed max consecutive workdays."""
        max_consecutive = getattr(self.config, "max_consecutive_days", 7)
        
        employee_assignments = self._get_assignments_for_employee(employee.id, existing_assignments)
        
        # Extract dates from existing assignments for the specific employee
        # Ensure 'date' key exists and is a date object, or parseable string
        worked_dates_from_existing = set()
        for asn in employee_assignments:
            asn_date_val = asn.get('date')
            if isinstance(asn_date_val, date):
                worked_dates_from_existing.add(asn_date_val)
            elif isinstance(asn_date_val, str):
                try:
                    worked_dates_from_existing.add(date.fromisoformat(asn_date_val))
                except ValueError:
                    self.logger.warning(f"Invalid date string '{asn_date_val}' in existing assignment for employee {employee.id}")
            # If asn_date_val is None or other type, it's ignored for this check

        # Add the new shift's date to the set of worked dates for calculation
        all_considered_worked_dates = worked_dates_from_existing.copy()
        all_considered_worked_dates.add(new_shift_date)

        # Count consecutive days ending on new_shift_date
        # This logic determines the length of the streak that *would be formed* if the new shift is added.
        current_streak_count = 0
        # Start from new_shift_date and go backwards
        check_d = new_shift_date
        while check_d in all_considered_worked_dates:
            current_streak_count += 1
            # Check if this date was from an *actual* existing assignment or is the new_shift_date
            # This distinction is not strictly needed for the count if we assume `all_considered_worked_dates` is correct.
            check_d -= timedelta(days=1)
            if current_streak_count > max_consecutive + 5: # Safety break for very long loops (e.g. misconfigured data)
                 self.logger.error(f"Safety break in consecutive day count for employee {employee.id}, date {new_shift_date}")
                 break 

        if current_streak_count > max_consecutive:
            message = (f"Assigning shift on {new_shift_date} would result in {current_streak_count} consecutive workdays "
                       f"(limit: {max_consecutive}).")
            self.logger.debug(f"Employee {employee.id}: {message}")
            return {"type": "max_consecutive_days", "message": message, "limit": max_consecutive, "value": current_streak_count}
        return None

    def _check_min_rest_between_shifts(
        self, employee: Employee, new_shift_start_dt: datetime, new_shift_end_dt: datetime, existing_assignments: List[Dict]
    ) -> Optional[Dict]:
        """Checks for sufficient rest before and after the new_shift."""
        min_rest_hours = getattr(self.config, "min_rest_hours", 11.0) # Ensure float for comparison if config value is int
        if not getattr(self.config, "enforce_rest_periods", True):
            return None

        employee_assignments = self._get_assignments_for_employee(employee.id, existing_assignments)

        # Check rest AFTER a PREVIOUS shift and BEFORE the NEW shift
        latest_previous_shift_end_dt = None
        for asn in employee_assignments:
            # Assuming 'date' in asn is a date object or ISO string, and 'end_time' is a time string "HH:MM"
            asn_date_val = asn.get('date')
            if asn_date_val is None:
                self.logger.debug(f"Skipping rest check for assignment {asn.get('id')} due to missing date.")
                continue
            prev_shift_end = self._parse_assignment_datetime(asn, 'end_time', asn_date_val)
            
            if prev_shift_end and prev_shift_end < new_shift_start_dt:
                if latest_previous_shift_end_dt is None or prev_shift_end > latest_previous_shift_end_dt:
                    latest_previous_shift_end_dt = prev_shift_end
        
        if latest_previous_shift_end_dt:
            rest_duration_hours = (new_shift_start_dt - latest_previous_shift_end_dt).total_seconds() / 3600.0
            if rest_duration_hours < min_rest_hours:
                message = (f"Insufficient rest before new shift on {new_shift_start_dt.date()}. "
                           f"Required: {min_rest_hours}h, Actual: {rest_duration_hours:.2f}h "
                           f"(previous shift ended {latest_previous_shift_end_dt}).")
                self.logger.debug(f"Employee {employee.id}: {message}")
                return {"type": "min_rest_before", "message": message, "limit": min_rest_hours, "value": rest_duration_hours}

        # Check rest AFTER the NEW shift and BEFORE an EXISTING SUBSEQUENT shift
        earliest_subsequent_shift_start_dt = None
        for asn in employee_assignments:
            asn_date_val = asn.get('date')
            if asn_date_val is None:
                self.logger.debug(f"Skipping rest check for assignment {asn.get('id')} due to missing date.")
                continue
            next_shift_start = self._parse_assignment_datetime(asn, 'start_time', asn_date_val)

            if next_shift_start and next_shift_start > new_shift_end_dt:
                if earliest_subsequent_shift_start_dt is None or next_shift_start < earliest_subsequent_shift_start_dt:
                    earliest_subsequent_shift_start_dt = next_shift_start

        if earliest_subsequent_shift_start_dt:
            rest_duration_hours = (earliest_subsequent_shift_start_dt - new_shift_end_dt).total_seconds() / 3600.0
            if rest_duration_hours < min_rest_hours:
                message = (f"Insufficient rest after new shift on {new_shift_start_dt.date()}. "
                           f"Required: {min_rest_hours}h, Actual: {rest_duration_hours:.2f}h "
                           f"(subsequent shift starts {earliest_subsequent_shift_start_dt}).")
                self.logger.debug(f"Employee {employee.id}: {message}")
                return {"type": "min_rest_after", "message": message, "limit": min_rest_hours, "value": rest_duration_hours}
        
        return None

    def _check_daily_hours_limit(self, employee: Employee, new_shift_duration: float) -> Optional[Dict]:
        """Checks if the new_shift_duration exceeds the employee's daily hour limit."""
        max_daily_hours_cfg = getattr(self.config, "employee_types", [])
        employee_group_id_attr = getattr(employee, 'employee_group', None)
        employee_group_id_str = None

        if employee_group_id_attr is not None:
            if hasattr(employee_group_id_attr, 'value'): # Handle Enum e.g. EmployeeGroup.VZ.value
                 employee_group_id_str = employee_group_id_attr.value
            elif isinstance(employee_group_id_attr, str):
                 employee_group_id_str = employee_group_id_attr
            # If it's neither (e.g. an unexpected type), employee_group_id_str remains None

        max_daily_hours = 8.0 # Default value if not found in config
        found_group_in_config = False
        for group_cfg in max_daily_hours_cfg:
            if group_cfg.get("id") == employee_group_id_str:
                max_daily_hours = group_cfg.get("max_daily_hours", 8.0)
                found_group_in_config = True
                break
        
        if not found_group_in_config and employee_group_id_str is not None:
            self.logger.debug(f"Employee group '{employee_group_id_str}' for employee {employee.id} not found in config's employee_types. Using default max_daily_hours: {max_daily_hours}h.")
        elif employee_group_id_str is None:
            self.logger.debug(f"Employee {employee.id} has no specified employee group. Using default max_daily_hours: {max_daily_hours}h.")

        if new_shift_duration > max_daily_hours:
            message = (f"New shift duration {new_shift_duration:.2f}h exceeds daily limit of {max_daily_hours}h "
                       f"for employee group '{employee_group_id_str if employee_group_id_str else 'Default'}'.")
            self.logger.debug(f"Employee {employee.id}: {message}")
            return {"type": "max_daily_hours", "message": message, "limit": max_daily_hours, "value": new_shift_duration}
        return None

    def _check_weekly_hours_limit(
        self, employee: Employee, new_shift_start_dt: datetime, new_shift_duration: float, existing_assignments: List[Dict]
    ) -> Optional[Dict]:
        """Checks if adding the new shift would exceed weekly hour limits."""
        new_shift_date = new_shift_start_dt.date()
        # Determine the week (Monday to Sunday) for the new_shift_date
        week_start_date = new_shift_date - timedelta(days=new_shift_date.weekday())
        week_end_date = week_start_date + timedelta(days=6)

        current_weekly_hours = 0.0
        employee_assignments = self._get_assignments_for_employee(employee.id, existing_assignments)

        for asn in employee_assignments:
            asn_date_val = asn.get('date')
            asn_date_obj = None
            if isinstance(asn_date_val, date):
                asn_date_obj = asn_date_val
            elif isinstance(asn_date_val, str):
                try:
                    asn_date_obj = date.fromisoformat(asn_date_val)
                except ValueError:
                    self.logger.warning(f"Invalid date string '{asn_date_val}' in weekly hours check for emp {employee.id}")
                    continue 
            else:
                # If date is not a date object or parseable string, skip this assignment for weekly calculation
                self.logger.debug(f"Skipping assignment with invalid date type ({type(asn_date_val)}) for weekly hours calc for emp {employee.id}")
                continue

            if week_start_date <= asn_date_obj <= week_end_date:
                # The assignment is within the same week as the new shift
                asn_start_dt = self._parse_assignment_datetime(asn, 'start_time', asn_date_obj)
                asn_end_dt = self._parse_assignment_datetime(asn, 'end_time', asn_date_obj)
                if asn_start_dt and asn_end_dt:
                    current_weekly_hours += self._calculate_shift_duration_from_datetimes(asn_start_dt, asn_end_dt)
                else:
                    self.logger.debug(f"Could not parse start/end time for assignment {asn.get('id')} on {asn_date_obj} for emp {employee.id} during weekly calc.")
        
        projected_weekly_hours = current_weekly_hours + new_shift_duration

        # Check against configured max_hours_per_group
        employee_group_id_attr = getattr(employee, 'employee_group', None)
        employee_group_id_str = None # Initialize before conditional assignment

        if employee_group_id_attr is not None:
            if hasattr(employee_group_id_attr, 'value'): # Handle Enum
                 employee_group_id_str = employee_group_id_attr.value
            elif isinstance(employee_group_id_attr, str):
                 employee_group_id_str = employee_group_id_attr
        
        config_max_weekly_hours = getattr(self.config, "max_hours_per_group", {}).get(employee_group_id_str) # Use employee_group_id_str here

        if config_max_weekly_hours is not None and projected_weekly_hours > config_max_weekly_hours:
            message = (f"Projected weekly hours {projected_weekly_hours:.2f}h (current: {current_weekly_hours:.2f}h + new: {new_shift_duration:.2f}h) "
                       f"would exceed group limit of {config_max_weekly_hours}h for group '{employee_group_id_str if employee_group_id_str else 'Default'}'.")
            self.logger.debug(f"Employee {employee.id}: {message}")
            return {"type": "max_weekly_hours_group", "message": message, "limit": config_max_weekly_hours, "value": projected_weekly_hours}

        # Check against employee's contracted hours (e.g., not to exceed by more than X%)
        contracted_hours = getattr(employee, "contracted_hours", None)
        if contracted_hours is not None and contracted_hours > 0: # Ensure contracted_hours is positive
            contracted_limit_factor = getattr(self.config, "contracted_hours_limit_factor", 1.2)
            absolute_contracted_limit = contracted_hours * contracted_limit_factor
            if projected_weekly_hours > absolute_contracted_limit:
                message = (f"Projected weekly hours {projected_weekly_hours:.2f}h "
                           f"would exceed {contracted_limit_factor*100:.0f}% of contracted hours ({contracted_hours}h), "
                           f"limit: {absolute_contracted_limit:.2f}h.")
                self.logger.debug(f"Employee {employee.id}: {message}")
                return {"type": "max_weekly_hours_contract", "message": message, "limit": absolute_contracted_limit, "value": projected_weekly_hours}

        return None

    def exceeds_constraints(
        self,
        employee: Employee,
        current_date: date,
        shift: ShiftTemplate,
    ) -> bool:
        """Check if assigning the employee to this shift would exceed constraints"""
        try:
            # Check general constraints like max consecutive days, rest time, etc.
            # Log what we're checking for debugging
            self.log_debug(
                f"Checking constraints for employee {employee.id} on {current_date} "
                f"for shift {shift.id} ({shift.start_time}-{shift.end_time})"
            )

            # Check if employee has already worked too many consecutive days
            consecutive_days = self.count_consecutive_days(employee.id, current_date)
            if consecutive_days >= self.config.max_consecutive_days:
                self.log_debug(
                    f"Employee {employee.id} has worked {consecutive_days} consecutive days, "
                    f"which exceeds max of {self.config.max_consecutive_days}"
                )
                return True

            # Check if employee would have enough rest between shifts
            if not self.has_enough_rest(employee, shift, current_date):
                self.log_debug(
                    f"Employee {employee.id} would not have enough rest "
                    f"between shifts on {current_date}"
                )
                return True

            # Check weekly hours
            weekly_hours = self.get_weekly_hours(employee.id, current_date)

            # Calculate shift duration
            shift_duration = 0
            if hasattr(shift, "duration_hours") and shift.duration_hours is not None:
                shift_duration = shift.duration_hours
            else:
                # Calculate from start and end time
                shift_duration = self.calculate_shift_duration(
                    shift.start_time, shift.end_time
                )

            total_hours = weekly_hours + shift_duration

            # Get employee group settings
            max_daily_hours = 8.0  # Default
            if hasattr(self.config, "employee_types"):
                # Try to find employee group in config
                for group in self.config.employee_types:
                    if group.get("id") == employee.employee_group:
                        max_daily_hours = group.get("max_daily_hours", 8.0)
                        break

            # Check if shift duration would exceed max daily hours
            if shift_duration > max_daily_hours:
                self.log_debug(
                    f"Shift duration {shift_duration}h exceeds max daily hours "
                    f"{max_daily_hours}h for employee {employee.id}"
                )
                return True

            # Check if adding this shift would exceed weekly hours limit
            if hasattr(self.config, "max_hours_per_group"):
                if employee.employee_group in self.config.max_hours_per_group:
                    max_hours = self.config.max_hours_per_group[employee.employee_group]
                    if total_hours > max_hours:
                        self.log_debug(
                            f"Weekly hours ({total_hours}h) would exceed max "
                            f"({max_hours}h) for employee {employee.id}"
                        )
                        return True

            # All constraints satisfied
            return False

        except Exception as e:
            self.log_warning(
                f"Error checking constraints for employee {employee.id}: {str(e)}"
            )
            return True  # Safer to assume constraints are exceeded if check fails

    def has_enough_rest(
        self,
        employee: Employee,
        shift: ShiftTemplate,
        current_date: date,
    ) -> bool:
        """Check if employee has enough rest between shifts"""
        # Skip rest check if not enforced
        if (
            not hasattr(self.config, "enforce_rest_periods")
            or not self.config.enforce_rest_periods
        ):
            return True

        # Get min rest hours from config
        min_rest_hours = getattr(self.config, "min_rest_hours", 11)

        # Get previous day's shift if any
        previous_date = current_date - timedelta(days=1)
        prev_entries = self.schedule_by_date.get(previous_date, [])

        for entry in prev_entries:
            if entry.employee_id == employee.id and entry.shift_id is not None:
                prev_shift = next(
                    (s for s in self.resources.shifts if s.id == entry.shift_id),
                    None,
                )
                if prev_shift:
                    # Calculate rest hours between shifts
                    prev_end_time = prev_shift.end_time
                    curr_start_time = shift.start_time

                    rest_hours = self.calculate_rest_hours(
                        prev_end_time, curr_start_time
                    )

                    # Check if rest hours are sufficient
                    if rest_hours < min_rest_hours:
                        return False

        # Get next day's shift if any
        next_date = current_date + timedelta(days=1)
        next_entries = self.schedule_by_date.get(next_date, [])

        for entry in next_entries:
            if entry.employee_id == employee.id and entry.shift_id is not None:
                next_shift = next(
                    (s for s in self.resources.shifts if s.id == entry.shift_id),
                    None,
                )
                if next_shift:
                    # Calculate rest hours between shifts
                    curr_end_time = shift.end_time
                    next_start_time = next_shift.start_time

                    rest_hours = self.calculate_rest_hours(
                        curr_end_time, next_start_time
                    )

                    # Check if rest hours are sufficient
                    if rest_hours < min_rest_hours:
                        return False

        return True

    def count_consecutive_days(self, employee_id: int, current_date: date) -> int:
        """Count how many consecutive days an employee has worked up to current_date"""
        consecutive_days = 0
        check_date = current_date - timedelta(days=1)

        while check_date >= current_date - timedelta(days=7):  # Check up to 7 days back
            if any(
                s.employee_id == employee_id and s.date == check_date
                for s in self.schedule
            ):
                consecutive_days += 1
                check_date -= timedelta(days=1)
            else:
                break

        return consecutive_days

    def would_exceed_weekly_hours(
        self, employee_id: int, current_date: date, start_time: str, end_time: str
    ) -> bool:
        """Check if adding this shift would exceed the employee's weekly hours"""
        # Get the start of the week (Monday)
        week_start = current_date - timedelta(days=current_date.weekday())
        week_end = week_start + timedelta(days=6)

        # Calculate current weekly hours
        weekly_hours = 0.0
        for schedule_entry in self.schedule:
            if (
                schedule_entry.employee_id == employee_id
                and week_start <= schedule_entry.date <= week_end
                and schedule_entry.shift_id is not None
            ):
                # Find the shift template
                entry_shift = next(
                    (
                        s
                        for s in self.resources.shifts
                        if s.id == schedule_entry.shift_id
                    ),
                    None,
                )
                if entry_shift:
                    if (
                        hasattr(entry_shift, "duration_hours")
                        and entry_shift.duration_hours is not None
                    ):
                        weekly_hours += entry_shift.duration_hours
                    else:
                        weekly_hours += self.calculate_shift_duration(
                            entry_shift.start_time, entry_shift.end_time
                        )

        # Add hours from the new shift
        shift_duration = self.calculate_shift_duration(start_time, end_time)
        weekly_hours += shift_duration

        # Find the employee object to get the employee group
        employee = next(
            (e for e in self.resources.employees if e.id == employee_id), None
        )
        if not employee:
            self.log_warning(
                f"Employee {employee_id} not found when checking weekly hours"
            )
            return True  # Better to be safe and assume constraint is exceeded

        # Get maximum weekly hours based on employee group
        max_hours = self.config.max_hours_per_group.get(
            employee.employee_group,
            40.0,  # Default to 40 hours if not specified
        )

        # Log for debugging
        self.log_debug(
            f"Employee {employee_id} weekly hours would be {weekly_hours:.1f}h (max {max_hours}h)"
        )

        # Also check against contracted hours
        if hasattr(employee, "contracted_hours") and employee.contracted_hours:
            # Don't exceed contracted hours by more than 20%
            contracted_limit = employee.contracted_hours * 1.2
            if weekly_hours > contracted_limit:
                self.log_debug(
                    f"Weekly hours {weekly_hours:.1f}h would exceed contracted limit "
                    f"{contracted_limit:.1f}h (120% of {employee.contracted_hours}h)"
                )
                return True

        return weekly_hours > max_hours

    def get_weekly_hours(self, employee_id: int, week_start: date) -> float:
        """Calculate total scheduled hours for an employee in the given week"""
        total_hours = 0.0

        # Get the week end date
        week_end = week_start + timedelta(days=6)

        # Instead of checking all entries, we can pre-filter by employee_id
        employee_entries = [
            entry
            for entry in self.schedule
            if (isinstance(entry, dict) and entry.get("employee_id") == employee_id)
            or (hasattr(entry, "employee_id") and entry.employee_id == employee_id)
        ]

        # Then check only those entries against the date range
        for entry in employee_entries:
            # Get the entry date
            if isinstance(entry, dict):
                # Dictionary case
                entry_date_str = entry.get("date")
                if not entry_date_str:
                    continue

                try:
                    entry_date = datetime.fromisoformat(entry_date_str).date()
                except (ValueError, TypeError):
                    self.log_warning(
                        f"Invalid date format in schedule entry: {entry_date_str}"
                    )
                    continue
            else:
                # Schedule object case
                if not hasattr(entry, "date"):
                    continue

                if isinstance(entry.date, date):
                    entry_date = entry.date
                elif isinstance(entry.date, str):
                    try:
                        entry_date = datetime.fromisoformat(entry.date).date()
                    except (ValueError, TypeError):
                        self.log_warning(
                            f"Invalid date format in schedule entry: {entry.date}"
                        )
                        continue
                else:
                    continue

            # Check if the entry is within the week
            if week_start <= entry_date <= week_end:
                # Add the hours from this entry
                if isinstance(entry, dict):
                    # Dictionary case
                    hours = entry.get("duration_hours", 0.0)
                    if hours:
                        total_hours += float(hours)
                else:
                    # Schedule object case - safely handle shifts and their duration
                    if hasattr(entry, "shift") and entry.shift is not None:
                        if (
                            hasattr(entry.shift, "duration_hours")
                            and entry.shift.duration_hours is not None
                        ):
                            total_hours += entry.shift.duration_hours

        return total_hours

    def count_weekly_shifts(self, employee_id: int, week_start: date) -> int:
        """Count the number of shifts for an employee in the given week"""
        count = 0

        # Check existing schedule entries
        for entry in self.schedule:
            if entry.employee_id == employee_id:
                entry_date = entry.date
                entry_week_start = self.get_week_start(entry_date)

                if entry_week_start == week_start:
                    count += 1

        return count

    def get_week_start(self, day: date) -> date:
        """Get the start of the week (Monday) for a given date"""
        return day - timedelta(days=day.weekday())

    def calculate_shift_duration(
        self, start_time: str, end_time: str, shift=None
    ) -> float:
        """Calculate the duration of a shift in hours"""
        try:
            # Parse hours and minutes from time strings
            start_parts = start_time.split(":")
            end_parts = end_time.split(":")

            start_hour = int(start_parts[0])
            start_min = int(start_parts[1]) if len(start_parts) > 1 else 0

            end_hour = int(end_parts[0])
            end_min = int(end_parts[1]) if len(end_parts) > 1 else 0

            # Calculate total minutes
            start_minutes = start_hour * 60 + start_min
            end_minutes = end_hour * 60 + end_min

            # Handle case where end time is on the next day
            if end_minutes < start_minutes:
                end_minutes += 24 * 60

            # Convert minutes to hours
            duration_hours = (end_minutes - start_minutes) / 60.0

            # Cache the duration on the shift object if provided
            if shift is not None:
                if not hasattr(shift, "duration_hours") or shift.duration_hours is None:
                    shift.duration_hours = duration_hours
                    self.log_debug(
                        f"Cached duration {duration_hours:.2f}h on shift {shift.id}"
                    )

            self.log_debug(
                f"Shift duration {start_time}-{end_time} = {duration_hours:.2f}h"
            )
            return duration_hours
        except Exception as e:
            self.log_error(f"Error calculating shift duration: {str(e)}")
            return 0.0

    def calculate_rest_hours(self, end_time: str, start_time: str) -> float:
        """Calculate the rest hours between two shifts"""
        try:
            end_hour, end_min = map(int, end_time.split(":"))
            start_hour, start_min = map(int, start_time.split(":"))

            end_minutes = end_hour * 60 + end_min
            start_minutes = start_hour * 60 + start_min

            # If start time is earlier than end time, it's the next day
            if start_minutes < end_minutes:
                start_minutes += 24 * 60

            rest_minutes = start_minutes - end_minutes
            return rest_minutes / 60.0
        except Exception as e:
            self.log_error(f"Error calculating rest hours: {str(e)}")
            return 0.0

    # Logging methods for constraint checking
    def log_debug(self, message):
        if hasattr(self.logger, "debug"):
            self.logger.debug(message)

    def log_warning(self, message):
        if hasattr(self.logger, "warning"):
            self.logger.warning(message)

    def log_error(self, message):
        if hasattr(self.logger, "error"):
            self.logger.error(message)
