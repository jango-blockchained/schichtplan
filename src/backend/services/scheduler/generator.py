from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Iterable
from models import Employee, ShiftTemplate, Schedule, Coverage
from models.schedule import ScheduleStatus
from utils.logger import logger
from .resources import ScheduleResources
from .validator import ScheduleValidator, ScheduleConfig
from collections import defaultdict


class ScheduleGenerationError(Exception):
    """Custom exception for schedule generation errors"""

    pass


class ScheduleGenerator:
    """Generates employee schedules with proper constraints"""

    def __init__(self):
        self.resources = ScheduleResources()
        self.validator = None
        self.schedule = []
        self.schedule_by_date = defaultdict(list)
        self.config = ScheduleConfig()
        self.version = 1
        self.warnings = []
        self.session_id = None
        self.create_empty_schedules = True

    def generate(
        self,
        start_date: date,
        end_date: date,
        version: int = 1,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Main entry point for schedule generation"""
        try:
            self.version = version
            self.session_id = session_id
            self.schedule = []
            self.schedule_by_date = defaultdict(list)
            self.warnings = []

            # Load resources
            self._log_info("Loading resources for schedule generation")
            self.resources.load()
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
                        "type": error.error_type,
                        "message": error.message,
                        "severity": error.severity,
                        "details": error.details or {},
                    }
                )

            # Generate report
            result = self._create_result()
            self._log_info(
                f"Schedule generation complete with {len(self.schedule)} assignments and {len(self.warnings)} warnings"
            )
            return result

        except Exception as e:
            self._log_error(f"Schedule generation failed: {str(e)}")
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
                self._process_coverage(current_date, coverage)

    def _process_coverage(self, current_date: date, coverage: Coverage) -> None:
        """Process a single coverage requirement"""
        self._log_debug(
            f"Processing coverage for {current_date}: {coverage.start_time}-{coverage.end_time}"
        )

        # Find suitable shifts for this coverage
        shifts = self._find_matching_shifts(coverage)
        if not shifts:
            self._log_warning(
                f"No matching shifts found for coverage {coverage.start_time}-{coverage.end_time}"
            )
            return

        # Get available employees for this time slot
        shift = shifts[0]  # Use the first matching shift
        employees = self._get_available_employees(current_date, shift)
        if not employees:
            self._log_warning(
                f"No available employees for {current_date} {shift.start_time}-{shift.end_time}"
            )
            return

        # Assign employees based on coverage requirements
        self._assign_employees(current_date, shift, employees, coverage.min_employees)

    def _find_matching_shifts(self, coverage: Coverage) -> List[ShiftTemplate]:
        """Find shifts that match the coverage time period"""
        matching_shifts = []

        for shift in self.resources.shifts:
            # Check for exact matches first
            if (
                shift.start_time == coverage.start_time
                and shift.end_time == coverage.end_time
            ):
                matching_shifts.append(shift)

        # If no exact matches, look for overlapping shifts
        if not matching_shifts:
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
        self, current_date: date, shift: ShiftTemplate
    ) -> List[Employee]:
        """Get employees available for the given shift on the specified date"""
        available_employees = []

        for employee in self.resources.employees:
            # Check if employee is available
            start_hour = int(shift.start_time.split(":")[0])
            end_hour = int(shift.end_time.split(":")[0])

            if self.resources.is_employee_available(
                employee.id, current_date, start_hour, end_hour
            ):
                # Check if employee doesn't exceed max hours/shifts
                if not self._exceeds_constraints(employee, current_date, shift):
                    # Check if employee has required skills for the shift
                    if self._has_required_skills(employee, shift):
                        # Check if this assignment wouldn't violate rest periods
                        if self._has_enough_rest(employee, current_date, shift):
                            available_employees.append(employee)

        # Prioritize keyholders for shifts that require them
        if getattr(shift, "requires_keyholder", False):
            keyholders = [e for e in available_employees if e.is_keyholder]
            non_keyholders = [e for e in available_employees if not e.is_keyholder]
            available_employees = keyholders + non_keyholders

        return available_employees

    def _assign_employees(
        self,
        current_date: date,
        shift: ShiftTemplate,
        employees: List[Employee],
        min_count: int,
    ) -> None:
        """Assign employees to a shift"""
        assigned_count = 0

        for employee in employees:
            if assigned_count >= min_count:
                break

            # Create schedule entry
            schedule_entry = Schedule(
                employee_id=employee.id, shift_id=shift.id, date=current_date
            )

            # Manually set status instead of using constructor
            schedule_entry.status = ScheduleStatus.DRAFT

            # Add to our schedule collections
            self.schedule.append(schedule_entry)
            self.schedule_by_date[current_date].append(schedule_entry)

            self._log_debug(
                f"Assigned {employee.first_name} {employee.last_name} to shift {shift.id} on {current_date}"
            )
            assigned_count += 1

    def _exceeds_constraints(
        self, employee: Employee, current_date: date, shift: ShiftTemplate
    ) -> bool:
        """Check if this assignment would exceed employee constraints"""
        # Check weekly hours
        week_start = self._get_week_start(current_date)
        weekly_hours = self._get_weekly_hours(employee.id, week_start)

        max_weekly_hours = self.config.max_hours_per_group.get(
            employee.employee_group,
            40,  # Default to 40 if not specified
        )

        if weekly_hours + shift.duration_hours > max_weekly_hours:
            return True

        # Check max shifts per week
        weekly_shifts = self._count_weekly_shifts(employee.id, week_start)

        max_shifts = self.config.max_shifts_per_group.get(
            employee.employee_group,
            5,  # Default to 5 if not specified
        )

        if weekly_shifts >= max_shifts:
            return True

        return False

    def _get_weekly_hours(self, employee_id: int, week_start: date) -> float:
        """Calculate total scheduled hours for an employee in the given week"""
        total_hours = 0.0

        # Check existing schedule entries
        for entry in self.schedule:
            if entry.employee_id == employee_id:
                entry_date = entry.date
                entry_week_start = self._get_week_start(entry_date)

                if entry_week_start == week_start:
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

    def _has_enough_rest(
        self, employee: Employee, current_date: date, shift: ShiftTemplate
    ) -> bool:
        """Check if employee has enough rest time before this shift"""
        min_rest_hours = self.config.min_rest_hours

        # Get previous assignment for this employee
        prev_entry = None
        for entry in self.schedule:
            if entry.employee_id == employee.id:
                entry_date = entry.date
                if entry_date <= current_date and (
                    prev_entry is None or entry_date > prev_entry.date
                ):
                    prev_entry = entry

        if prev_entry is None:
            return True  # No previous assignment

        # Calculate rest time
        if prev_entry.date == current_date:
            # Same day - check for shift overlap
            if self._shifts_overlap(
                prev_entry.shift.start_time,
                prev_entry.shift.end_time,
                shift.start_time,
                shift.end_time,
            ):
                return False
        else:
            # Different days - calculate rest period
            # Extract time components carefully
            prev_end_hour, prev_end_minute = map(
                int, prev_entry.shift.end_time.split(":")
            )
            current_start_hour, current_start_minute = map(
                int, shift.start_time.split(":")
            )

            # Calculate the datetime objects
            prev_end_dt = datetime(
                prev_entry.date.year,
                prev_entry.date.month,
                prev_entry.date.day,
                prev_end_hour,
                prev_end_minute,
            )

            current_start_dt = datetime(
                current_date.year,
                current_date.month,
                current_date.day,
                current_start_hour,
                current_start_minute,
            )

            # Calculate rest hours
            rest_seconds = (current_start_dt - prev_end_dt).total_seconds()
            rest_hours = rest_seconds / 3600

            if rest_hours < min_rest_hours:
                return False

        return True

    def _shifts_overlap(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        """Check if two time periods overlap"""
        # Convert to minutes for easier comparison
        start1_mins = self._time_to_minutes(start1)
        end1_mins = self._time_to_minutes(end1)
        start2_mins = self._time_to_minutes(start2)
        end2_mins = self._time_to_minutes(end2)

        return max(start1_mins, start2_mins) < min(end1_mins, end2_mins)

    def _time_to_minutes(self, time_str: str) -> int:
        """Convert a time string (HH:MM) to minutes"""
        parts = time_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])

    def _is_store_open(self, current_date: date) -> bool:
        """Check if the store is open on the given date"""
        # For simplicity, assume store is closed on Sundays (weekday 6)
        return current_date.weekday() != 6

    def _create_result(self) -> Dict[str, Any]:
        """Create the final result object"""
        return {
            "schedule": [entry.to_dict() for entry in self.schedule],
            "warnings": self.warnings,
            "version": self.version,
            "generation_time": datetime.now().isoformat(),
        }

    def _date_range(self, start: date, end: date) -> Iterable[date]:
        """Generate a range of dates from start to end (inclusive)"""
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

    def _log_error(self, message: str) -> None:
        """Log error message"""
        if hasattr(logger, "app_logger"):
            logger.app_logger.error(f"ScheduleGenerator: {message}")
        else:
            logger.error(f"ScheduleGenerator: {message}")

    def generate_schedule(
        self, start_date, end_date, create_empty_schedules=True, session_id=None
    ) -> Dict[str, Any]:
        """Compatibility method that calls generate to maintain API compatibility"""
        # Pass create_empty_schedules to the generate method
        self.create_empty_schedules = create_empty_schedules
        return self.generate(
            start_date=start_date,
            end_date=end_date,
            version=self.version,
            session_id=session_id,
        )

    def _add_empty_schedules(self, start_date: date, end_date: date) -> None:
        """Add empty schedule entries for all employees who don't have assignments for each day"""
        # Get all active employees
        employees = self.resources.get_active_employees()

        # Process each date in the range
        for current_date in self._date_range(start_date, end_date):
            # Get all employee IDs that already have a shift on this day
            employee_ids_with_shifts = {
                entry.get("employee_id")
                for entry in self.schedule
                if entry.get("date") == current_date.isoformat()
            }

            # Add empty shifts for employees without assignments on this day
            for employee in employees:
                if employee.id not in employee_ids_with_shifts:
                    employee_name = f"{employee.first_name} {employee.last_name}"
                    if hasattr(employee, "employee_group") and employee.employee_group:
                        try:
                            employee_name += f" ({employee.employee_group.value})"
                        except:
                            # If employee_group.value doesn't exist, just use the string representation
                            employee_name += f" ({str(employee.employee_group)})"

                    # Create and add the empty schedule entry
                    entry = {
                        "employee_id": employee.id,
                        "employee_name": employee_name,
                        "date": current_date.isoformat(),
                        "shift_id": None,
                        "start_time": None,
                        "end_time": None,
                        "duration_hours": 0.0,
                        "is_empty": True,
                    }
                    self.schedule.append(entry)
                    self._log_debug(
                        f"Added empty entry for {employee_name} on {current_date}"
                    )
