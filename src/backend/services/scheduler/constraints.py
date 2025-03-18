"""Constraint checking module for the scheduler."""

from datetime import date, timedelta, datetime

# Try to handle imports in different environments
try:
    from src.backend.models import Employee, ShiftTemplate
    from src.backend.utils.logger import logger
except ImportError:
    try:
        from backend.models import Employee, ShiftTemplate
        from backend.utils.logger import logger
    except ImportError:
        try:
            from models import Employee, ShiftTemplate
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
        """Set the current schedule for constraint checking"""
        self.schedule = schedule
        self.schedule_by_date = schedule_by_date

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
