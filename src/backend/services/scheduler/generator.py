"""Schedule generator module for creating employee work schedules"""

# Standard library imports
import logging
import sys
from collections import defaultdict
from datetime import datetime, timedelta, date
from pathlib import Path
from typing import List, Dict, Any, Optional, Iterable
import uuid
from logging.handlers import RotatingFileHandler

# Add backend to Python path to ensure imports work correctly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Create relative imports for both package and direct execution
try:
    # When running as part of the backend package
    from backend.models import Employee, ShiftTemplate, Schedule, Coverage, db
    from backend.models.schedule import ScheduleStatus
    from backend.models.employee import AvailabilityType
    from backend.utils.logger import logger
    from backend.services.scheduler.resources import ScheduleResources
    from backend.services.scheduler.validator import ScheduleValidator
    from backend.services.scheduler.utility import time_to_minutes, shifts_overlap
    from backend.services.scheduler.distribution import DistributionManager
except ImportError:
    # When running directly or as part of a different path structure
    try:
        from models import Employee, ShiftTemplate, Schedule, Coverage, db
        from models.schedule import ScheduleStatus
        from models.employee import AvailabilityType
        from utils.logger import logger
        from .resources import ScheduleResources
        from .validator import ScheduleValidator
        from .utility import time_to_minutes, shifts_overlap
        from .distribution import DistributionManager
    except ImportError as e:
        # Fallback logging if everything fails
        print(f"Failed to import required modules in generator.py: {e}")
        logger = logging.getLogger(__name__)


class ScheduleGenerationError(Exception):
    """Custom exception for schedule generation errors"""


class SchedulerConfig:
    """Configuration class for the scheduler"""

    def __init__(self):
        self.max_consecutive_days: int = 5
        self.min_rest_hours: int = 11
        self.enforce_rest_periods: bool = True
        self.max_hours_per_group: dict = {"TL": 40, "VZ": 40, "TZ": 30, "GFB": 20}
        self.max_shifts_per_group: dict = {"TL": 5, "VZ": 5, "TZ": 4, "GFB": 3}
        self.employee_types: list = [
            {"id": "TL", "max_daily_hours": 8.0},
            {"id": "VZ", "max_daily_hours": 8.0},
            {"id": "TZ", "max_daily_hours": 6.0},
            {"id": "GFB", "max_daily_hours": 4.0},
        ]


class ScheduleGenerator:
    """Generates employee schedules with proper constraints"""

    def __init__(self):
        self.resources = ScheduleResources()
        self.validator = None
        self.distribution_manager = DistributionManager()
        self.schedule = []
        self.schedule_by_date = defaultdict(list)
        self.config: SchedulerConfig = None
        self.version = 1
        self.warnings = []
        self.session_id = None
        self.create_empty_schedules = True
        self.use_fair_distribution = True
        self.logger = None

    # Add to class constants
    MAX_GROUP_UTILIZATION = {
        "TL": 1.0,  # 100%
        "VZ": 1.0,
        "TZ": 1.0,
        "GFB": 1.0,
    }

    SHIFT_TYPE_CAPS = {
        "EARLY": 0.2,  # Max 20%
        "MIDDLE": 0.3,  # Max 30%
        "LATE": 0.3,  # Max 30%
    }

    def _setup_diagnostic_logging(self):
        """Set up diagnostic logging for detailed schedule generation tracking"""
        if not self.session_id:
            self.session_id = str(uuid.uuid4())[:8]

        # Create diagnostics directory if it doesn't exist
        diagnostic_dir = (
            Path(__file__).resolve().parent.parent.parent.parent
            / "logs"
            / "diagnostics"
        )
        diagnostic_dir.mkdir(exist_ok=True)

        # Create a logger for this generation session
        self.logger = logging.getLogger(f"schedule_generator_{self.session_id}")
        self.logger.setLevel(logging.DEBUG)
        self.logger.propagate = False

        # Create handlers
        log_file = diagnostic_dir / f"schedule_diagnostic_{self.session_id}.log"
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10485760,  # 10MB
            backupCount=3,
            encoding="utf-8",
        )

        # Create and set formatter
        formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
        file_handler.setFormatter(formatter)

        # Add handlers to logger
        self.logger.handlers = []  # Clear any existing handlers
        self.logger.addHandler(file_handler)

    def _log_debug(self, message: str) -> None:
        """Log debug message with diagnostic information"""
        if self.logger:
            self.logger.debug(message)

    def _log_info(self, message: str) -> None:
        """Log info message with diagnostic information"""
        if self.logger:
            self.logger.info(message)

    def _log_warning(self, message: str) -> None:
        """Log warning message with diagnostic information"""
        if self.logger:
            self.logger.warning(message)
            self.warnings.append({"type": "warning", "message": message})

    def _log_error(self, message: str) -> None:
        """Log error message with diagnostic information"""
        if self.logger:
            self.logger.error(message)
            self.warnings.append({"type": "error", "message": message})

    def generate(
        self,
        start_date: date,
        end_date: date,
        version: int,
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

            # Set up diagnostic logging
            self._setup_diagnostic_logging()
            self._log_info(
                f"Starting schedule generation for period {start_date} to {end_date}"
            )
            self._log_info(f"Session ID: {self.session_id}")

            # Load resources
            self._log_info("Loading resources for schedule generation")
            self.resources.load()

            # Log loaded resources
            self._log_info(f"Loaded {len(self.resources.employees)} employees")
            self._log_info(f"Loaded {len(self.resources.shifts)} shift templates")
            self._log_info(
                f"Loaded {len(self.resources.availabilities)} availability records"
            )
            self._log_info(
                f"Loaded {len(self.resources.coverage_requirements)} coverage requirements"
            )

            # Log active employees
            active_employees = [e for e in self.resources.employees if e.is_active]
            self._log_info(f"Found {len(active_employees)} active employees")
            for emp in active_employees:
                self._log_debug(
                    f"Active employee: {emp.id} - Group: {emp.group} - Keyholder: {emp.is_keyholder}"
                )

            # Initialize schedule generation
            self._initialize_schedule_generation(start_date, end_date)

            # Create schedule
            self._log_info(f"Generating schedule from {start_date} to {end_date}")
            self._create_schedule(start_date, end_date)

            # Log schedule creation results
            self._log_info(f"Created {len(self.schedule)} schedule entries")

            # Add empty schedules for all employees if needed
            if self.create_empty_schedules:
                self._log_info(
                    "Adding empty schedules for employees with no assignments"
                )
                self._add_empty_schedules(start_date, end_date)

            # Convert Schedule objects to dictionaries
            self.schedule = [
                self._convert_schedule_to_dict(entry) for entry in self.schedule
            ]
            for date in self.schedule_by_date:
                self.schedule_by_date[date] = [
                    self._convert_schedule_to_dict(entry)
                    for entry in self.schedule_by_date[date]
                ]

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

            # Create result with serializable data
            result = self._create_result()

            # Log final statistics
            self._log_info(
                f"Final schedule contains {len(result['schedule'])} assignments"
            )
            if result.get("warnings"):
                self._log_info(f"Found {len(result['warnings'])} warnings/errors")

            return result

        except Exception as e:
            self._log_error(f"Failed to generate schedule: {str(e)}")
            import traceback

            self._log_error(traceback.format_exc())
            return {
                "error": f"Failed to generate schedule: {str(e)}",
                "schedule": [],
                "warnings": self.warnings,
                "version": self.version,
            }

    def _convert_schedule_to_dict(self, entry) -> dict:
        """Convert a Schedule object or dict to a fully serializable dictionary"""
        if isinstance(entry, dict):
            # If it's already a dict, ensure all values are serializable
            result = entry.copy()

            # Convert date to ISO format string if it's a date object
            if "date" in result and isinstance(result["date"], date):
                result["date"] = result["date"].isoformat()

            # Convert shift template if present
            if "shift_template" in result and isinstance(
                result["shift_template"], ShiftTemplate
            ):
                result["shift_template"] = {
                    "id": result["shift_template"].id,
                    "start_time": result["shift_template"].start_time,
                    "end_time": result["shift_template"].end_time,
                }

            # Convert status to string value if it's an enum
            if "status" in result and hasattr(result["status"], "value"):
                result["status"] = result["status"].value

            return result

        elif isinstance(entry, Schedule):
            # Convert Schedule object to dictionary
            return {
                "id": entry.id if hasattr(entry, "id") else None,
                "employee_id": entry.employee_id,
                "date": entry.date.isoformat()
                if isinstance(entry.date, date)
                else str(entry.date),
                "shift_id": entry.shift_id,
                "status": entry.status.value
                if hasattr(entry.status, "value")
                else str(entry.status),
                "version": entry.version,
                "availability_type": entry.availability_type,
                "shift_template": {
                    "id": entry.shift.id,
                    "start_time": entry.shift.start_time,
                    "end_time": entry.shift.end_time,
                }
                if hasattr(entry, "shift") and entry.shift
                else None,
            }
        else:
            # If it's neither a dict nor a Schedule, return a minimal dict
            self._log_warning(f"Unknown entry type {type(entry)} in schedule")
            return {"error": f"Invalid entry type: {type(entry)}", "data": str(entry)}

    def _create_schedule(self, start_date: date, end_date: date) -> None:
        """Create the schedule for the given date range"""
        self._log_info(f"Starting schedule creation from {start_date} to {end_date}")

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

            self._log_info(
                f"Found {len(coverages)} coverage periods for {current_date}"
            )

            # Process each coverage requirement
            for coverage in coverages:
                self._log_debug(
                    f"Processing coverage {coverage.id}: "
                    f"{coverage.start_time}-{coverage.end_time}"
                )
                schedules = self._process_coverage(coverage, current_date, self.version)
                self._log_info(
                    f"Assigned {len(schedules)} shifts for coverage {coverage.id}"
                )

        self._log_info(
            f"Schedule creation completed with {len(self.schedule)} total assignments"
        )

    def _process_coverage(
        self, coverage: Coverage, current_date: date, version: int
    ) -> List[Schedule]:
        """Process a coverage requirement for a given date"""
        self._log_info(
            f"Processing coverage for {current_date} "
            f"{coverage.start_time}-{coverage.end_time}, "
            f"min employees={coverage.min_employees}"
        )

        # Find matching shifts using simplified matching logic
        matching_shifts = self._find_matching_shifts(coverage)
        self._log_info(f"Found {len(matching_shifts)} matching shifts for coverage")

        if not matching_shifts:
            self._log_warning(f"No matching shifts found for coverage {coverage.id}")
            return []

        # Get available employees with simplified filtering
        available_employees = self._get_available_employees(
            current_date, coverage.start_time, coverage.end_time
        )

        # Log detailed employee availability
        for emp in available_employees:
            self._log_info(
                f"Employee {emp.id} available: "
                f"group={emp.employee_group}, "
                f"keyholder={emp.is_keyholder}"
            )

        if not available_employees:
            self._log_warning(
                f"No available employees for {current_date} "
                f"({coverage.start_time}-{coverage.end_time})"
            )
            return []

        # New distribution priority system
        employees_needed = max(coverage.min_employees, 1)
        self._log_info(f"Need to assign {employees_needed} employees")

        assigned_employees = self._assign_employees_with_distribution(
            matching_shifts,
            available_employees,
            current_date,
            coverage,
            employees_needed,
        )

        self._log_info(f"Successfully assigned {len(assigned_employees)} employees")

        # Log assigned employee details
        for emp in assigned_employees:
            self._log_info(f"Assigned employee {emp.id} to coverage {coverage.id}")

        schedule_entries = self._create_schedule_entries(
            assigned_employees, matching_shifts, current_date, version
        )

        # Log created schedule entries
        for entry in schedule_entries:
            self._log_info(
                f"Created schedule entry: "
                f"employee={entry.employee_id}, "
                f"shift={entry.shift_id}, "
                f"type={entry.availability_type}"
            )

        return schedule_entries

    def _assign_employees_with_distribution(
        self, date: date, shifts: List[Dict], employees_needed: int
    ) -> List[Dict]:
        """Assign employees to shifts using fair distribution"""
        self._log_info(
            f"Starting employee assignment for date {date}, need {employees_needed} employees"
        )

        assigned_employees = []
        available_employees = self._get_available_employees(date, shifts)

        self._log_debug(
            f"Found {len(available_employees)} potentially available employees for {date}"
        )

        if not available_employees:
            self._log_warning(f"No available employees found for date {date}")
            return []

        # Get employee assignments for this date
        existing_assignments = self._get_employee_shifts_for_date(date)
        self._log_debug(
            f"Found {len(existing_assignments)} existing assignments for {date}"
        )

        # Track assignments by type
        assignments_by_type = defaultdict(int)
        for shift in shifts:
            shift_type = shift.get("type", "EARLY")  # Default to EARLY if not specified
            assignments_by_type[shift_type] += 1

        self._log_debug(f"Assignments by type: {dict(assignments_by_type)}")

        # Try to assign employees while respecting constraints
        for employee in available_employees:
            if len(assigned_employees) >= employees_needed:
                self._log_debug("Reached required number of employees")
                break

            self._log_debug(
                f"Evaluating employee {employee.id} - Group: {employee.group}"
            )

            # Check if employee already has shifts on this date
            if any(assg["employee_id"] == employee.id for assg in existing_assignments):
                self._log_debug(f"Employee {employee.id} already has shifts on {date}")
                continue

            # Check consecutive days constraint
            if not self._check_consecutive_days(employee, date):
                self._log_debug(
                    f"Employee {employee.id} would exceed consecutive days limit"
                )
                continue

            # Check rest period constraint
            if not self._check_rest_period(employee, date, shifts[0]):
                self._log_debug(f"Employee {employee.id} would violate rest period")
                continue

            # Find best matching shift based on availability
            best_shift = None
            best_match_score = -1

            for shift in shifts:
                if self._is_employee_available(employee, date, shift):
                    # Calculate match score based on distribution
                    match_score = self.distribution_manager.calculate_match_score(
                        employee, date, shift
                    )
                    self._log_debug(
                        f"Match score for employee {employee.id} with shift {shift.get('id')}: {match_score}"
                    )

                    if match_score > best_match_score:
                        best_match_score = match_score
                        best_shift = shift

            if best_shift:
                self._log_info(
                    f"Assigning employee {employee.id} to shift {best_shift.get('id')} on {date}"
                )
                assignment = {
                    "employee_id": employee.id,
                    "shift_id": best_shift["id"],
                    "date": date,
                    "shift_template": best_shift,
                    "availability_type": "AVAILABLE",
                    "status": ScheduleStatus.DRAFT,
                    "version": self.version,
                }
                assigned_employees.append(assignment)

                # Update distribution tracking
                self.distribution_manager.record_assignment(employee, date, best_shift)
            else:
                self._log_debug(f"No suitable shift found for employee {employee.id}")

        if len(assigned_employees) < employees_needed:
            self._log_warning(
                f"Could not assign enough employees for {date}. "
                f"Needed: {employees_needed}, Assigned: {len(assigned_employees)}"
            )

        return assigned_employees

    def _get_sorted_candidates(self, employees, shift, date, assigned):
        """Get a sorted list of candidate employees for a shift"""
        candidates = []

        for employee in employees:
            if employee.id in assigned:
                continue

            # Check if this employee really needs to work this day
            # Give priority to employees who have had fewer shifts recently
            consecutive_days = self._count_consecutive_days(employee.id, date)

            # Skip this employee if they've worked many days in a row
            # and we don't absolutely need them for coverage
            if consecutive_days >= 4 and len(candidates) > 0:
                continue

            # ... existing sorting logic ...

        return candidates

    def _group_utilization_factor(self, group: str) -> float:
        """Priority factor based on group utilization"""
        util = self._calculate_group_utilization(group)
        return util**3  # Cube to heavily penalize over-utilization

    def _calculate_group_utilization(self, group: str) -> float:
        """Current utilization vs contracted hours"""
        group_employees = [
            e for e in self.resources.employees if e.employee_group == group
        ]
        total_contracted = sum(e.contracted_hours for e in group_employees) or 1
        total_scheduled = sum(
            self._get_weekly_hours(e.id, datetime.now().date()) for e in group_employees
        )
        return total_scheduled / total_contracted

    def _exceeds_constraints(
        self,
        employee: Employee,
        current_date: date,
        shift: ShiftTemplate,
    ) -> bool:
        """Enhanced constraint checking with group-specific limits"""
        try:
            # Check general constraints like max consecutive days, rest time, etc.
            # Log what we're checking for debugging
            self._log_debug(
                f"Checking constraints for employee {employee.id} on {current_date} "
                f"for shift {shift.id} ({shift.start_time}-{shift.end_time})"
            )

            # Check if employee has already worked too many consecutive days
            consecutive_days = self._count_consecutive_days(employee.id, current_date)
            if consecutive_days >= self.config.max_consecutive_days:
                self._log_debug(
                    f"Employee {employee.id} has worked {consecutive_days} consecutive days, "
                    f"which exceeds max of {self.config.max_consecutive_days}"
                )
                return True

            # Check if employee would have enough rest between shifts
            if not self._has_enough_rest(employee, shift, current_date):
                self._log_debug(
                    f"Employee {employee.id} would not have enough rest "
                    f"between shifts on {current_date}"
                )
                return True

            # Check weekly hours
            weekly_hours = self._get_weekly_hours(employee.id, current_date)

            # Calculate shift duration
            shift_duration = 0
            if hasattr(shift, "duration_hours") and shift.duration_hours is not None:
                shift_duration = shift.duration_hours
            else:
                # Calculate from start and end time
                shift_duration = self._calculate_shift_duration(
                    shift.start_time, shift.end_time
                )

            total_hours = weekly_hours + shift_duration

            # Check if adding this shift would exceed daily hours limit for employee group
            # First try to get max_daily_hours from employee settings
            max_daily_hours = None

            # Get employee group settings
            if hasattr(self, "config") and hasattr(self.config, "employee_types"):
                # Try to find employee group in config
                for group in self.config.employee_types:
                    if group.get("id") == employee.employee_group:
                        max_daily_hours = group.get("max_daily_hours")
                        break

            # If no specific setting, use general setting or default
            if max_daily_hours is None:
                if hasattr(self.config, "max_daily_hours"):
                    max_daily_hours = self.config.max_daily_hours
                else:
                    # Default values based on employee group
                    if employee.employee_group in ["VZ", "TL"]:
                        max_daily_hours = 8.0
                    elif employee.employee_group == "TZ":
                        max_daily_hours = 6.0
                    else:
                        max_daily_hours = 5.0

            # Check if shift duration would exceed max daily hours
            if shift_duration > max_daily_hours:
                self._log_debug(
                    f"Shift duration {shift_duration}h exceeds max daily hours "
                    f"{max_daily_hours}h for employee {employee.id} in group "
                    f"{employee.employee_group}"
                )
                return True

            # Also check if already has shifts on this day, and would exceed combined
            daily_hours = 0
            for entry in self.schedule:
                if isinstance(entry, dict):
                    if (
                        entry.get("date") == current_date
                        and entry.get("employee_id") == employee.id
                        and entry.get("shift_id") is not None
                    ):
                        # Find shift to calculate hours
                        entry_shift = next(
                            (
                                s
                                for s in self.resources.shifts
                                if s.id == entry.get("shift_id")
                            ),
                            None,
                        )
                        if entry_shift:
                            if hasattr(entry_shift, "duration_hours"):
                                daily_hours += entry_shift.duration_hours
                            else:
                                daily_hours += self._calculate_shift_duration(
                                    entry_shift.start_time, entry_shift.end_time
                                )
                elif hasattr(entry, "date") and hasattr(entry, "employee_id"):
                    if (
                        entry.date == current_date
                        and entry.employee_id == employee.id
                        and entry.shift_id is not None
                    ):
                        # Find shift to calculate hours
                        entry_shift = next(
                            (
                                s
                                for s in self.resources.shifts
                                if s.id == entry.shift_id
                            ),
                            None,
                        )
                        if entry_shift:
                            if hasattr(entry_shift, "duration_hours"):
                                daily_hours += entry_shift.duration_hours
                            else:
                                daily_hours += self._calculate_shift_duration(
                                    entry_shift.start_time, entry_shift.end_time
                                )

            # Check if combined daily hours would exceed limit
            if daily_hours + shift_duration > max_daily_hours:
                self._log_debug(
                    f"Combined daily hours ({daily_hours}h + {shift_duration}h) would exceed "
                    f"max daily hours {max_daily_hours}h for employee {employee.id}"
                )
                return True

            # Check if adding this shift would exceed weekly hours limit
            if employee.employee_group in self.config.max_hours_per_group:
                max_hours = self.config.max_hours_per_group[employee.employee_group]
                if total_hours > max_hours:
                    self._log_debug(
                        f"Weekly hours ({total_hours}h) would exceed max "
                        f"({max_hours}h) for employee {employee.id}"
                    )
                    return True

            # Check if adding this shift would exceed weekly shifts limit
            shifts_worked = self._count_weekly_shifts(employee.id, current_date)
            if employee.employee_group in self.config.max_shifts_per_group:
                max_shifts = self.config.max_shifts_per_group[employee.employee_group]
                if shifts_worked + 1 > max_shifts:
                    self._log_debug(
                        f"Weekly shifts ({shifts_worked + 1}) would exceed max "
                        f"({max_shifts}) for employee {employee.id}"
                    )
                    return True

            # Add group-specific hourly limits
            group_limits = {
                "TL": {"max_daily": 8, "max_weekly": 40},
                "VZ": {"max_daily": 8, "max_weekly": 40},
                "TZ": {"max_daily": 6, "max_weekly": 30},
                "GFB": {"max_daily": 4, "max_weekly": 20},
            }

            if employee.employee_group in group_limits:
                limits = group_limits[employee.employee_group]
                # Check daily
                if shift_duration > limits["max_daily"]:
                    return True
                # Check weekly
                if (
                    self._get_weekly_hours(employee.id, current_date) + shift_duration
                ) > limits["max_weekly"]:
                    return True

            # All constraints satisfied
            return False

        except Exception as e:
            self._log_warning(
                f"Error checking constraints for employee {employee.id}: {str(e)}"
            )
            return True  # Safer to assume constraints are exceeded if check fails

    def _is_employee_available(self, employee, date: date, shift: Dict) -> bool:
        """Check if an employee is available for a given shift"""
        self._log_debug(
            f"Checking availability for employee {employee.id} on {date} for shift {shift.get('id')}"
        )

        # Check if employee is on leave
        if self._is_employee_on_leave(employee, date):
            self._log_debug(f"Employee {employee.id} is on leave on {date}")
            return False

        # Get availability records for the date
        availability = self.resources.get_availability(employee.id, date)
        if not availability:
            self._log_debug(
                f"No availability record found for employee {employee.id} on {date}"
            )
            return False

        # Get shift hours
        start_time = shift.get("start_time")
        end_time = shift.get("end_time")
        if not start_time or not end_time:
            self._log_warning(
                f"Invalid shift times for shift {shift.get('id')}: {start_time} - {end_time}"
            )
            return False

        self._log_debug(f"Checking availability for hours {start_time} - {end_time}")

        # Check each hour of the shift
        shift_hours = self._get_shift_hours(start_time, end_time)
        for hour in shift_hours:
            if not self._is_hour_available(employee, date, hour, availability):
                self._log_debug(f"Employee {employee.id} not available at hour {hour}")
                return False

        self._log_debug(
            f"Employee {employee.id} is available for shift {shift.get('id')} on {date}"
        )
        return True

    def _is_hour_available(self, employee, date: date, hour: int, availability) -> bool:
        """Check if an employee is available for a specific hour"""
        # Convert availability type to uppercase for consistency
        availability_type = availability.get("type", "").upper()

        self._log_debug(
            f"Checking hour {hour} for employee {employee.id} - Availability type: {availability_type}"
        )

        if availability_type == "AVAILABLE":
            return True
        elif availability_type == "UNAVAILABLE":
            return False
        elif availability_type == "PREFERRED":
            return True
        elif availability_type == "NOT_PREFERRED":
            # Allow assignment but with lower priority
            return True
        else:
            self._log_warning(
                f"Unknown availability type {availability_type} for employee {employee.id}"
            )
            return False

    def _get_shift_hours(self, start_time: str, end_time: str) -> List[int]:
        """Get list of hours covered by a shift"""
        try:
            start_hour = int(start_time.split(":")[0])
            end_hour = int(end_time.split(":")[0])

            # Handle shifts that span midnight
            if end_hour <= start_hour:
                end_hour += 24

            return list(range(start_hour, end_hour))
        except (ValueError, IndexError) as e:
            self._log_error(
                f"Error parsing shift hours: {start_time} - {end_time}: {str(e)}"
            )
            return []

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
        """Create the final result object with properly serialized schedule entries"""
        schedule_entries = []

        for entry in self.schedule:
            if isinstance(entry, Schedule):
                # Convert Schedule object to dictionary
                entry_dict = {
                    "id": entry.id if hasattr(entry, "id") else None,
                    "employee_id": entry.employee_id,
                    "date": entry.date.isoformat()
                    if isinstance(entry.date, date)
                    else str(entry.date),
                    "shift_id": entry.shift_id,
                    "status": entry.status.value
                    if hasattr(entry.status, "value")
                    else str(entry.status),
                    "version": entry.version,
                    "availability_type": entry.availability_type,
                }
                schedule_entries.append(entry_dict)
            elif isinstance(entry, dict):
                # If it's already a dict, ensure date is serialized
                entry_copy = entry.copy()
                if "date" in entry_copy and isinstance(entry_copy["date"], date):
                    entry_copy["date"] = entry_copy["date"].isoformat()
                schedule_entries.append(entry_copy)
            else:
                # Skip entries that can't be converted
                self._log_warning(
                    f"Skipping non-serializable schedule entry of type {type(entry)}"
                )
                continue

        result = {
            "schedule": schedule_entries,
            "warnings": self.warnings,
            "version": self.version,
            "generation_time": datetime.now().isoformat(),
        }

        # Add distribution metrics if available
        if hasattr(self, "use_fair_distribution") and self.use_fair_distribution:
            try:
                metrics = self.distribution_manager.get_distribution_metrics()
                result["distribution_metrics"] = metrics
            except Exception as e:
                self._log_warning(f"Failed to get distribution metrics: {str(e)}")

        return result

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
        """Log an info message using the appropriate logger"""
        if hasattr(logger, "schedule_logger"):
            logger.schedule_logger.info(message)
        else:
            logging.getLogger(__name__).info(message)

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
            if self._is_employee_available(
                employee, shift_date, shift_template.start_time, shift_template.end_time
            ):
                available_employees.append(employee)

        return available_employees

    def _log_error(self, message: str) -> None:
        """Log error message"""
        if hasattr(logger, "app_logger"):
            logger.app_logger.error(f"ScheduleGenerator: {message}")
        else:
            logger.error(f"ScheduleGenerator: {message}")

    def generate_schedule(
        self,
        start_date,
        end_date,
        create_empty_schedules=True,
        session_id=None,
        version=1,
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
            f"Generating schedule from {start_date} to {end_date} with version {version}"
        )

        # Generate schedule with the specified version
        result = self.generate(
            start_date, end_date, version=version, session_id=session_id
        )

        # If no schedules were created but empty schedules are requested
        if create_empty_schedules and not self.schedule:
            self._add_empty_schedules(start_date, end_date)

        # Save the schedules to the database
        self._save_to_database()

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

                logger.schedule_logger.info(
                    f"Saving schedules to database: {len(self.schedule)} entries from {min_date} to {max_date} with version {self.version}"
                )

                # Delete existing entries for this date range and version
                existing_entries = Schedule.query.filter(
                    Schedule.date >= min_date,
                    Schedule.date <= max_date,
                    Schedule.version == self.version,
                ).all()

                if existing_entries:
                    logger.schedule_logger.info(
                        f"Deleting {len(existing_entries)} existing schedule entries for version {self.version}"
                    )
                    for entry in existing_entries:
                        db.session.delete(entry)
                    db.session.commit()
                    logger.schedule_logger.info("Deleted existing entries successfully")

                # Add all entries to the database
                entry_count = 0
                for entry in self.schedule:
                    # Log a sample of entries being added
                    if entry_count < 5:
                        logger.schedule_logger.info(
                            f"Adding schedule: employee_id={entry.employee_id}, date={entry.date}, shift_id={entry.shift_id}, version={entry.version}"
                        )
                    db.session.add(entry)
                    entry_count += 1

                # Log the number of entries being added
                logger.schedule_logger.info(
                    f"Adding {entry_count} new schedule entries for version {self.version}"
                )

                # Commit the transaction
                db.session.commit()
                logger.schedule_logger.info(
                    f"Successfully saved {entry_count} schedule entries to database"
                )
            else:
                logger.schedule_logger.warning(
                    "No schedules to save to database - schedule list is empty"
                )
        except Exception as e:
            # If something goes wrong, rollback the transaction
            db.session.rollback()
            logger.schedule_logger.error(f"Error saving schedule to database: {str(e)}")
            # Log the full exception for debugging
            import traceback

            logger.schedule_logger.error(
                f"Exception traceback: {traceback.format_exc()}"
            )

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
                    if (
                        hasattr(entry_shift, "duration_hours")
                        and entry_shift.duration_hours is not None
                    ):
                        weekly_hours += entry_shift.duration_hours
                    else:
                        weekly_hours += self._calculate_shift_duration(
                            entry_shift.start_time, entry_shift.end_time
                        )

        # Add hours from the new shift
        shift_duration = self._calculate_shift_duration(start_time, end_time)
        weekly_hours += shift_duration

        # Find the employee object to get the employee group
        employee = next(
            (e for e in self.resources.employees if e.id == employee_id), None
        )
        if not employee:
            self._log_warning(
                f"Employee {employee_id} not found when checking weekly hours"
            )
            return True  # Better to be safe and assume constraint is exceeded

        # Get maximum weekly hours based on employee group
        max_hours = self.config.max_hours_per_group.get(
            employee.employee_group,  # Fixed: Use employee_group instead of employee_id
            40.0,  # Default to 40 hours if not specified
        )

        # Log for debugging
        self._log_debug(
            f"Employee {employee_id} weekly hours would be {weekly_hours:.1f}h (max {max_hours}h)"
        )

        # Also check against contracted hours
        if hasattr(employee, "contracted_hours") and employee.contracted_hours:
            # Don't exceed contracted hours by more than 20%
            contracted_limit = employee.contracted_hours * 1.2
            if weekly_hours > contracted_limit:
                self._log_debug(
                    f"Weekly hours {weekly_hours:.1f}h would exceed contracted limit "
                    f"{contracted_limit:.1f}h (120% of {employee.contracted_hours}h)"
                )
                return True

        return weekly_hours > max_hours

    def _calculate_shift_duration(self, start_time: str, end_time: str) -> float:
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

            self._log_debug(
                f"Shift duration {start_time}-{end_time} = {duration_hours:.2f}h"
            )
            return duration_hours
        except Exception as e:
            self._log_error(f"Error calculating shift duration: {str(e)}")
            return 0.0

    def _get_shift_priority(self, shift, current_date):
        """Get priority for scheduling this shift"""
        priority = 0

        # Get shift type
        shift_type = None
        if hasattr(shift, "shift_type_id"):
            shift_type = shift.shift_type_id
        else:
            # Determine from start time
            start_hour = int(shift.start_time.split(":")[0])
            if start_hour < 10:
                shift_type = "EARLY"
            elif 10 <= start_hour < 14:
                shift_type = "MIDDLE"
            else:
                shift_type = "LATE"

        # Prioritize based on current distribution
        current_dist = self._get_current_shift_distribution()
        total_shifts = sum(current_dist.values()) or 1

        # Calculate current percentage of this shift type
        type_count = current_dist.get(shift_type, 0)
        current_percent = type_count / total_shifts

        # Check against caps
        if current_percent >= self.SHIFT_TYPE_CAPS.get(shift_type, 0.33):
            priority += 100  # Heavily deprioritize if we're at or over the cap

        return priority

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
        """Get the best employee based on availability and priority"""
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
            self._initialize_distribution_manager()

    def _initialize_distribution_manager(self):
        """Initialize the distribution manager with historical data"""
        if not hasattr(self, "distribution_manager") or not self.distribution_manager:
            self.distribution_manager = DistributionManager()

        # Pass resources to the distribution manager so it can access shifts
        self.distribution_manager.resources = self.resources

        # Get historical data for distribution analysis
        historical_data = self._get_historical_schedules()

        # Initialize with employees, shifts, and historical data
        self.distribution_manager.initialize(
            employees=self.resources.employees,
            historical_data=historical_data,
            shifts=self.resources.shifts,
            resources=self.resources,
        )

        # Log initialization
        self._log_info(
            f"Distribution manager initialized with {len(self.resources.employees)} employees"
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

        # Get shift category to aid in balancing shift types
        shift_category = self._categorize_shift(shift_template, shift_date)
        self._log_info(f"Processing shift of type {shift_category} for {shift_date}")

        # Check current distribution of shift types in the schedule
        current_distribution = self._get_current_shift_distribution()
        total_shifts = sum(current_distribution.values()) or 1

        early_percent = current_distribution.get("early", 0) / total_shifts * 100
        middle_percent = current_distribution.get("middle", 0) / total_shifts * 100
        late_percent = current_distribution.get("late", 0) / total_shifts * 100

        self._log_info(
            f"Current distribution: Early: {early_percent:.1f}%, "
            f"Middle: {middle_percent:.1f}%, Late: {late_percent:.1f}%"
        )

        # Target a more balanced distribution (roughly equal thirds)
        ideal_distribution = {"early": 34, "middle": 33, "late": 33}

        # See if we need to prioritize certain shift types - make adjustments stronger
        distribution_priority = 0
        if shift_category == "early" and early_percent > 50:
            # We have far too many early shifts
            distribution_priority = -20  # Much lower priority (higher score)
            self._log_info(
                f"Extremely deprioritizing early shifts (currently {early_percent:.1f}%)"
            )
        elif (
            shift_category == "early"
            and early_percent > ideal_distribution["early"] + 10
        ):
            # We have too many early shifts
            distribution_priority = -10  # Lower priority (higher score)
            self._log_info(
                f"Strongly deprioritizing early shifts (currently {early_percent:.1f}%)"
            )
        elif shift_category == "middle" and middle_percent < 20:
            # We need many more middle shifts
            distribution_priority = 20  # Much higher priority (lower score)
            self._log_info(
                f"Extremely prioritizing middle shifts (currently {middle_percent:.1f}%)"
            )
        elif (
            shift_category == "middle" and middle_percent < ideal_distribution["middle"]
        ):
            # We need more middle shifts
            distribution_priority = 10  # Higher priority (lower score)
            self._log_info(
                f"Prioritizing middle shifts (currently {middle_percent:.1f}%)"
            )
        elif shift_category == "late" and late_percent < 20:
            # We need many more late shifts
            distribution_priority = 20  # Much higher priority (lower score)
            self._log_info(
                f"Extremely prioritizing late shifts (currently {late_percent:.1f}%)"
            )
        elif shift_category == "late" and late_percent < ideal_distribution["late"]:
            # We need more late shifts
            distribution_priority = 10  # Higher priority (lower score)
            self._log_info(f"Prioritizing late shifts (currently {late_percent:.1f}%)")

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
            base_score = self.distribution_manager.calculate_assignment_score(
                employee.id, shift_template, shift_date, context=weekly_context
            )

            # Apply distribution priority adjustment
            adjusted_score = base_score - distribution_priority

            # NEW: Check for problematic shift sequences (e.g., late followed by early)
            # Look at employee's shifts in the day before
            previous_day = shift_date - timedelta(days=1)
            prev_day_entries = [
                entry
                for entry in self.schedule
                if (
                    isinstance(entry, dict)
                    and entry.get("employee_id") == employee.id
                    and entry.get("date") == previous_day
                )
                or (
                    hasattr(entry, "employee_id")
                    and entry.employee_id == employee.id
                    and entry.date == previous_day
                )
            ]

            if prev_day_entries:
                # Get the shift from the previous day
                prev_shift = None
                if (
                    isinstance(prev_day_entries[0], dict)
                    and "shift_template" in prev_day_entries[0]
                ):
                    prev_shift = prev_day_entries[0]["shift_template"]
                elif (
                    hasattr(prev_day_entries[0], "shift") and prev_day_entries[0].shift
                ):
                    prev_shift = prev_day_entries[0].shift
                elif (
                    hasattr(prev_day_entries[0], "shift_id")
                    and prev_day_entries[0].shift_id
                ):
                    # Find the shift template from resources
                    prev_shift_id = prev_day_entries[0].shift_id
                    prev_shift = next(
                        (s for s in self.resources.shifts if s.id == prev_shift_id),
                        None,
                    )

                if prev_shift:
                    # Check for late-to-early transition (strongly discouraged)
                    prev_category = self._categorize_shift(prev_shift, previous_day)
                    if prev_category == "late" and shift_category == "early":
                        self._log_info(
                            f"Strongly penalizing late-to-early transition for employee {employee.id}"
                        )
                        adjusted_score += (
                            50  # High penalty for late-to-early transitions
                        )

                    # Check for more than 3 consecutive days with same shift type
                    consecutive_same_type = self._count_consecutive_shift_types(
                        employee.id, previous_day, prev_category
                    )
                    if prev_category == shift_category and consecutive_same_type >= 3:
                        self._log_info(
                            f"Penalizing {consecutive_same_type + 1} consecutive {shift_category} shifts for employee {employee.id}"
                        )
                        # Increasing penalty for more consecutive same-type shifts
                        adjusted_score += consecutive_same_type * 5

            employee_scores.append((employee, adjusted_score))

        # Sort by score (lower is better)
        employee_scores.sort(key=lambda x: x[1])

        if not employee_scores:
            return None

        # Log assignment decision for debugging
        best_employee, score = employee_scores[0]
        self._log_info(
            f"Selected employee {best_employee.id} for {shift_category} shift on {shift_date} with score {score:.2f}"
        )

        return best_employee

    def _count_consecutive_shift_types(self, employee_id, current_date, shift_category):
        """Count consecutive days with the same shift type for an employee"""
        count = 0
        check_date = current_date

        # Look back up to 7 days
        for _ in range(7):
            check_date = check_date - timedelta(days=1)

            # Find employee's shift on this date
            day_entries = [
                entry
                for entry in self.schedule
                if (
                    isinstance(entry, dict)
                    and entry.get("employee_id") == employee_id
                    and entry.get("date") == check_date
                )
                or (
                    hasattr(entry, "employee_id")
                    and entry.employee_id == employee_id
                    and entry.date == check_date
                )
            ]

            if not day_entries:
                # No shift on this day, break the streak
                break

            # Get the shift from this day
            shift = None
            if isinstance(day_entries[0], dict) and "shift_template" in day_entries[0]:
                shift = day_entries[0]["shift_template"]
            elif hasattr(day_entries[0], "shift") and day_entries[0].shift:
                shift = day_entries[0].shift
            elif hasattr(day_entries[0], "shift_id") and day_entries[0].shift_id:
                # Find the shift template from resources
                shift_id = day_entries[0].shift_id
                shift = next(
                    (s for s in self.resources.shifts if s.id == shift_id), None
                )

            if not shift:
                break

            # Check if it's the same category
            day_category = self._categorize_shift(shift, check_date)
            if day_category == shift_category:
                count += 1
            else:
                break

        return count

    def _get_current_shift_distribution(self):
        """Calculate the current distribution of shift types in the schedule"""
        distribution = {"early": 0, "middle": 0, "late": 0, "weekend": 0, "standard": 0}

        for entry in self.schedule:
            if isinstance(entry, dict) and entry.get("shift_id"):
                # Find the shift template
                shift = next(
                    (s for s in self.resources.shifts if s.id == entry.get("shift_id")),
                    None,
                )
                if shift and entry.get("date"):
                    category = self._categorize_shift(shift, entry.get("date"))
                    distribution[category] += 1
            elif hasattr(entry, "shift_id") and hasattr(entry, "date"):
                # Find the shift template
                shift = next(
                    (s for s in self.resources.shifts if s.id == entry.shift_id), None
                )
                if shift:
                    category = self._categorize_shift(shift, entry.date)
                    distribution[category] += 1

        return distribution

    def _categorize_shift(self, shift, day):
        """Categorize a shift based on its start time and day of week"""
        # Check if weekend first
        if day.weekday() >= 5:  # Saturday (5) or Sunday (6)
            return "weekend"

        # Categorize by start time
        if hasattr(shift, "start_time") and shift.start_time:
            start_hour = int(shift.start_time.split(":")[0])

            # Early shift (starts before 10:00)
            if start_hour < 10:
                return "early"
            # Middle shift (starts between 10:00 and 14:00)
            elif 10 <= start_hour < 14:
                return "middle"
            # Late shift (starts at or after 14:00)
            else:
                return "late"

        # Default if we can't determine
        return "standard"

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
        if not self._is_employee_available(
            employee, shift_date, shift_template.start_time, shift_template.end_time
        ):
            return False

        if not self._is_employee_qualified(employee, shift_template):
            return False

        # Check if employee has other shifts on this date
        employee_shifts = self._get_employee_shifts_for_date(employee, shift_date)

        # Check for overlapping shifts
        for existing_shift in employee_shifts:
            if hasattr(existing_shift, "start_time") and hasattr(
                existing_shift, "end_time"
            ):
                if shifts_overlap(
                    existing_shift.start_time,
                    existing_shift.end_time,
                    shift_template.start_time,
                    shift_template.end_time,
                ):
                    return False

        # Check if assignment would exceed constraints
        return not self._exceeds_constraints(employee, shift_date, shift_template)

    def _assign_employee_to_shift(self, employee, shift_template, shift_date):
        """Assign an employee to a shift and update all tracking data"""
        # First check if employee is on leave
        if self.resources.is_employee_on_leave(employee.id, shift_date):
            self._log_warning(
                f"Cannot assign employee {employee.first_name} {employee.last_name} "
                f"to shift {shift_template.id} on {shift_date} - employee is on leave"
            )
            return None

        # Check if employee is available for this time period
        if not self._is_employee_available(
            employee, shift_date, shift_template.start_time, shift_template.end_time
        ):
            self._log_warning(
                f"Cannot assign employee {employee.first_name} {employee.last_name} "
                f"to shift {shift_template.id} on {shift_date} - employee is not available"
            )
            return None

        # Determine availability_type based on employee availabilities
        availability_type = self._determine_availability_type(
            employee, shift_template, shift_date
        )

        # If employee is unavailable for this shift, don't assign
        if availability_type == AvailabilityType.UNAVAILABLE.value:
            self._log_warning(
                f"Cannot assign employee {employee.first_name} {employee.last_name} "
                f"to shift {shift_template.id} on {shift_date} - availability type is UNAVAILABLE"
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

        self._log_info(
            f"Successfully assigned {employee.first_name} {employee.last_name} "
            f"to shift {shift_template.id} on {shift_date}"
        )

        return shift_entry

    def _determine_availability_type(self, employee, shift_template, shift_date):
        """Determine availability type with thorough absence and availability checks"""
        # First check if employee is on leave
        if self.resources.is_employee_on_leave(employee.id, shift_date):
            return AvailabilityType.UNAVAILABLE.value

        # Check if employee is available for this time period
        if not self._is_employee_available(
            employee, shift_date, shift_template.start_time, shift_template.end_time
        ):
            return AvailabilityType.UNAVAILABLE.value

        # Get employee's availability records for this day
        availabilities = [
            a
            for a in self.resources.availabilities
            if a.employee_id == employee.id and a.day_of_week == shift_date.weekday()
        ]

        # If no availability records exist, consider unavailable
        if not availabilities:
            return AvailabilityType.UNAVAILABLE.value

        # Check each availability record
        for availability in availabilities:
            if not availability.is_available:
                return AvailabilityType.UNAVAILABLE.value
            if hasattr(availability, "availability_type"):
                return availability.availability_type.value

        # Default to AVAILABLE if no specific type is found but employee is available
        return AvailabilityType.AVAILABLE.value

    def _add_absence_warnings(self):
        """Check for scheduled shifts conflicting with absences"""
        for entry in self.schedule:
            if self.resources.is_employee_on_leave(entry.employee_id, entry.date):
                self.warnings.append(
                    {
                        "type": "absence_conflict",
                        "message": f"Employee {entry.employee_id} scheduled during leave on {entry.date}",
                        "severity": "error",
                        "employee_id": entry.employee_id,
                        "date": str(entry.date),
                    }
                )

    def get_distribution_metrics(self):
        """Get metrics about shift distribution fairness"""
        if not self.use_fair_distribution:
            return {
                "error": "Fair distribution not enabled for this schedule generation"
            }

        return self.distribution_manager.get_distribution_metrics()

    def _group_utilization_penalty(self, group: str) -> int:
        """Calculate penalty for overutilized groups"""
        group_utilization = {"TL": 0.75, "VZ": 0.71, "TZ": 1.06, "GFB": 3.81}.get(
            group, 1.0
        )

        if group_utilization > 1.0:
            return int(100 * group_utilization)  # Higher penalty for overutilization
        return 0

    def _get_available_employees(
        self, current_date: date, start_time: str, end_time: str
    ):
        """Get employees available for a specific time period"""
        all_employees = [e for e in self.resources.employees if e.is_active]
        self._log_info(f"Total active employees: {len(all_employees)}")

        available_employees = []
        for employee in all_employees:
            # Check leave first
            if self.resources.is_employee_on_leave(employee.id, current_date):
                self._log_debug(
                    f"Employee {employee.id} is on leave for {current_date}"
                )
                continue

            # Then check availability
            if self._is_employee_available(
                employee, current_date, start_time, end_time
            ):
                available_employees.append(employee)
            else:
                self._log_debug(
                    f"Employee {employee.id} is not available for "
                    f"{start_time}-{end_time} on {current_date}"
                )

        self._log_info(
            f"Found {len(available_employees)} available employees out of "
            f"{len(all_employees)} total active employees"
        )
        return available_employees

    def _validate_break_rules(self, schedule):
        # Implementation of _validate_break_rules method
        pass

    def _validate_qualifications(self, schedule):
        # Implementation of _validate_qualifications method
        pass

    def _find_matching_shifts(self, coverage):
        """Find shift templates that match coverage requirements"""
        matching_shifts = []
        for shift in self.resources.shifts:
            # Check if shift times overlap with coverage
            if self._shifts_overlap(
                coverage.start_time,
                coverage.end_time,
                shift.start_time,
                shift.end_time,
            ):
                matching_shifts.append(shift)
                self._log_info(
                    f"Found matching shift: ID={shift.id}, "
                    f"type={shift.shift_type_id}, "
                    f"time={shift.start_time}-{shift.end_time}"
                )
            else:
                self._log_debug(
                    f"Shift {shift.id} does not match coverage "
                    f"{coverage.start_time}-{coverage.end_time}"
                )

        return matching_shifts

    def _create_schedule_entries(
        self, assigned_employees, matching_shifts, current_date, version
    ):
        """Create schedule entries for assigned employees"""
        schedule_entries = []

        self._log_info(
            f"Creating schedule entries for {len(assigned_employees)} employees"
        )

        for employee in assigned_employees:
            # Find best matching shift for employee
            best_shift = None
            best_score = float("-inf")

            for shift in matching_shifts:
                score = self._get_shift_priority(shift, current_date)
                if score > best_score:
                    best_shift = shift
                    best_score = score

            if best_shift:
                self._log_info(
                    f"Best shift for employee {employee.id}: "
                    f"shift={best_shift.id}, score={best_score}"
                )

                # Determine availability type
                availability_type = self._determine_availability_type(
                    employee, best_shift, current_date
                )

                # Create schedule entry
                schedule_entry = Schedule(
                    employee_id=employee.id,
                    shift_id=best_shift.id,
                    date=current_date,
                    version=version,
                    availability_type=availability_type,
                )

                schedule_entries.append(schedule_entry)
                self.schedule.append(schedule_entry)
                self.schedule_by_date[current_date].append(schedule_entry)

                self._log_info(
                    f"Created schedule entry: "
                    f"employee={employee.id}, "
                    f"shift={best_shift.id}, "
                    f"type={availability_type}"
                )
            else:
                self._log_warning(f"No suitable shift found for employee {employee.id}")

        return schedule_entries

    def _prioritize_keyholders(self, candidates):
        """Prioritize keyholder employees in the candidate list"""
        return sorted(candidates, key=lambda e: not e.is_keyholder)

    def _initialize_config_from_settings(self) -> SchedulerConfig:
        """Initialize configuration from settings"""
        if not hasattr(self, "config") or self.config is None:
            self.config = SchedulerConfig()

            # Load any custom settings here if needed
            # For example:
            # if settings.get('max_consecutive_days'):
            #     self.config.max_consecutive_days = settings['max_consecutive_days']

        return self.config

    def _get_employee_shifts_for_date(self, employee, date):
        """Get all shifts assigned to an employee on a specific date"""
        return [
            entry.shift
            for entry in self.schedule_by_date.get(date, [])
            if entry.employee_id == employee.id and hasattr(entry, "shift")
        ]
