from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Iterable
from models import Employee, ShiftTemplate, Schedule, Coverage, db
from models.schedule import ScheduleStatus
from utils.logger import logger
from .resources import ScheduleResources
from .validator import ScheduleValidator, ScheduleConfig
from .utility import requires_keyholder, time_to_minutes, shifts_overlap
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

            # Save schedule entries to database
            self._log_info("Saving schedule entries to database")
            self._save_to_database()

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
        if requires_keyholder(shift):
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
            schedule_entry.version = self.version

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
        # Check if shift is None or missing duration_hours
        if shift is None:
            self._log_warning(
                f"Received None shift when checking constraints for employee {employee.id}"
            )
            return True

        if not hasattr(shift, "duration_hours") or shift.duration_hours is None:
            self._log_warning(
                f"Shift {getattr(shift, 'id', 'unknown')} has no duration_hours attribute"
            )
            return True

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

    def _has_enough_rest(
        self, employee: Employee, current_date: date, shift: ShiftTemplate
    ) -> bool:
        """Check if employee has enough rest time before this shift"""
        # Validate inputs
        if shift is None:
            self._log_warning(
                f"Received None shift when checking rest for employee {employee.id}"
            )
            return False

        if not hasattr(shift, "start_time") or not hasattr(shift, "end_time"):
            self._log_warning(
                f"Shift {getattr(shift, 'id', 'unknown')} missing start/end time"
            )
            return False

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

        # Validate previous entry has a valid shift
        if not hasattr(prev_entry, "shift") or prev_entry.shift is None:
            self._log_warning(f"Previous entry for employee {employee.id} has no shift")
            return True  # Can't enforce rest without a previous shift

        if not hasattr(prev_entry.shift, "start_time") or not hasattr(
            prev_entry.shift, "end_time"
        ):
            self._log_warning(
                f"Previous shift for employee {employee.id} missing start/end time"
            )
            return True  # Can't enforce rest without times

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
            try:
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
            except (ValueError, TypeError, IndexError) as e:
                self._log_warning(f"Error calculating rest hours: {str(e)}")
                # If we can't calculate rest hours properly, assume rest is enough
                return True

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
        # Ensure start_date and end_date are date objects
        if start_date is None:
            self._log_error("start_date cannot be None")
            raise ScheduleGenerationError("start_date is required and cannot be None")

        if end_date is None:
            self._log_error("end_date cannot be None")
            raise ScheduleGenerationError("end_date is required and cannot be None")

        # Convert string dates to date objects if needed
        if isinstance(start_date, str):
            try:
                start_date = datetime.fromisoformat(start_date).date()
            except ValueError:
                self._log_error(f"Invalid start_date format: {start_date}")
                raise ScheduleGenerationError(
                    f"Invalid start_date format: {start_date}"
                )

        if isinstance(end_date, str):
            try:
                end_date = datetime.fromisoformat(end_date).date()
            except ValueError:
                self._log_error(f"Invalid end_date format: {end_date}")
                raise ScheduleGenerationError(f"Invalid end_date format: {end_date}")

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
        active_employees = self.resources.get_active_employees()

        # Loop through each date in the range
        current_date = start_date
        while current_date <= end_date:
            # Get existing assignments for this date
            existing_assignments = self.schedule_by_date.get(current_date, [])
            assigned_employee_ids = {
                entry.employee_id for entry in existing_assignments
            }

            # Create empty schedule entries for unassigned employees
            for employee in active_employees:
                if employee.id not in assigned_employee_ids:
                    empty_schedule = Schedule(
                        employee_id=employee.id, date=current_date, shift_id=None
                    )
                    empty_schedule.status = ScheduleStatus.DRAFT
                    empty_schedule.version = self.version

                    # Add to our schedule collections
                    self.schedule.append(empty_schedule)
                    self.schedule_by_date[current_date].append(empty_schedule)

            # Move to next date
            current_date += timedelta(days=1)

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

                # Add all entries to the database
                for entry in self.schedule:
                    db.session.add(entry)

                # Commit the transaction
                db.session.commit()
                self._log_info(
                    f"Successfully saved {len(self.schedule)} schedule entries to database"
                )
        except Exception as e:
            # If something goes wrong, rollback the transaction
            db.session.rollback()
            self._log_error(f"Error saving schedule to database: {str(e)}")
            raise ScheduleGenerationError(
                f"Failed to save schedule to database: {str(e)}"
            )
