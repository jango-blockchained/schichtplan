"""Schedule generator module for creating employee work schedules"""

# Standard library imports
import logging
import sys
from collections import defaultdict
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import List, Dict, Any, Optional, Iterable

# Add backend to Python path to ensure imports work correctly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Create relative imports for both package and direct execution
try:
    # When running as part of the backend package
    from backend.models import Employee, ShiftTemplate, Schedule, Coverage, db, Settings
    from backend.models.schedule import ScheduleStatus
    from backend.models.employee import AvailabilityType
    from backend.utils.logger import logger
    from backend.services.scheduler.resources import ScheduleResources
    from backend.services.scheduler.validator import ScheduleValidator, ScheduleConfig
    from backend.services.scheduler.utility import time_to_minutes, shifts_overlap
    from backend.services.scheduler.distribution import DistributionManager
except ImportError:
    # When running directly or as part of a different path structure
    try:
        from models import Employee, ShiftTemplate, Schedule, Coverage, db, Settings
        from models.schedule import ScheduleStatus
        from models.employee import AvailabilityType
        from utils.logger import logger
        from .resources import ScheduleResources
        from .validator import ScheduleValidator, ScheduleConfig
        from .utility import time_to_minutes, shifts_overlap
        from .distribution import DistributionManager
    except ImportError as e:
        # Fallback logging if everything fails
        print(f"Failed to import required modules in generator.py: {e}")
        logger = logging.getLogger(__name__)


class ScheduleGenerationError(Exception):
    """Custom exception for schedule generation errors"""


class ScheduleGenerator:
    """Generates employee schedules with proper constraints"""

    def __init__(self):
        self.resources = ScheduleResources()
        self.validator = None
        self.distribution_manager = DistributionManager()
        self.schedule = []
        self.schedule_by_date = defaultdict(list)
        self.config = None
        self.version = 1
        self.warnings = []
        self.session_id = None
        self.create_empty_schedules = True
        self.use_fair_distribution = True

    def generate(
        self,
        start_date: date,
        end_date: date,
        version: int = 1,
        session_id: Optional[str] = None,
        use_fair_distribution: bool = True,
    ) -> Dict[str, Any]:
        """Main entry point for schedule generation"""
        try:
            self.version = version
            self.session_id = session_id
            self.schedule = []
            self.schedule_by_date = defaultdict(list)
            self.warnings = []
            self.use_fair_distribution = use_fair_distribution

            # Load resources
            self._log_info("Loading resources for schedule generation")
            self.resources.load()

            # Load settings and create config
            settings = Settings.query.first()
            if not settings:
                self._log_warning("No settings found, using default configuration")
                self.config = ScheduleConfig()
            else:
                self._log_info("Loading configuration from settings")
                self.config = ScheduleConfig.from_settings(settings)

            self.validator = ScheduleValidator(self.resources)

            # Create schedule
            self._log_info(f"Generating schedule from {start_date} to {end_date}")
            self._create_schedule(start_date, end_date)

            # Add empty schedules for all employees if needed
            if hasattr(self, "create_empty_schedules") and self.create_empty_schedules:
                self._log_info(
                    "Adding empty schedules for employees with no assignments"
                )
                self._add_empty_schedules(start_date, end_date)

            # Validate final schedule
            self._log_info("Validating final schedule")
            validation_errors = self.validator.validate(self.schedule, self.config)

            # Format validation errors as warnings
            for error in validation_errors:
                self.warnings.append(
                    {
                        "type": error.severity,
                        "message": error.message,
                        "details": error.details or {},
                    }
                )

            # Create result
            result = self._create_result()
            self._log_info(
                f"Schedule generation complete with {len(self.warnings)} warnings"
            )
            return result

        except Exception as e:
            self._log_error(f"Error generating schedule: {str(e)}")
            raise ScheduleGenerationError(
                f"Failed to generate schedule: {str(e)}"
            ) from e

    def _create_schedule(self, start_date: date, end_date: date) -> None:
        """Create the schedule for the given date range"""
        # Process each date in the range
        for current_date in self._date_range(start_date, end_date):
            self._log_debug(f"Processing date: {current_date}")

            # Skip if store is closed on this date
            if not self._is_store_open(current_date):
                self._log_debug(f"Store is closed on {current_date}, skipping")
                continue

            # Get coverage requirements for this date
            coverages = self.resources.get_daily_coverage(current_date)
            if not coverages:
                self._log_warning(f"No coverage defined for {current_date}")
                continue

            # Process each coverage requirement
            for coverage in coverages:
                self._process_coverage(coverage, current_date, self.version)

    def _process_coverage(
        self, coverage: Coverage, current_date: date, version: int
    ) -> List[Schedule]:
        """Process a coverage requirement for a given date"""
        logger.schedule_logger.info(
            f"Processing coverage for {current_date} {coverage.start_time}-{coverage.end_time}"
        )

        # Find matching shifts for this coverage period
        matching_shifts = self._find_matching_shifts(coverage)

        if not matching_shifts:
            logger.schedule_logger.warning(
                f"No matching shifts found for coverage {coverage.start_time}-{coverage.end_time}"
            )
            return []

        # Sort shifts by priority
        matching_shifts.sort(key=lambda s: self._get_shift_priority(s, current_date))

        # Get available employees for this time slot
        available_employees = self._get_available_employees(
            current_date, coverage.start_time, coverage.end_time
        )

        if not available_employees:
            logger.schedule_logger.warning(
                f"No available employees found for {current_date} {coverage.start_time}-{coverage.end_time}"
            )
            return []

        # Filter for employees with required skills for the coverage
        if coverage.requires_keyholder:
            keyholder_employees = [e for e in available_employees if e.is_keyholder]
            if not keyholder_employees:
                logger.schedule_logger.warning(
                    f"No keyholders available for {current_date} {coverage.start_time}-{coverage.end_time}"
                )
            else:
                # Make sure we have at least one keyholder
                available_employees = [
                    e for e in available_employees if e.is_keyholder
                ] + [e for e in available_employees if not e.is_keyholder]

        # Try to assign enough employees to meet the minimum requirement
        employees_needed = max(coverage.min_employees, 1)
        max_employees = (
            coverage.max_employees or employees_needed * 2
        )  # Use reasonable max if not specified

        # Track assigned employees and schedules
        assigned_employees = set()
        schedules = []

        # Check which employees have already been assigned to other shifts on this date
        already_assigned_employee_ids = set()
        for entry in self.schedule:
            if isinstance(entry, dict):
                if (
                    entry.get("date") == current_date
                    and entry.get("employee_id") is not None
                ):
                    already_assigned_employee_ids.add(entry.get("employee_id"))
            elif hasattr(entry, "date") and hasattr(entry, "employee_id"):
                if entry.date == current_date and entry.employee_id is not None:
                    already_assigned_employee_ids.add(entry.employee_id)

        # Filter out employees who are already assigned to other shifts on this date
        available_employees = [
            e for e in available_employees if e.id not in already_assigned_employee_ids
        ]

        # Sort employees by priority
        available_employees.sort(
            key=lambda e: self._get_employee_priority(e, matching_shifts[0])
        )

        # Try each shift until we have enough employees
        for shift in matching_shifts:
            # Skip if we've assigned enough employees
            if len(assigned_employees) >= min(max_employees, employees_needed):
                break

            # Get employees who can work this shift and haven't been assigned yet
            shift_employees = [
                emp
                for emp in available_employees
                if emp.id not in assigned_employees
                and not self._exceeds_constraints(emp, current_date, shift)
            ]

            # Sort employees by priority for this specific shift
            shift_employees.sort(key=lambda e: self._get_employee_priority(e, shift))

            # Calculate how many more employees we need for this specific shift
            employees_to_add = min(
                employees_needed
                - len(assigned_employees),  # How many we still need to meet minimum
                min(max_employees, len(shift_employees)),  # Don't exceed max allowed
            )

            # Take only as many employees as we need for this shift
            employees_to_assign = shift_employees[:employees_to_add]

            # Create schedule entries for assigned employees
            for employee in employees_to_assign:
                # Determine availability type for this schedule
                availability_type = self._determine_availability_type(
                    employee, shift, current_date
                )

                # Create schedule entry with availability_type
                schedule = Schedule(
                    employee_id=employee.id,
                    date=current_date,
                    shift_id=shift.id,
                    status=ScheduleStatus.DRAFT,
                    version=version,
                    availability_type=availability_type,
                )
                schedules.append(schedule)
                assigned_employees.add(employee.id)
                logger.schedule_logger.info(
                    f"Assigned {employee.first_name} {employee.last_name} "
                    f"to shift {shift.shift_type} on {current_date}"
                )

        # Log warning if we couldn't assign enough employees
        if len(assigned_employees) < employees_needed:
            logger.schedule_logger.warning(
                f"Could only assign {len(assigned_employees)} employees "
                f"(needed {employees_needed}) for {current_date} "
                f"{coverage.start_time}-{coverage.end_time}"
            )

        return schedules

    def _find_matching_shifts(self, coverage: Coverage) -> List[ShiftTemplate]:
        """Find shifts that match the coverage time period"""
        matching_shifts = []

        # First try to find exact matches
        for shift in self.resources.shifts:
            if (
                shift.start_time == coverage.start_time
                and shift.end_time == coverage.end_time
            ):
                matching_shifts.append(shift)

        # If we found exact matches, return them
        if matching_shifts:
            return matching_shifts

        # Next, try to find shifts that specifically cover the closing time
        # This is especially important for late/closing shifts
        if coverage.end_time >= "18:00":  # If this is a closing coverage period
            for shift in self.resources.shifts:
                # Look for shifts that end at the same time as the coverage period
                if shift.end_time == coverage.end_time:
                    matching_shifts.append(shift)
                # Or shifts that extend past the coverage end time
                elif self._time_to_minutes(shift.end_time) >= self._time_to_minutes(
                    coverage.end_time
                ):
                    matching_shifts.append(shift)

        # If we found closing shifts, return them
        if matching_shifts:
            return matching_shifts

        # If still no matches, look for any overlapping shifts
        for shift in self.resources.shifts:
            if self._shifts_overlap(
                shift.start_time,
                shift.end_time,
                coverage.start_time,
                coverage.end_time,
            ):
                matching_shifts.append(shift)

        return matching_shifts

    def _get_available_employees(
        self, current_date: date, start_time: str, end_time: str
    ) -> List[Employee]:
        """Get list of employees available for a given date and time slot"""
        available_employees = []

        for employee in self.resources.employees:
            # Skip inactive employees
            if not employee.is_active:
                continue

            # Skip if employee already has a shift on this date
            if any(
                s.employee_id == employee.id and s.date == current_date
                for s in self.schedule
            ):
                continue

            # Skip if employee has worked too many consecutive days
            if (
                self._count_consecutive_days(employee.id, current_date) >= 6
            ):  # Max 6 consecutive days
                continue

            # Skip if this would exceed weekly hours
            if self._would_exceed_weekly_hours(
                employee.id, current_date, start_time, end_time
            ):
                continue

            # Check employee's availability for this time slot
            employee_availabilities = [
                a
                for a in self.resources.availabilities
                if a.employee_id == employee.id
                and a.day_of_week == current_date.weekday()
                and a.is_available
                and a.availability_type
                in [
                    AvailabilityType.AVAILABLE,
                    AvailabilityType.FIXED,
                    AvailabilityType.PROMISE,
                ]
            ]

            # Convert shift times to hours for comparison
            start_hour = int(start_time.split(":")[0])
            end_hour = int(end_time.split(":")[0])

            # Check if employee is available for any hour during the shift
            is_available = False
            for avail in employee_availabilities:
                if avail.hour >= start_hour and avail.hour < end_hour:
                    is_available = True
                    break

            if is_available:
                available_employees.append(employee)

        # Sort available employees by priority:
        # 1. Keyholders first
        # 2. Higher contracted hours
        # 3. Employee ID for stable sort
        available_employees.sort(
            key=lambda e: (
                0 if e.is_keyholder else 1,
                -e.contracted_hours,  # Higher contracted hours = higher priority
                e.id,  # Stable sort by ID
            )
        )

        return available_employees

    def _exceeds_constraints(
        self,
        employee: Employee,
        current_date: date,
        shift: ShiftTemplate,
    ) -> bool:
        """Check if assigning this shift would exceed employee constraints"""
        # Skip constraints check if employee already has a shift on this date
        if current_date in self.schedule_by_date:
            for existing_entry in self.schedule_by_date[current_date]:
                if existing_entry.employee_id == employee.id:
                    return True

        # Check if employee has enough rest hours between shifts
        if not self._has_enough_rest(employee, shift, current_date):
            return True

        # Skip employee group checks if not enforced
        if (
            hasattr(self.config, "enforce_employee_group_rules")
            and self.config.enforce_employee_group_rules
        ):
            # Check constraints based on employee group
            week_start = self._get_week_start(current_date)

            # Get hours worked in this week excluding this shift
            hours_worked = self._get_weekly_hours(employee.id, week_start)

            # Add hours for this shift
            if hasattr(shift, "duration_hours") and shift.duration_hours:
                shift_hours = shift.duration_hours
            else:
                # Calculate shift duration
                start_minutes = time_to_minutes(shift.start_time)
                end_minutes = time_to_minutes(shift.end_time)
                shift_hours = (end_minutes - start_minutes) / 60

            total_hours = hours_worked + shift_hours

            # Check if adding this shift would exceed weekly hours limit
            if employee.employee_group in self.config.max_hours_per_group:
                max_hours = self.config.max_hours_per_group[employee.employee_group]
                if total_hours > max_hours:
                    return True

            # Get number of shifts worked this week
            shifts_worked = self._count_weekly_shifts(employee.id, week_start)

            # Check if adding this shift would exceed weekly shifts limit
            if employee.employee_group in self.config.max_shifts_per_group:
                max_shifts = self.config.max_shifts_per_group[employee.employee_group]
                if shifts_worked + 1 > max_shifts:
                    return True

        # Check availability only if configured
        if (
            not hasattr(self.config, "enforce_availability")
            or self.config.enforce_availability
        ):
            # Check if employee is available for this shift
            if not self._is_employee_available(employee, current_date, shift):
                return True

        return False

    def _is_employee_available(
        self, employee: Employee, current_date: date, shift: ShiftTemplate
    ) -> bool:
        """Check if employee is available for this shift based on employee availability records"""
        # Find relevant availability records
        availabilities = self.resources.get_employee_availabilities(
            employee.id, current_date
        )

        if not availabilities:
            # No availability records means employee is not explicitly available
            return False

        # Check if employee is available for the entire shift
        shift_start_hour = int(shift.start_time.split(":")[0])
        shift_end_hour = int(shift.end_time.split(":")[0])

        # Adjust end hour if it ends on the hour boundary
        if shift.end_time.endswith(":00") and shift_end_hour > 0:
            shift_end_hour -= 1

        # Check availability for each hour of the shift
        for hour in range(shift_start_hour, shift_end_hour + 1):
            hour_available = False
            for availability in availabilities:
                if availability.hour == hour and availability.is_available:
                    hour_available = True
                    break
            if not hour_available:
                return False

        return True

    def _has_enough_rest(
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

                    rest_hours = self._calculate_rest_hours(
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

                    rest_hours = self._calculate_rest_hours(
                        curr_end_time, next_start_time
                    )

                    # Check if rest hours are sufficient
                    if rest_hours < min_rest_hours:
                        return False

        return True

    def _get_weekly_hours(self, employee_id: int, week_start: date) -> float:
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
                    self._log_warning(
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
                        self._log_warning(
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

    def _count_weekly_shifts(self, employee_id: int, week_start: date) -> int:
        """Count the number of shifts for an employee in the given week"""
        count = 0

        # Check existing schedule entries
        for entry in self.schedule:
            if entry.employee_id == employee_id:
                entry_date = entry.date
                entry_week_start = self._get_week_start(entry_date)

                if entry_week_start == week_start:
                    count += 1

        return count

    def _get_week_start(self, day: date) -> date:
        """Get the start of the week (Monday) for a given date"""
        return day - timedelta(days=day.weekday())

    def _has_required_skills(self, employee: Employee, shift: ShiftTemplate) -> bool:
        """Check if employee has the required skills for the shift"""
        # In a real implementation, this would check actual skills
        # For this simplified version, we'll assume all employees can work all shifts
        return True

    def _shifts_overlap(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        """Check if two shifts overlap in time"""
        return shifts_overlap(start1, end1, start2, end2)

    def _time_to_minutes(self, time_str: str) -> int:
        """Convert a time string (HH:MM) to minutes since midnight"""
        return time_to_minutes(time_str)

    def _is_store_open(self, current_date: date) -> bool:
        """Check if the store is open on the given date"""
        # For simplicity, assume store is closed on Sundays (weekday 6)
        return current_date.weekday() != 6

    def _create_result(self) -> Dict[str, Any]:
        """Create the final result object"""
        schedule_entries = []
        for entry in self.schedule:
            if hasattr(entry, "to_dict") and callable(entry.to_dict):
                schedule_entries.append(entry.to_dict())
            elif isinstance(entry, dict):
                schedule_entries.append(entry)
            else:
                # Skip entries that can't be converted to dict
                continue

        return {
            "schedule": schedule_entries,
            "warnings": self.warnings,
            "version": self.version,
            "generation_time": datetime.now().isoformat(),
        }

    def _date_range(self, start: date, end: date) -> Iterable[date]:
        """Generate a range of dates from start to end (inclusive)"""
        if start is None:
            self._log_error("start date is None in _date_range")
            yield None
            return

        if end is None:
            self._log_error("end date is None in _date_range")
            yield None
            return

        # Debug log
        self._log_debug(f"Generating date range from {start} to {end}")

        current = start
        while current <= end:
            yield current
            current += timedelta(days=1)

    def _log_info(self, message: str) -> None:
        """Log info message"""
        if hasattr(logger, "app_logger"):
            logger.app_logger.info(f"ScheduleGenerator: {message}")
        else:
            logger.info(f"ScheduleGenerator: {message}")

    def _log_debug(self, message: str) -> None:
        """Log debug message"""
        if hasattr(logger, "app_logger"):
            logger.app_logger.debug(f"ScheduleGenerator: {message}")
        else:
            logger.debug(f"ScheduleGenerator: {message}")

    def _log_warning(self, message: str) -> None:
        """Log warning message"""
        if hasattr(logger, "app_logger"):
            logger.app_logger.warning(f"ScheduleGenerator: {message}")
        else:
            logger.warning(f"ScheduleGenerator: {message}")

    def _get_shift_available_employees(self, shift_date, shift_template):
        """Get employees available for the given shift"""
        # Get all employees
        employees = self.resources.employees
        available_employees = []

        for employee in employees:
            # Skip employees who are not active
            if not employee.is_active:
                continue

            # Check if employee is available on this date and time
            if self._is_employee_available(employee, shift_date, shift_template):
                available_employees.append(employee)

        return available_employees

    def _log_error(self, message: str) -> None:
        """Log error message"""
        if hasattr(logger, "app_logger"):
            logger.app_logger.error(f"ScheduleGenerator: {message}")
        else:
            logger.error(f"ScheduleGenerator: {message}")

    def generate_schedule(
        self, start_date, end_date, create_empty_schedules=True, session_id=None
    ) -> Dict[str, Any]:
        """Generate a schedule for the given date range"""
        # Convert to date objects if strings
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)

        # Initialize resources if not done yet
        if not hasattr(self, "resources") or self.resources is None:
            self.resources = ScheduleResources()
            self.resources.load()

        # Log the start of schedule generation
        logger.schedule_logger.info(
            f"Generating schedule from {start_date} to {end_date}"
        )

        # Generate schedule
        result = self.generate(start_date, end_date, session_id=session_id)

        # If no schedules were created but empty schedules are requested
        if create_empty_schedules and not self.schedule:
            self._add_empty_schedules(start_date, end_date)

        # Don't save to database here - let the calling code handle it
        # within the appropriate application context
        # self._save_to_database()

        # Return result with metadata
        return result

    def _add_empty_schedules(self, start_date: date, end_date: date) -> None:
        """Add empty schedule entries for all employees for the given date range"""
        logger.schedule_logger.info(
            f"Adding empty schedules from {start_date} to {end_date}"
        )

        # Get default shift if available
        default_shift = next(iter(self.resources.shifts), None)

        # For each day in the date range
        for current_date in self._date_range(start_date, end_date):
            # Skip if not a work day
            if not self._is_store_open(current_date):
                continue

            # For each employee
            for employee in self.resources.employees:
                # Skip inactive employees
                if not employee.is_active:
                    continue

                # Check if this employee already has a schedule for this date
                existing_entry = next(
                    (
                        s
                        for s in self.schedule
                        if s.employee_id == employee.id and s.date == current_date
                    ),
                    None,
                )

                # If no existing entry, create one
                if not existing_entry:
                    # Find a suitable shift for this employee
                    suitable_shift = None
                    availability_type = AvailabilityType.AVAILABLE.value  # Default

                    # Look for a matching availability to assign an appropriate shift
                    employee_availabilities = [
                        a
                        for a in self.resources.availabilities
                        if a.employee_id == employee.id
                        and a.day_of_week == current_date.weekday()
                        and a.is_available
                    ]

                    if employee_availabilities:
                        # Get the earliest availability period
                        earliest_avail = min(
                            employee_availabilities, key=lambda a: a.hour
                        )
                        earliest_hour = earliest_avail.hour

                        # Check if we can determine availability type
                        if hasattr(earliest_avail, "availability_type"):
                            availability_type = earliest_avail.availability_type.value

                        # Try to find a shift that starts close to this hour
                        for shift in self.resources.shifts:
                            shift_start_hour = int(shift.start_time.split(":")[0])
                            if (
                                abs(shift_start_hour - earliest_hour) <= 1
                            ):  # Within 1 hour
                                suitable_shift = shift
                                break

                    # Use default shift if no suitable shift found
                    if not suitable_shift and default_shift:
                        suitable_shift = default_shift

                    # Create schedule entry
                    schedule_entry = Schedule(
                        employee_id=employee.id,
                        date=current_date,
                        shift_id=suitable_shift.id if suitable_shift else None,
                        status=ScheduleStatus.DRAFT,
                        version=self.version,
                        availability_type=availability_type,
                    )

                    self.schedule.append(schedule_entry)

                    # Add to date-indexed lookup
                    if current_date not in self.schedule_by_date:
                        self.schedule_by_date[current_date] = []
                    self.schedule_by_date[current_date].append(schedule_entry)

    def _save_to_database(self) -> None:
        """Save all schedule entries to the database"""
        try:
            # First, check if there are any existing entries in the same date range and version
            # that need to be deleted or updated
            if self.schedule:
                min_date = min(
                    entry.date for entry in self.schedule if hasattr(entry, "date")
                )
                max_date = max(
                    entry.date for entry in self.schedule if hasattr(entry, "date")
                )

                self._log_info(
                    f"Checking for existing entries from {min_date} to {max_date} with version {self.version}"
                )

                # Delete existing entries for this date range and version
                existing_entries = Schedule.query.filter(
                    Schedule.date >= min_date,
                    Schedule.date <= max_date,
                    Schedule.version == self.version,
                ).all()

                if existing_entries:
                    self._log_info(
                        f"Deleting {len(existing_entries)} existing schedule entries for version {self.version}"
                    )
                    for entry in existing_entries:
                        db.session.delete(entry)
                    db.session.commit()
                    self._log_info("Deleted existing entries successfully")

                # Add all entries to the database
                entry_count = 0
                for entry in self.schedule:
                    db.session.add(entry)
                    entry_count += 1

                # Log the number of entries being added
                self._log_info(
                    f"Adding {entry_count} new schedule entries for version {self.version}"
                )

                # Commit the transaction
                db.session.commit()
                self._log_info(
                    f"Successfully saved {entry_count} schedule entries to database"
                )
        except Exception as e:
            # If something goes wrong, rollback the transaction
            db.session.rollback()
            self._log_error(f"Error saving schedule to database: {str(e)}")
            raise ScheduleGenerationError(
                f"Failed to save schedule to database: {str(e)}"
            ) from e

    def _count_consecutive_days(self, employee_id: int, current_date: date) -> int:
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

    def _would_exceed_weekly_hours(
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
                    weekly_hours += entry_shift.duration_hours

        # Add hours from the new shift
        weekly_hours += self._calculate_shift_duration(start_time, end_time)

        # Get maximum weekly hours based on employee group
        max_hours = self.config.max_hours_per_group.get(
            employee_id,
            40.0,  # Default to 40 hours if not specified
        )

        return weekly_hours > max_hours

    def _calculate_shift_duration(self, start_time: str, end_time: str) -> float:
        """Calculate the duration of a shift"""
        start_hour = int(start_time.split(":")[0])
        end_hour = int(end_time.split(":")[0])
        return (end_hour - start_hour) / 60.0

    def _get_shift_priority(self, shift: ShiftTemplate, current_date: date) -> int:
        """Get priority for shift scheduling (keyholder shifts first, then closing shifts)"""
        # Get all coverage requirements for this day
        day_coverage = [
            c for c in self.resources.coverage if c.day_index == current_date.weekday()
        ]

        # Look for exact coverage match first
        exact_coverage = next(
            (
                c
                for c in day_coverage
                if c.start_time == shift.start_time and c.end_time == shift.end_time
            ),
            None,
        )

        if exact_coverage:
            # Prioritize shifts that require keyholders
            if exact_coverage.requires_keyholder:
                return 0
            # Then prioritize shifts with higher minimum employee requirements
            return (
                -exact_coverage.min_employees
            )  # Negative so higher min_employees = higher priority

        # Check if this is a late/closing shift (ending at or after 18:00)
        is_closing_shift = self._time_to_minutes(
            shift.end_time
        ) >= self._time_to_minutes("18:00")

        # Find any coverage that overlaps with this shift
        overlapping_coverage = []
        for cov in day_coverage:
            if self._shifts_overlap(
                shift.start_time, shift.end_time, cov.start_time, cov.end_time
            ):
                overlapping_coverage.append(cov)

        if overlapping_coverage:
            # For closing shifts, prioritize them for afternoon/evening coverage
            late_coverage = [c for c in overlapping_coverage if c.end_time >= "18:00"]
            if is_closing_shift and late_coverage:
                return 10  # Priority for closing shifts for late coverage periods

            # If not closing shift but covers some coverage, medium priority
            return 50

        # Lowest priority for shifts without any coverage overlap
        return 999

    def _get_employee_priority(self, employee: Employee, shift: ShiftTemplate) -> int:
        """Get priority for employee scheduling (keyholders first)"""
        # Prioritize keyholders
        if employee.is_keyholder:
            return 0

        # Then prioritize employees with higher contracted hours
        return (
            -employee.contracted_hours
        )  # Negative so higher contracted hours = higher priority

    def _get_best_employee_by_availability(
        self, available_employees, shift_template, shift_date
    ):
        """Select the best employee based on availability and priority"""
        if not available_employees:
            return None

        # Sort by priority
        sorted_employees = sorted(
            available_employees,
            key=lambda emp: self._get_employee_priority(emp, shift_template),
        )

        # Return the highest priority employee
        return sorted_employees[0] if sorted_employees else None

    def _calculate_rest_hours(self, end_time: str, start_time: str) -> float:
        """Calculate the rest hours between two shifts"""
        end_hour = int(end_time.split(":")[0])
        start_hour = int(start_time.split(":")[0])
        return (start_hour - end_hour) / 60.0

    def _calculate_shift_template_duration(self, shift_template):
        """Calculate shift duration in minutes from shift template"""
        try:
            return time_to_minutes(shift_template.end_time) - time_to_minutes(
                shift_template.start_time
            )
        except Exception as e:
            self._log_error(f"Error calculating shift duration: {str(e)}")
            return 0

    def _initialize_schedule_generation(self, start_date, end_date):
        """Initialize the schedule generation process"""
        self._log_info(
            f"Initializing schedule generation from {start_date} to {end_date}"
        )

        # Create the validator with appropriate settings
        self.validator = ScheduleValidator(self.resources)

        # Initialize configuration from settings using the initialize_config_from_settings method
        self._initialize_config_from_settings()

        # Initialize the distribution manager if fair distribution is enabled
        if self.use_fair_distribution:
            self._log_info(
                "Initializing distribution manager for fair shift allocation"
            )
            historical_data = self._get_historical_schedules()
            self.distribution_manager.initialize(
                self.resources.employees, historical_data
            )

    def _get_historical_schedules(self):
        """Retrieve historical schedule data for distribution analysis"""
        try:
            # Get schedules from the last 3 months
            three_months_ago = datetime.now().date() - timedelta(days=90)
            historical_entries = (
                db.session.query(Schedule)
                .filter(Schedule.date >= three_months_ago)
                .all()
            )

            self._log_info(
                f"Retrieved {len(historical_entries)} historical schedule entries for distribution analysis"
            )
            return historical_entries
        except Exception as e:
            self._log_warning(f"Could not retrieve historical schedule data: {str(e)}")
            return []

    def _get_best_employee_by_availability(
        self, available_employees, shift_template, shift_date
    ):
        """Get the best employee based on availability and priority"""
        if not available_employees:
            return None
        # Sort employees by priority
        available_employees.sort(
            key=lambda e: self._get_employee_priority(e, shift_template)
        )
        # Return the highest priority employee
        return available_employees[0] if available_employees else None

    def _get_best_employee_for_shift(
        self, shift_template, shift_date, scheduled_employees
    ):
        """Get the best employee for a given shift based on constraints and fairness"""
        available_employees = self._get_available_employees(
            shift_date, shift_template.start_time, shift_template.end_time
        )

        # Filter out already scheduled employees for this shift
        available_employees = [
            e for e in available_employees if e.id not in scheduled_employees
        ]

        if not available_employees:
            return None

        # If fair distribution is disabled, use original method
        if not self.use_fair_distribution:
            return self._get_best_employee_by_availability(
                available_employees, shift_template, shift_date
            )

        # Get the best employee based on fair distribution
        return self._get_best_employee_by_distribution(
            available_employees, shift_template, shift_date
        )

    def _get_best_employee_by_distribution(
        self, available_employees, shift_template, shift_date
    ):
        """Select the best employee based on distribution metrics"""
        if not available_employees:
            return None

        # Get current schedule context for week
        week_start = shift_date - timedelta(days=shift_date.weekday())
        week_end = week_start + timedelta(days=6)
        weekly_context = self._get_weekly_schedule_context(week_start, week_end)

        # Calculate scores for each employee
        employee_scores = []
        for employee in available_employees:
            # Skip if not qualified for the shift
            if not self._is_employee_qualified(employee, shift_template):
                continue

            # Check if assigning this shift would violate constraints
            if not self._can_assign_shift(employee, shift_template, shift_date):
                continue

            # Calculate assignment score from distribution manager
            score = self.distribution_manager.calculate_assignment_score(
                employee.id, shift_template, shift_date, context=weekly_context
            )

            employee_scores.append((employee, score))

        # Sort by score (lower is better)
        employee_scores.sort(key=lambda x: x[1])

        if not employee_scores:
            return None

        # Log assignment decision for debugging
        best_employee, score = employee_scores[0]
        self._log_info(
            f"Selected employee {best_employee.id} for shift on {shift_date} with score {score:.2f}"
        )

        return best_employee

    def _get_weekly_schedule_context(self, week_start, week_end):
        """Get context information about the current schedule for this week"""
        context = {
            "weekly_hours": defaultdict(float),
            "weekly_shifts": defaultdict(int),
            "shift_types": defaultdict(lambda: defaultdict(int)),
        }

        # Collect information from already scheduled shifts in this period
        for day in self.schedule_by_date:
            if week_start <= day <= week_end:
                for assignment in self.schedule_by_date[day]:
                    employee_id = assignment["employee_id"]
                    shift = assignment["shift_template"]

                    # Track weekly hours
                    # Calculate shift duration
                    if hasattr(self.resources, "calculate_shift_duration"):
                        duration = self.resources.calculate_shift_duration(shift)
                    else:
                        duration = self._calculate_shift_template_duration(shift)
                    context["weekly_hours"][employee_id] += duration

                    # Track weekly shift count
                    context["weekly_shifts"][employee_id] += 1

                    # Track shift types
                    # Categorize shift based on time of day
                    shift_category = self._categorize_shift(shift, day)
                    context["shift_types"][employee_id][shift_category] += 1

        return context

    def _is_employee_qualified(self, employee, shift_template):
        """Check if employee is qualified for the given shift template"""
        # Check if employee has required roles/skills for this shift
        if (
            shift_template.required_role
            and shift_template.required_role not in employee.roles
        ):
            return False

        # Check if employee is keyholder if required
        if shift_template.requires_keyholder and not employee.is_keyholder:
            return False

        # Check if employee has required skills for the shift
        if hasattr(self, "_has_required_skills"):
            return self._has_required_skills(employee, shift_template)

        return True

    def _can_assign_shift(self, employee, shift_template, shift_date):
        """Check if employee can be assigned to the specified shift"""
        # Check if employee is available and qualified
        if not self._is_employee_available(employee, shift_date, shift_template):
            return False

        if not self._is_employee_qualified(employee, shift_template):
            return False

        # Check if employee has other shifts on this date
        employee_shifts = self._get_employee_shifts_for_date(employee, shift_date)

        # Check for overlapping shifts
        for existing_shift in employee_shifts:
            if shifts_overlap(existing_shift, shift_template):
                return False

        # Check if assignment would exceed constraints
        if hasattr(self, "_exceeds_constraints") and self._exceeds_constraints(
            employee, shift_date, shift_template
        ):
            return False

        return True

    def _categorize_shift(self, shift, day):
        """Categorize a shift based on time of day (morning, afternoon, evening)"""
        # Extract hour from start time
        start_hour = int(shift.start_time.split(":")[0])

        # Categorize based on start hour
        if start_hour < 12:
            return "morning"
        elif start_hour < 16:
            return "afternoon"
        else:
            return "evening"

    def _assign_employee_to_shift(self, employee, shift_template, shift_date):
        """Assign an employee to a shift and update all tracking data"""
        # Determine availability_type based on employee availabilities
        availability_type = self._determine_availability_type(
            employee, shift_template, shift_date
        )

        # If employee is unavailable for this shift, don't assign
        if availability_type == AvailabilityType.UNAVAILABLE.value:
            self._log_info(
                f"Employee {employee.first_name} {employee.last_name} is unavailable "
                f"for shift {shift_template.id} on {shift_date}"
            )
            return None

        # Create the shift entry
        shift_entry = {
            "employee_id": employee.id,
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "shift_template_id": shift_template.id,
            "shift_template": shift_template,
            "date": shift_date,
            "availability_type": availability_type,
        }

        # Add to schedule
        self.schedule.append(shift_entry)
        self.schedule_by_date[shift_date].append(shift_entry)

        # Update distribution manager if using fair distribution
        if self.use_fair_distribution:
            self.distribution_manager.update_with_assignment(
                employee.id, shift_template, shift_date
            )

        return shift_entry

    def _determine_availability_type(self, employee, shift_template, shift_date):
        """Determine the availability type for a schedule based on employee availabilities"""
        # Get employee availabilities for this day and shift hours
        availabilities = self.resources.get_employee_availabilities(
            employee.id, shift_date
        )

        if not availabilities:
            return AvailabilityType.AVAILABLE.value

        # Check availabilities for the shift hours
        shift_start_hour = int(shift_template.start_time.split(":")[0])
        shift_end_hour = int(shift_template.end_time.split(":")[0])

        # Adjust end hour if it ends on the hour boundary
        if shift_template.end_time.endswith(":00") and shift_end_hour > 0:
            shift_end_hour -= 1

        # Count availability types for the shift hours
        type_counts = {
            AvailabilityType.FIXED.value: 0,
            AvailabilityType.PROMISE.value: 0,
            AvailabilityType.AVAILABLE.value: 0,
            AvailabilityType.UNAVAILABLE.value: 0,  # Add UNAVAILABLE type
        }

        # Check each hour in the shift
        for hour in range(shift_start_hour, shift_end_hour + 1):
            for avail in availabilities:
                if avail.hour == hour:
                    # Check both is_available flag and availability_type
                    is_unavailable = (
                        not avail.is_available
                        or avail.availability_type.value
                        == AvailabilityType.UNAVAILABLE.value
                    )

                    if is_unavailable:
                        type_counts[AvailabilityType.UNAVAILABLE.value] += 1
                        break
                    else:
                        # If available, count the specific type
                        avail_type = avail.availability_type.value
                        type_counts[avail_type] += 1
                        break

        # If any hour is unavailable, the whole shift should be considered unavailable
        if type_counts[AvailabilityType.UNAVAILABLE.value] > 0:
            return AvailabilityType.UNAVAILABLE.value

        # Determine dominant type (give priority to FIX > PRM > AVL)
        if type_counts[AvailabilityType.FIXED.value] > 0:
            return AvailabilityType.FIXED.value
        elif type_counts[AvailabilityType.PROMISE.value] > 0:
            return AvailabilityType.PROMISE.value
        else:
            return AvailabilityType.AVAILABLE.value

    def get_distribution_metrics(self):
        """Get metrics about shift distribution fairness"""
        if not self.use_fair_distribution:
            return {
                "error": "Fair distribution not enabled for this schedule generation"
            }

        return self.distribution_manager.get_distribution_metrics()
