"""Resource management for the scheduler"""

from datetime import date
from typing import List, Optional, Dict, Tuple
import logging
import functools
import sys
import os

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Try to handle imports in different environments
ModelImportError_Primary = None # To store potential error for logging if all attempts fail
ModelImportError_Fallback1 = None
ModelImportError_Fallback2 = None
try:
    # Attempt 1: Standard package layout
    from backend.models import (
        Employee,
        ShiftTemplate,
        Settings,
        Coverage,
        db,
        Absence,
        EmployeeAvailability,
        Schedule,
    )
    from backend.models.employee import AvailabilityType, EmployeeGroup
except ImportError as e1:
    ModelImportError_Primary = e1
    try:
        # Attempt 2: Direct execution where 'models' is in path
        from models import (
            Employee,
            ShiftTemplate,
            Settings,
            Coverage,
            db,
            Absence,
            EmployeeAvailability,
            Schedule,
        )
        from models.employee import AvailabilityType, EmployeeGroup
    except ImportError as e2:
        ModelImportError_Fallback1 = e2
        try:
            # Attempt 3: Common alternative structure (e.g., src/backend/...)
            from src.backend.models import (
                Employee,
                ShiftTemplate,
                Settings,
                Coverage,
                db,
                Absence,
                EmployeeAvailability,
                Schedule,
            )
            from src.backend.models.employee import AvailabilityType, EmployeeGroup
        except ImportError as e3:
            ModelImportError_Fallback2 = e3
            # All imports failed. Log critical error.
            logging.getLogger(__name__).critical(
                f"All model imports failed. Primary: {ModelImportError_Primary}, Fallback1: {ModelImportError_Fallback1}, Fallback2: {ModelImportError_Fallback2}. Resources module will likely fail."
            )
            # Placeholder classes REMOVED. Runtime errors will occur if models are unavailable.
            # If running tests, mocks should be used.

# Create a standard logger
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


class ScheduleResourceError(Exception):
    """Exception raised for errors related to scheduler resources."""

    pass


class ScheduleResources:
    """Centralized container for schedule generation resources"""

    def __init__(self):
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

    def is_loaded(self):
        """Check if resources have already been loaded"""
        return len(self.employees) > 0

    def load(self):
        """Load all required resources"""
        try:
            self.logger.info("Loading scheduler resources...")

            # Load employees
            self.employees = self._load_employees()
            self.logger.debug(f"Loaded {len(self.employees)} employees")

            # Load shifts
            self.shifts = self._load_shifts()
            self.logger.debug(f"Loaded {len(self.shifts)} shifts")

            # Load coverage
            self.coverage = self._load_coverage()
            self.logger.debug(f"Loaded {len(self.coverage)} coverage records")

            # Load settings
            self.settings = self._load_settings()
            self.logger.debug(f"Loaded settings: {self.settings}")

            # Load absences
            self.absences = self._load_absences()
            self.logger.debug(f"Loaded {len(self.absences)} absences")

            # Load availabilities
            self.availabilities = self._load_availabilities()
            self.logger.debug(f"Loaded {len(self.availabilities)} availabilities")

            # Mark as loaded
            self._loaded = True
            self.logger.info("Resource loading complete")

        except Exception as e:
            self.logger.error(f"Error loading resources: {str(e)}")
            raise ScheduleResourceError(f"Failed to load resources: {str(e)}") from e

    def _load_settings(self) -> Settings:
        """Load settings with error handling"""
        try:
            settings = Settings.query.first()
            if not settings:
                logger.warning("No settings found, creating default settings")
                settings = Settings()
                db.session.add(settings)
                db.session.commit()
            return settings
        except Exception as e:
            self.logger.error(f"Error loading settings: {str(e)}")
            return None

    def _load_coverage(self) -> List[Coverage]:
        """Load coverage with error handling"""
        try:
            self.logger.info("Starting to load coverage data...")
            coverage = Coverage.query.all()

            if not coverage:
                self.logger.warning("No coverage requirements found in database")
                # Try to generate demo coverage data
                self.logger.info("Attempting to generate demo coverage data...")
                try:
                    from api.demo_data import generate_coverage_data

                    coverage_slots = generate_coverage_data()
                    for slot in coverage_slots:
                        db.session.add(slot)
                    db.session.commit()
                    self.logger.info(
                        f"Successfully generated {len(coverage_slots)} demo coverage slots"
                    )
                    coverage = Coverage.query.all()
                except Exception as e:
                    self.logger.error(
                        f"Failed to generate demo coverage data: {str(e)}"
                    )
                    return []

            # Log coverage requirements by day
            by_day = {}
            for cov in coverage:
                day_index = getattr(cov, "day_index", None)
                if day_index is None and hasattr(cov, "day_of_week"):
                    day_index = cov.day_of_week

                if day_index not in by_day:
                    by_day[day_index] = []
                by_day[day_index].append(cov)

                # Log individual coverage record details
                self.logger.debug(
                    f"Loaded coverage record: day_index={day_index}, "
                    f"start_time={getattr(cov, 'start_time', None)}, "
                    f"end_time={getattr(cov, 'end_time', None)}, "
                    f"min_employees={getattr(cov, 'min_employees', None)}, "
                    f"max_employees={getattr(cov, 'max_employees', None)}"
                )

            days = [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
            ]

            for day_idx, day_coverage in by_day.items():
                if day_idx is not None and 0 <= day_idx < len(days):
                    total_min_employees = sum(c.min_employees for c in day_coverage)
                    total_max_employees = sum(c.max_employees for c in day_coverage)
                    coverage_blocks = [
                        {
                            "start": getattr(c, "start_time", None),
                            "end": getattr(c, "end_time", None),
                            "min": getattr(c, "min_employees", 0),
                            "max": getattr(c, "max_employees", 0),
                        }
                        for c in day_coverage
                    ]
                    self.logger.info(
                        f"Coverage for {days[day_idx]}: "
                        f"{len(day_coverage)} blocks, "
                        f"min employees: {total_min_employees}, "
                        f"max employees: {total_max_employees}, "
                        f"blocks: {coverage_blocks}"
                    )

            self.logger.info(f"Successfully loaded {len(coverage)} coverage records")
            return coverage

        except Exception as e:
            self.logger.error(f"Error loading coverage: {str(e)}")
            return []

    def _load_shifts(self) -> List[ShiftTemplate]:
        """Load shifts with error handling"""
        try:
            shifts = ShiftTemplate.query.all()
            if not shifts:
                logger.error("No shift templates found in database")
                raise ScheduleResourceError("No shift templates found")

            # Log shift details
            for shift in shifts:
                logger.info(
                    f"Loaded shift template: ID={shift.id}, "
                    f"start={shift.start_time}, end={shift.end_time}, "
                    f"type={shift.shift_type_id}"
                )
            return shifts
        except Exception as e:
            self.logger.error(f"Error loading shifts: {str(e)}")
            return []

    def _load_employees(self) -> List[Employee]:
        """Load employees from database"""
        try:
            employees = Employee.query.filter_by(is_active=True).all()
            self.logger.debug(f"Loaded {len(employees)} active employees from database")
            return employees
        except Exception as e:
            self.logger.error(f"Error loading employees: {str(e)}")
            return []

    def _load_absences(self) -> List[Absence]:
        """Load absences with error handling"""
        return Absence.query.all()

    def _load_availabilities(self) -> List[EmployeeAvailability]:
        """Load availabilities with error handling"""
        availabilities = EmployeeAvailability.query.all()

        # Group availabilities by employee for better logging
        by_employee = {}
        for avail in availabilities:
            if avail.employee_id not in by_employee:
                by_employee[avail.employee_id] = []
            by_employee[avail.employee_id].append(avail)

        # Log availability summary for each employee
        for emp_id, emp_avails in by_employee.items():
            available_hours = sum(1 for a in emp_avails if a.is_available)
            total_hours = len(emp_avails)
            logger.info(
                f"Employee {emp_id} availability: "
                f"{available_hours}/{total_hours} hours available"
            )

        return availabilities

    def get_keyholders(self) -> List[Employee]:
        """Return a list of keyholder employees"""
        return [emp for emp in self.employees if getattr(emp, 'is_keyholder', False) is True]

    def get_employees_by_group(self, group: EmployeeGroup) -> List[Employee]:
        """Return employees filtered by employee group"""
        return [emp for emp in self.employees if getattr(emp, 'employee_group', None) == group]

    @functools.lru_cache(maxsize=128)
    def get_daily_coverage(self, day: date) -> List[Coverage]:
        """Get coverage requirements for a specific day"""
        # Reset the cache if we haven't done so yet to avoid old data
        if not self._date_caches_cleared:
            self.get_daily_coverage.cache_clear()
            self._date_caches_cleared = True

        weekday = day.weekday()
        return [cov for cov in self.coverage if getattr(cov, 'day_index', None) == weekday]

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
            if getattr(absence, 'employee_id', None) == employee_id:
                absence_end = getattr(absence, 'end_date', None)
                absence_start = getattr(absence, 'start_date', None)
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
                if getattr(avail, 'hour', None) == hour:
                    # Explicit boolean check for is_available
                    is_avail_flag = getattr(avail, 'is_available', False) is True 
                    avail_type = getattr(avail, 'availability_type', None)
                    # Check type comparison
                    is_not_unavailable = avail_type is not None and avail_type != AvailabilityType.UNAVAILABLE
                    
                    if is_avail_flag or is_not_unavailable:
                        hour_available = True
                        break
                    else:
                        logger.info(
                            f"Employee {employee_id} is unavailable at hour {hour}. "
                            f"is_available={avail.is_available}, "
                            f"type={avail.availability_type.value if avail.availability_type else 'None'}"
                        )
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
        if employee_id in self._employee_cache:
            return self._employee_cache[employee_id]
        for emp in self.employees:
            if hasattr(emp, 'id') and emp.id == employee_id:
                self._employee_cache[employee_id] = emp
                return emp
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
        """Verify that all required resources are loaded correctly"""
        if not self._loaded:
            self.logger.error("Resources not loaded yet")
            return False

        # Check employees
        if not self.employees:
            self.logger.error("No employees loaded")
            return False
        self.logger.info(f"Verified {len(self.employees)} employees")

        # Check shifts
        if not self.shifts:
            self.logger.error("No shifts loaded")
            return False
        self.logger.info(f"Verified {len(self.shifts)} shifts")

        # Check coverage
        if not self.coverage:
            self.logger.error("No coverage data loaded")
            return False
        self.logger.info(f"Verified {len(self.coverage)} coverage records")

        # Check settings
        if not self.settings:
            self.logger.error("No settings loaded")
            return False
        self.logger.info("Verified settings")

        return True
