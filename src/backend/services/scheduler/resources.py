"""Resource management for the scheduler"""

from datetime import date
from typing import Dict, List, Optional, Tuple, Any
import logging
import functools
import sys
import os
from flask import current_app

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Use centralized import utilities
from .import_utils import safe_import_models, ModelImportError
from .validation_utils import (
    validate_shift_template, validate_coverage_rule, validate_employee_data,
    validate_batch_data, log_validation_results, ValidationError
)

# Import models using the centralized utility
try:
    (Employee, ShiftTemplate, Settings, Coverage, db, Absence, 
     EmployeeAvailability, Schedule, AvailabilityType, EmployeeGroup) = safe_import_models(use_mocks_on_failure=True)
    import_logger = logging.getLogger(__name__)
    import_logger.info("Successfully imported models for resources module")
except ModelImportError as e:
    import_logger = logging.getLogger(__name__)
    import_logger.critical(f"Failed to import models: {e}")
    raise

# Configure logger
# logger = logging.getLogger(__name__) # Original logger
logger = logging.getLogger("schedule")  # Explicitly use the 'schedule' logger


class ScheduleResourceError(Exception):
    """Exception raised for errors related to scheduler resources."""

    pass


class ScheduleResources:
    """Centralized container for schedule generation resources"""

    def __init__(self, app_instance: Optional[Any] = None):
        self.settings: Optional[Settings] = None
        self.coverage: List[Coverage] = []
        self.shifts: List[ShiftTemplate] = []
        self.employees: List[Employee] = []
        self.absences: List[Absence] = []
        self.availabilities: List[EmployeeAvailability] = []
        self.schedule_data: Dict[Tuple[int, date], Schedule] = {}
        # Caches for frequently accessed data
        self._employee_cache = {}
        self._coverage_cache = {}
        self._date_caches_cleared = False
        self.logger = logger
        self.app_instance = app_instance

    def is_loaded(self):
        """Check if resources have been loaded"""
        return all(
            [
                self.settings is not None,
                self.coverage is not None,
                self.shifts is not None,
                self.employees is not None,
                self.absences is not None,
                self.availabilities is not None,
            ]
        )

    def load(self):
        """Loads all necessary resources from the database."""
        self.logger.info("Starting to load resources...")
        try:
            # Use the provided app_instance for context if available, otherwise rely on current_app
            if self.app_instance:
                ctx = self.app_instance.app_context()
            else:
                try:
                    from flask import current_app

                    ctx = current_app.app_context()
                except RuntimeError:
                    # If no current app is available, try to create one
                    from src.backend.app import create_app

                    app = create_app()
                    ctx = app.app_context()

            # Properly use the context manager with 'with' statement
            with ctx:
                self.logger.debug(
                    "Executing resource loading within Flask app context."
                )
                self.settings = self._load_settings()
                self.coverage = self._load_coverage()
                self.shifts = self._load_shifts()
                self.employees = self._load_employees()
                self.absences = self._load_absences()
                self.availabilities = self._load_availabilities()

                # Load existing schedule data if needed
                # This might be heavy, only do if necessary for initialization
                # self.schedule_data = self._load_schedule_data() # Uncomment if needed

            self.logger.info("Resource loading completed successfully.")
            # Verify resources *after* they are loaded
            if not self.verify_loaded_resources():
                raise ScheduleResourceError("Resource verification failed")

        except ScheduleResourceError as e:
            # Catch specific resource errors and re-raise after logging
            self.logger.error(f"Error during resource loading: {e}", exc_info=True)
            raise
        except Exception as e:
            # Catch any other unexpected exceptions during loading
            self.logger.error(
                f"An unexpected error occurred during resource loading: {e}",
                exc_info=True,
            )
            raise ScheduleResourceError(f"An unexpected error occurred: {e}") from e

    def _load_settings(self):
        """Load settings with error handling"""
        try:
            # Create app context
            if self.app_instance:
                ctx = self.app_instance.app_context()
            else:
                try:
                    from flask import current_app

                    ctx = current_app.app_context()
                except RuntimeError:
                    # If no current app is available, try to create one
                    from src.backend.app import create_app

                    app = create_app()
                    ctx = app.app_context()

            # Properly use the context manager
            with ctx:
                settings = Settings.query.first()

            if not settings:
                self.logger.error("No settings found in database, will use defaults")
                return None

            self.logger.info("Settings loaded successfully")
            return settings
        except Exception as e:
            self.logger.error(f"Error loading settings: {str(e)}", exc_info=True)
            return None

    def _load_coverage(self) -> List[Coverage]:
        """Load coverage with error handling"""
        try:
            self.logger.info("Starting to load coverage data...")
            app_context = (
                self.app_instance.app_context()
                if self.app_instance
                else current_app.app_context()
            )
            with app_context:  # Wrap query in app context
                coverage = Coverage.query.all()

            if not coverage:
                self.logger.warning("No coverage requirements found in database")
                # Try to generate demo coverage data
                self.logger.info("Attempting to generate demo coverage data...")
                try:
                    from api.demo_data import generate_coverage_data

                    coverage_slots = generate_coverage_data()
                    app_context = (
                        self.app_instance.app_context()
                        if self.app_instance
                        else current_app.app_context()
                    )
                    with app_context:  # Wrap session add/commit
                        for slot in coverage_slots:
                            db.session.add(slot)
                        db.session.commit()
                    self.logger.info(
                        f"Successfully generated {len(coverage_slots)} demo coverage slots"
                    )
                    app_context = (
                        self.app_instance.app_context()
                        if self.app_instance
                        else current_app.app_context()
                    )
                    with app_context:  # Wrap re-query
                        coverage = Coverage.query.all()  # Re-query after generating
                    if not coverage:  # Check again if demo data actually populated
                        self.logger.error(
                            "Failed to load any coverage even after attempting to generate demo data."
                        )
                        return []
                except (
                    Exception
                ) as e:  # Keep original exception handling for demo data generation
                    self.logger.error(
                        f"Failed to generate demo coverage data: {str(e)}"
                    )
                    return []  # Important: if demo data gen fails, and initial was empty, return empty.

            self.logger.info(f"Loaded {len(coverage)} coverage records. Details:")
            for cov_idx, cov_item in enumerate(coverage):
                self.logger.info(
                    f"  Coverage[{cov_idx}]: id={getattr(cov_item, 'id', 'N/A')}, "
                    f"day={getattr(cov_item, 'day_index', 'N/A')}, "
                    f"start={getattr(cov_item, 'start_time', 'N/A')}-end={getattr(cov_item, 'end_time', 'N/A')}, "
                    f"min_emp={getattr(cov_item, 'min_employees', 'N/A')}, "
                    f"req_keyholder={getattr(cov_item, 'requires_keyholder', 'N/A')}"
                )

            # Log coverage requirements by day
            by_day = {}
            for day_idx in range(7):
                day_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day_idx]
                # Filter coverage for the current day
                day_specific_coverage = [
                    c for c in coverage if getattr(c, "day_index", -1) == day_idx
                ]
                if day_specific_coverage:
                    self.logger.info(
                        f"  {day_name} ({day_idx}): {len(day_specific_coverage)} coverage blocks"
                    )
                    # for c_idx, c_item in enumerate(day_specific_coverage):
                    #    self.logger.debug(f"    {c_idx}: Start: {c_item.start_time}, End: {c_item.end_time}, MinEmp: {c_item.min_employees}, KeyH: {c_item.requires_keyholder}")
                else:
                    self.logger.info(f"  {day_name} ({day_idx}): No coverage blocks")

            self.logger.info(f"Successfully loaded {len(coverage)} coverage records")
            return coverage

        except Exception as e:
            self.logger.error(
                f"Error loading coverage: {str(e)}", exc_info=True
            )  # Added exc_info
            return []

    def _load_shifts(self) -> List[ShiftTemplate]:
        """Load shifts with error handling"""
        try:
            # Create app context
            if self.app_instance:
                ctx = self.app_instance.app_context()
            else:
                try:
                    from flask import current_app

                    ctx = current_app.app_context()
                except RuntimeError:
                    # If no current app is available, try to create one
                    from src.backend.app import create_app

                    app = create_app()
                    ctx = app.app_context()

            # Properly use the context manager
            with ctx:
                shifts = ShiftTemplate.query.all()

            if not shifts:
                self.logger.error("No shift templates found in database")
                return []

            self.logger.info(
                f"Successfully loaded {len(shifts)} shift templates. Verifying times..."
            )
            for shift in shifts:
                start_time_val = getattr(shift, "start_time", "MISSING_ATTRIBUTE")
                end_time_val = getattr(shift, "end_time", "MISSING_ATTRIBUTE")
                active_days_val = getattr(shift, "active_days", "MISSING_ATTRIBUTE")
                shift_name = getattr(shift, "name", "N/A")

                self.logger.info(
                    f"Loaded ShiftTemplate: id={shift.id}, name='{shift_name}', "
                    f"raw_start_time='{start_time_val}' (type: {type(start_time_val)}), "
                    f"raw_end_time='{end_time_val}' (type: {type(end_time_val)}), "
                    f"active_days={active_days_val}"
                )

                # Basic validation check for format (doesn't guarantee parseability by int)
                is_start_time_valid_format = (
                    isinstance(start_time_val, str)
                    and len(start_time_val) == 5
                    and ":" in start_time_val
                )
                is_end_time_valid_format = (
                    isinstance(end_time_val, str)
                    and len(end_time_val) == 5
                    and ":" in end_time_val
                )

                if (
                    not is_start_time_valid_format
                    and start_time_val != "MISSING_ATTRIBUTE"
                ):
                    self.logger.warning(
                        f"ShiftTemplate id={shift.id} name='{shift_name}' has an invalid start_time format or type: '{start_time_val}'"
                    )
                if not is_end_time_valid_format and end_time_val != "MISSING_ATTRIBUTE":
                    self.logger.warning(
                        f"ShiftTemplate id={shift.id} name='{shift_name}' has an invalid end_time format or type: '{end_time_val}'"
                    )

            return shifts
        except Exception as e:
            self.logger.error(f"Error loading shifts: {str(e)}", exc_info=True)
            return []

    def _load_employees(self) -> List[Employee]:
        """Load employees from database"""
        try:
            # Create app context
            if self.app_instance:
                ctx = self.app_instance.app_context()
            else:
                try:
                    from flask import current_app

                    ctx = current_app.app_context()
                except RuntimeError:
                    # If no current app is available, try to create one
                    from src.backend.app import create_app

                    app = create_app()
                    ctx = app.app_context()

            # Properly use the context manager
            with ctx:
                employees = Employee.query.filter_by(is_active=True).all()

            self.logger.debug(f"Loaded {len(employees)} active employees from database")
            return employees
        except Exception as e:
            self.logger.error(
                f"Error loading employees: {str(e)}", exc_info=True
            )  # Added exc_info
            return []

    def _load_absences(self) -> List[Absence]:
        """Load absences with error handling"""
        try:
            # Create app context
            if self.app_instance:
                ctx = self.app_instance.app_context()
            else:
                try:
                    from flask import current_app

                    ctx = current_app.app_context()
                except RuntimeError:
                    # If no current app is available, try to create one
                    from src.backend.app import create_app

                    app = create_app()
                    ctx = app.app_context()

            # Properly use the context manager
            with ctx:
                return Absence.query.all()

        except Exception as e:
            self.logger.error(
                f"Error loading absences: {str(e)}", exc_info=True
            )  # Added exc_info
            return []

    def _load_availabilities(self) -> List[EmployeeAvailability]:
        """Load availabilities with error handling"""
        try:
            # Create app context
            if self.app_instance:
                ctx = self.app_instance.app_context()
            else:
                try:
                    from flask import current_app

                    ctx = current_app.app_context()
                except RuntimeError:
                    # If no current app is available, try to create one
                    from src.backend.app import create_app

                    app = create_app()
                    ctx = app.app_context()

            # Properly use the context manager
            with ctx:
                availabilities = EmployeeAvailability.query.all()

            # Group availabilities by employee for better logging
            by_employee = {}
            for avail in availabilities:
                if avail.employee_id not in by_employee:
                    by_employee[avail.employee_id] = []
                by_employee[avail.employee_id].append(avail)

            self.logger.info(f"Loaded {len(availabilities)} availability records")
            return availabilities
        except Exception as e:
            self.logger.error(f"Error loading availabilities: {str(e)}", exc_info=True)
            return []

    def get_keyholders(self) -> List[Employee]:
        """Return a list of keyholder employees"""
        return [
            emp for emp in self.employees if getattr(emp, "is_keyholder", False) is True
        ]

    def get_employees_by_group(self, group: EmployeeGroup) -> List[Employee]:
        """Return employees filtered by employee group"""
        return [
            emp
            for emp in self.employees
            if getattr(emp, "employee_group", None) == group
        ]

    @functools.lru_cache(maxsize=128)
    def get_daily_coverage(self, day: date) -> List[Coverage]:
        """Get coverage requirements for a specific day"""
        # Reset the cache if we haven't done so yet to avoid old data
        if not self._date_caches_cleared:
            self.get_daily_coverage.cache_clear()
            self._date_caches_cleared = True

        weekday = day.weekday()
        return [
            cov for cov in self.coverage if getattr(cov, "day_index", None) == weekday
        ]

    def get_employee_absences(
        self, employee_id: int, start_date: date, end_date: date
    ) -> List[Absence]:
        """Get absences for an employee in a date range"""
        # Check if employee exists to avoid unnecessary processing
        if self.get_employee(employee_id) is None:
            return []

        absences_found = []
        for absence in self.absences:
            # Use getattr for safety
            if getattr(absence, "employee_id", None) == employee_id:
                absence_end = getattr(absence, "end_date", None)
                absence_start = getattr(absence, "start_date", None)
                # Ensure dates are valid before comparing
                if isinstance(absence_end, date) and isinstance(absence_start, date):
                    if not (absence_end < start_date or absence_start > end_date):
                        absences_found.append(absence)
        return absences_found

    def get_employee_availability(
        self, employee_id: int, day_of_week: int
    ) -> List[EmployeeAvailability]:
        """Get availability for an employee on a specific day of week"""
        # Skip employee cache check in testing environments
        # where we may not have loaded employees
        if self._employee_cache and employee_id not in self._employee_cache:
            return []

        return [
            avail
            for avail in self.availabilities
            if avail.employee_id == employee_id and avail.day_of_week == day_of_week
        ]

    def is_employee_available(
        self, employee_id: int, day: date, start_hour: int, end_hour: int
    ) -> bool:
        """Check if an employee is available for a time slot"""
        # First, check if this is a special day when the store is closed
        if self.settings:
            date_str = day.strftime("%Y-%m-%d")
            if hasattr(self.settings, "special_days") and self.settings.special_days:
                if (
                    date_str in self.settings.special_days
                    and self.settings.special_days[date_str].get("is_closed", False)
                ):
                    logger.info(
                        f"Date {date_str} is a closed special day. No employee is available."
                    )
                    return False
            elif (
                hasattr(self.settings, "special_hours") and self.settings.special_hours
            ):
                if (
                    date_str in self.settings.special_hours
                    and self.settings.special_hours[date_str].get("is_closed", False)
                ):
                    logger.info(
                        f"Date {date_str} is closed via special_hours. No employee is available."
                    )
                    return False
        # Check for absences first
        if self.is_employee_on_leave(employee_id, day):
            logger.info(f"Employee {employee_id} is absent on {day}")
            return False
        # Check if employee exists
        if self.get_employee(employee_id) is None:
            logger.info(f"Employee {employee_id} not found")
            return False
        # Check availability
        day_of_week = day.weekday()
        availabilities = self.get_employee_availability(employee_id, day_of_week)
        if not availabilities:
            logger.info(
                f"Employee {employee_id} has no availability records for day {day_of_week}"
            )
            return False
        # Check if employee is available for all hours in the range
        for hour in range(start_hour, end_hour):
            hour_available = False
            for avail in availabilities:
                if getattr(avail, "hour", None) == hour:
                    avail_type = getattr(avail, "availability_type", None)
                    # Accept AVAILABLE or PREFERRED as available
                    if avail_type in (
                        AvailabilityType.AVAILABLE,
                        AvailabilityType.PREFERRED,
                    ):
                        hour_available = True
                        break
                    # Fallback: if is_available is True, also accept
                    if getattr(avail, "is_available", False) is True:
                        hour_available = True
                        break
            if not hour_available:
                logger.info(
                    f"Employee {employee_id} is not available at hour {hour} on day {day}"
                )
                return False
        logger.info(
            f"Employee {employee_id} is available on {day} from {start_hour} to {end_hour}"
        )
        return True

    def get_schedule_data(self) -> Dict[Tuple[int, date], Schedule]:
        """Get schedule data"""
        return self.schedule_data

    def add_schedule_entry(self, employee_id: int, date: date, schedule: Schedule):
        """Add a schedule entry"""
        self.schedule_data[(employee_id, date)] = schedule

    def get_schedule_entry(self, employee_id: int, date: date) -> Optional[Schedule]:
        """Get a schedule entry"""
        return self.schedule_data.get((employee_id, date))

    def remove_schedule_entry(self, employee_id: int, date: date):
        """Remove a schedule entry"""
        if (employee_id, date) in self.schedule_data:
            del self.schedule_data[(employee_id, date)]

    def clear_schedule_data(self):
        """Clear all schedule data"""
        self.schedule_data = {}

    def get_active_employees(self) -> List[Employee]:
        """Get list of active employees (for backward compatibility)"""
        return self.employees

    def get_employee(self, employee_id: int) -> Optional[Employee]:
        """Get an employee by ID (cached)"""
        # Always check self.employees if set, to support test mocks
        for emp in getattr(self, "employees", []):
            if hasattr(emp, "id") and emp.id == employee_id:
                self._employee_cache[employee_id] = emp
                return emp
        if employee_id in self._employee_cache:
            return self._employee_cache[employee_id]
        return None

    def get_employee_availabilities(
        self, employee_id: int, day: date
    ) -> List[EmployeeAvailability]:
        """Get all availabilities for an employee on a specific date"""
        day_of_week = day.weekday()
        return [
            avail
            for avail in self.availabilities
            if avail.employee_id == employee_id and avail.day_of_week == day_of_week
        ]

    def get_shift(self, shift_id: int) -> Optional[ShiftTemplate]:
        """Get a shift template by ID"""
        if not shift_id:
            return None
        return next((shift for shift in self.shifts if shift.id == shift_id), None)

    def clear_caches(self):
        """Clear all caches"""
        self.get_daily_coverage.cache_clear()
        self._employee_cache = {}
        self._coverage_cache = {}
        self._date_caches_cleared = False

    def is_employee_on_leave(self, employee_id: int, date: date) -> bool:
        """Check if employee is on leave for given date"""
        return any(
            leave
            for leave in self.absences
            if leave.employee_id == employee_id
            and leave.start_date <= date <= leave.end_date
        )

    def verify_loaded_resources(self):
        """
        Verifies that all necessary resources have been loaded.
        Returns True if verification passes, False otherwise.
        """
        self.logger.info("Verifying loaded resources...")
        # Basic check: ensure core lists are not None and have some expected data
        if (
            not self.is_loaded()
            or self.settings is None
            or self.employees is None
            or self.shifts is None
            or self.coverage is None
            or self.availabilities is None
            or self.absences is None
        ):
            self.logger.error(
                "One or more core resource types are missing or not loaded."
            )
            # More detailed logging:
            self.logger.error(f"Load status: is_loaded={self.is_loaded()}")
            self.logger.error(f"Settings loaded: {self.settings is not None}")
            self.logger.error(f"Employees count: {len(self.employees) if self.employees else 0}")
            self.logger.error(f"Shifts count: {len(self.shifts) if self.shifts else 0}")
            self.logger.error(f"Coverage count: {len(self.coverage) if self.coverage else 0}")
            self.logger.error(f"Availabilities count: {len(self.availabilities) if self.availabilities else 0}")
            self.logger.error(f"Absences count: {len(self.absences) if self.absences else 0}")
            return False

        self.logger.info(f"Resource verification passed - Employees: {len(self.employees)}, Shifts: {len(self.shifts)}, Coverage: {len(self.coverage)}")
        return True
