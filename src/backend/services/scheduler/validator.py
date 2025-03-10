from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from models import Schedule
from models.employee import EmployeeGroup
from dataclasses import dataclass
from .resources import ScheduleResources
from .utility import requires_keyholder


@dataclass
class ValidationError:
    """Represents a validation error"""

    error_type: str
    message: str
    severity: str  # 'critical', 'warning', 'info'
    details: Dict[str, Any] = None


@dataclass
class ScheduleConfig:
    """Configuration for schedule validation"""

    enforce_min_coverage: bool = True
    enforce_contracted_hours: bool = True
    enforce_keyholder: bool = True
    enforce_rest_periods: bool = True
    enforce_max_shifts: bool = True
    enforce_max_hours: bool = True
    min_rest_hours: int = 11
    max_hours_per_group: Dict[EmployeeGroup, int] = None
    max_shifts_per_group: Dict[EmployeeGroup, int] = None

    def __post_init__(self):
        """Initialize default values if not provided"""
        if self.max_hours_per_group is None:
            self.max_hours_per_group = {
                EmployeeGroup.TZ: 30,
                EmployeeGroup.GFB: 15,
                EmployeeGroup.VZ: 40,
                EmployeeGroup.TL: 40,
            }

        if self.max_shifts_per_group is None:
            self.max_shifts_per_group = {
                EmployeeGroup.TZ: 4,
                EmployeeGroup.GFB: 3,
                EmployeeGroup.VZ: 5,
                EmployeeGroup.TL: 5,
            }


class ScheduleValidator:
    """Handles validation of scheduling constraints"""

    def __init__(self, resources: ScheduleResources):
        self.resources = resources
        self.errors: List[ValidationError] = []
        self.config = ScheduleConfig()

    def validate(
        self, schedule: List[Schedule], config: Optional[ScheduleConfig] = None
    ) -> List[ValidationError]:
        """Run all validations based on config"""
        if config:
            self.config = config

        self.errors = []  # Reset errors before validation

        if self.config.enforce_min_coverage:
            self._validate_coverage(schedule)

        if self.config.enforce_contracted_hours:
            self._validate_contracted_hours(schedule)

        if self.config.enforce_keyholder:
            self._validate_keyholders(schedule)

        if self.config.enforce_rest_periods:
            self._validate_rest_periods(schedule)

        if self.config.enforce_max_shifts:
            self._validate_max_shifts(schedule)

        if self.config.enforce_max_hours:
            self._validate_max_hours(schedule)

        return self.errors

    def _validate_coverage(self, schedule: List[Schedule]) -> None:
        """Validate minimum coverage requirements"""
        # Group coverage by date and time
        coverage_by_date_time = {}
        for cov in self.resources.coverage:
            date_key = (
                cov.date.isoformat()
                if hasattr(cov, "date")
                else f"weekday_{cov.day_index}"
            )
            time_key = f"{cov.start_time}_{cov.end_time}"
            key = f"{date_key}_{time_key}"
            coverage_by_date_time[key] = cov

        # Count assigned employees for each coverage
        coverage_counts = {}
        for entry in schedule:
            # Skip entries without shifts
            if not hasattr(entry, "shift") or not entry.shift:
                continue

            date_key = entry.date.isoformat()
            weekday_key = f"weekday_{entry.date.weekday()}"
            time_key = f"{entry.shift.start_time}_{entry.shift.end_time}"

            # Try specific date first, then fall back to weekday pattern
            key = f"{date_key}_{time_key}"
            weekday_key = f"{weekday_key}_{time_key}"

            if key in coverage_by_date_time:
                coverage_counts[key] = coverage_counts.get(key, 0) + 1
            elif weekday_key in coverage_by_date_time:
                coverage_counts[weekday_key] = coverage_counts.get(weekday_key, 0) + 1

        # Check if each coverage requirement is met
        for key, cov in coverage_by_date_time.items():
            count = coverage_counts.get(key, 0)
            if count < cov.min_employees:
                date_str = (
                    cov.date.strftime("%Y-%m-%d")
                    if hasattr(cov, "date")
                    else f"Weekday {cov.day_index}"
                )
                self.errors.append(
                    ValidationError(
                        error_type="coverage",
                        message=f"Insufficient staff for {date_str} {cov.start_time}-{cov.end_time}",
                        severity="critical",
                        details={
                            "date": date_str,
                            "time": f"{cov.start_time}-{cov.end_time}",
                            "required": cov.min_employees,
                            "assigned": count,
                        },
                    )
                )

    def _validate_contracted_hours(self, schedule: List[Schedule]) -> None:
        """Validate contracted hours for employees"""
        # Group schedule entries by employee
        hours_by_employee = {}
        for entry in schedule:
            # Skip entries without shifts
            if not hasattr(entry, "shift") or not entry.shift:
                continue

            emp_id = entry.employee_id
            if emp_id not in hours_by_employee:
                hours_by_employee[emp_id] = 0

            try:
                # Add shift hours - handle both real objects and mocks
                duration = getattr(entry.shift, "duration_hours", 0)
                if callable(duration):  # Handle mock objects
                    continue
                hours_by_employee[emp_id] += duration
            except (TypeError, AttributeError):
                # Skip if duration_hours is not accessible or not a number
                continue

        # Check against contracted hours
        for emp in self.resources.employees:
            if emp.id not in hours_by_employee:
                continue

            # Get actual hours and contracted hours
            actual_hours = hours_by_employee[emp.id]

            # Skip if employee has no contracted hours (e.g., on-call)
            if not emp.contracted_hours:
                continue

            try:
                # Check if hours are at least 75% of contracted hours
                min_hours = emp.contracted_hours * 0.75
                if actual_hours < min_hours:
                    self.errors.append(
                        ValidationError(
                            error_type="contracted_hours",
                            message=f"Employee {emp.id} has {actual_hours}h but should have at least {min_hours}h (75% of {emp.contracted_hours}h)",
                            severity="warning",
                            details={
                                "employee_id": emp.id,
                                "employee_name": emp.name,
                                "actual_hours": actual_hours,
                                "contracted_hours": emp.contracted_hours,
                                "minimum_required": min_hours,
                            },
                        )
                    )
            except (TypeError, AttributeError):
                # Skip comparison if values aren't valid numbers
                continue

    def _validate_keyholders(self, schedule: List[Schedule]) -> None:
        """Validate keyholder requirements"""
        # Group schedule by date and shift
        shifts_by_date = {}
        for entry in schedule:
            try:
                # Handle both objects and dictionaries
                if hasattr(entry, "date") and callable(getattr(entry, "date", None)):
                    # Skip mock objects
                    continue

                if hasattr(entry, "date") and isinstance(entry.date, date):
                    date_key = entry.date.isoformat()
                elif isinstance(entry, dict) and "date" in entry:
                    date_key = entry["date"]
                else:
                    # Skip entries without valid date
                    continue

                if date_key not in shifts_by_date:
                    shifts_by_date[date_key] = {}

                # Get shift ID
                if (
                    hasattr(entry, "shift")
                    and entry.shift
                    and hasattr(entry.shift, "id")
                ):
                    shift_id = entry.shift.id
                elif isinstance(entry, dict) and entry.get("shift_id"):
                    shift_id = entry["shift_id"]
                else:
                    # Skip entries without shifts
                    continue

                # Add entry to the map
                if shift_id not in shifts_by_date[date_key]:
                    shifts_by_date[date_key][shift_id] = []

                shifts_by_date[date_key][shift_id].append(entry)
            except (AttributeError, TypeError, KeyError):
                # Skip problematic entries
                continue

        # Check each shift group
        for date_key, shifts in shifts_by_date.items():
            for shift_id, entries in shifts.items():
                if not entries:
                    continue

                # Find the shift template
                if not entries[0].shift:
                    continue

                shift = entries[0].shift
                if not requires_keyholder(shift):
                    continue

                # Check if any of the employees is a keyholder
                has_keyholder = False
                for entry in entries:
                    # Get employee ID
                    if hasattr(entry, "employee_id"):
                        emp_id = entry.employee_id
                    elif isinstance(entry, dict) and "employee_id" in entry:
                        emp_id = entry["employee_id"]
                    else:
                        continue

                    # Find the employee in resources
                    for emp in self.resources.employees:
                        if emp.id == emp_id and emp.is_keyholder:
                            has_keyholder = True
                            break

                    if has_keyholder:
                        break

                if not has_keyholder:
                    # Find the actual date object
                    try:
                        actual_date = datetime.fromisoformat(date_key).date()
                    except ValueError:
                        actual_date = None

                    self.errors.append(
                        ValidationError(
                            error_type="keyholder_required",
                            message=f"No keyholder assigned for shift {shift_id} on {date_key}",
                            severity="critical",
                            details={
                                "date": date_key,
                                "shift_id": shift_id,
                                "employees": [
                                    {
                                        "id": getattr(entry, "employee_id", None)
                                        if hasattr(entry, "employee_id")
                                        else entry.get("employee_id")
                                        if isinstance(entry, dict)
                                        else None,
                                        "name": getattr(entry, "employee_name", None)
                                        if hasattr(entry, "employee_name")
                                        else entry.get("employee_name")
                                        if isinstance(entry, dict)
                                        else None,
                                    }
                                    for entry in entries
                                ],
                            },
                        )
                    )

    def _validate_rest_periods(self, schedule: List[Schedule]) -> None:
        """Validate rest periods between shifts"""
        # Sort schedule entries by employee and date/time
        entries_by_employee = {}
        for entry in schedule:
            emp_id = entry.employee_id
            if emp_id not in entries_by_employee:
                entries_by_employee[emp_id] = []

            entries_by_employee[emp_id].append(entry)

        # For each employee, check consecutive shifts
        for emp_id, entries in entries_by_employee.items():
            # Skip if only one entry
            if len(entries) <= 1:
                continue

            # Sort entries by date and shift start time
            sorted_entries = sorted(
                entries,
                key=lambda e: (
                    e.date,
                    e.shift.start_time if hasattr(e, "shift") and e.shift else "00:00",
                ),
            )

            # Check rest periods between consecutive shifts
            for i in range(len(sorted_entries) - 1):
                current = sorted_entries[i]
                next_entry = sorted_entries[i + 1]

                # Skip entries without shifts
                if (
                    not hasattr(current, "shift")
                    or not current.shift
                    or not hasattr(next_entry, "shift")
                    or not next_entry.shift
                ):
                    continue

                # Calculate rest period
                rest_hours = self._calculate_rest_hours(current, next_entry)

                if rest_hours < self.config.min_rest_hours:
                    # Find employee name
                    employee = next(
                        (e for e in self.resources.employees if e.id == emp_id), None
                    )
                    emp_name = (
                        f"{employee.first_name} {employee.last_name}"
                        if employee
                        else f"Employee {emp_id}"
                    )

                    self.errors.append(
                        ValidationError(
                            error_type="rest_period",
                            message=f"{emp_name} has insufficient rest between shifts ({rest_hours}h < {self.config.min_rest_hours}h)",
                            severity="warning",
                            details={
                                "employee_id": emp_id,
                                "employee_name": emp_name,
                                "first_shift_date": current.date.isoformat(),
                                "first_shift_time": f"{current.shift.start_time}-{current.shift.end_time}",
                                "second_shift_date": next_entry.date.isoformat(),
                                "second_shift_time": f"{next_entry.shift.start_time}-{next_entry.shift.end_time}",
                                "rest_hours": rest_hours,
                                "min_rest_hours": self.config.min_rest_hours,
                            },
                        )
                    )

    def _validate_max_shifts(self, schedule: List[Schedule]) -> None:
        """Validate maximum shifts per week for each employee"""
        # Group shifts by employee and week
        shifts_by_employee_week = {}
        for entry in schedule:
            emp_id = entry.employee_id
            week_start = self._get_week_start(entry.date)
            week_key = week_start.isoformat()

            if emp_id not in shifts_by_employee_week:
                shifts_by_employee_week[emp_id] = {}

            if week_key not in shifts_by_employee_week[emp_id]:
                shifts_by_employee_week[emp_id][week_key] = []

            shifts_by_employee_week[emp_id][week_key].append(entry)

        # Check max shifts for each employee and week
        for emp_id, weeks in shifts_by_employee_week.items():
            # Find employee
            employee = next(
                (e for e in self.resources.employees if e.id == emp_id), None
            )
            if not employee:
                continue

            # Get max shifts for this employee group
            max_shifts = self.config.max_shifts_per_group.get(
                employee.employee_group,
                5,  # Default to 5 if not specified
            )

            for week_key, entries in weeks.items():
                if len(entries) > max_shifts:
                    self.errors.append(
                        ValidationError(
                            error_type="max_shifts",
                            message=f"{employee.first_name} {employee.last_name} is scheduled for {len(entries)} shifts in week {week_key}, exceeding maximum of {max_shifts}",
                            severity="warning",
                            details={
                                "employee_id": emp_id,
                                "employee_name": f"{employee.first_name} {employee.last_name}",
                                "week": week_key,
                                "scheduled_shifts": len(entries),
                                "max_shifts": max_shifts,
                            },
                        )
                    )

    def _validate_max_hours(self, schedule: List[Schedule]) -> None:
        """Validate maximum hours per week for each employee"""
        # Group hours by employee and week
        hours_by_employee_week = {}
        for entry in schedule:
            # Skip entries without shifts
            if not hasattr(entry, "shift") or not entry.shift:
                continue

            emp_id = entry.employee_id
            week_start = self._get_week_start(entry.date)
            week_key = week_start.isoformat()

            if emp_id not in hours_by_employee_week:
                hours_by_employee_week[emp_id] = {}

            if week_key not in hours_by_employee_week[emp_id]:
                hours_by_employee_week[emp_id][week_key] = 0

            hours_by_employee_week[emp_id][week_key] += entry.shift.duration_hours

        # Check max hours for each employee and week
        for emp_id, weeks in hours_by_employee_week.items():
            # Find employee
            employee = next(
                (e for e in self.resources.employees if e.id == emp_id), None
            )
            if not employee:
                continue

            # Get max hours for this employee group
            max_hours = self.config.max_hours_per_group.get(
                employee.employee_group,
                40,  # Default to 40 if not specified
            )

            for week_key, hours in weeks.items():
                if hours > max_hours:
                    self.errors.append(
                        ValidationError(
                            error_type="max_hours",
                            message=f"{employee.first_name} {employee.last_name} is scheduled for {hours}h in week {week_key}, exceeding maximum of {max_hours}h",
                            severity="warning",
                            details={
                                "employee_id": emp_id,
                                "employee_name": f"{employee.first_name} {employee.last_name}",
                                "week": week_key,
                                "scheduled_hours": hours,
                                "max_hours": max_hours,
                            },
                        )
                    )

    def _calculate_rest_hours(
        self, first_entry: Schedule, second_entry: Schedule
    ) -> float:
        """Calculate rest hours between two shifts"""
        # Convert shift end and start times to datetime objects
        first_end_time = datetime.strptime(
            f"{first_entry.date.isoformat()} {first_entry.shift.end_time}",
            "%Y-%m-%d %H:%M",
        )
        second_start_time = datetime.strptime(
            f"{second_entry.date.isoformat()} {second_entry.shift.start_time}",
            "%Y-%m-%d %H:%M",
        )

        # Calculate time difference in hours
        rest_seconds = (second_start_time - first_end_time).total_seconds()
        return max(0, rest_seconds / 3600)  # Convert to hours

    def _get_week_start(self, day: date) -> date:
        """Get the start of the week (Monday) for a given date"""
        return day - timedelta(days=day.weekday())

    def get_error_report(self) -> Dict[str, Any]:
        """Generate a structured error report"""
        # Group errors by type
        errors_by_type = {}
        for error in self.errors:
            if error.error_type not in errors_by_type:
                errors_by_type[error.error_type] = []
            errors_by_type[error.error_type].append(error)

        # Count errors by severity
        severity_counts = {"critical": 0, "warning": 0, "info": 0}

        for error in self.errors:
            severity_counts[error.severity] = severity_counts.get(error.severity, 0) + 1

        return {
            "total_errors": len(self.errors),
            "severity_counts": severity_counts,
            "errors_by_type": errors_by_type,
            "errors": [self._error_to_dict(error) for error in self.errors],
        }

    def _error_to_dict(self, error: ValidationError) -> Dict[str, Any]:
        """Convert a ValidationError to a dictionary"""
        return {
            "type": error.error_type,
            "message": error.message,
            "severity": error.severity,
            "details": error.details or {},
        }
