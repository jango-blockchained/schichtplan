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
try:
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
except ImportError:
    try:
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
    except ImportError:
        try:
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
        except ImportError:
            # Create placeholder classes for standalone testing
            pass

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

    def is_loaded(self):
        """Check if resources have already been loaded"""
        return len(self.employees) > 0

    def load(self):
        """Load all required resources from database"""
        try:
            self.settings = self._load_settings()
            self.coverage = self._load_coverage()
            self.shifts = self._load_shifts()
            self.employees = self._load_employees()
            self.absences = self._load_absences()
            self.availabilities = self._load_availabilities()
            logger.info("Successfully loaded all schedule resources")
            return True
        except Exception as e:
            logger.error(f"Failed to load schedule resources: {str(e)}")
            raise ScheduleResourceError(f"Failed to load resources: {str(e)}") from e

    def _load_settings(self) -> Settings:
        """Load settings with error handling"""
        settings = Settings.query.first()
        if not settings:
            logger.warning("No settings found, creating default settings")
            settings = Settings()
            db.session.add(settings)
            db.session.commit()
        return settings

    def _load_coverage(self) -> List[Coverage]:
        """Load coverage with error handling"""
        coverage = Coverage.query.all()
        if not coverage:
            logger.warning("No coverage requirements found")
            return []

        # Log coverage requirements by day
        by_day = {}
        for cov in coverage:
            if cov.day_index not in by_day:
                by_day[cov.day_index] = []
            by_day[cov.day_index].append(cov)

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
            total_employees = sum(c.min_employees for c in day_coverage)
            logger.info(
                f"Coverage for {days[day_idx]}: "
                f"{len(day_coverage)} shifts, "
                f"{total_employees} total employees needed"
            )

        return coverage

    def _load_shifts(self) -> List[ShiftTemplate]:
        """Load shifts with error handling"""
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

    def _load_employees(self) -> List[Employee]:
        """Load employees in priority order"""
        employees = (
            Employee.query.filter_by(is_active=True)
            .order_by(
                db.case(
                    {
                        EmployeeGroup.TL.value: 1,
                        EmployeeGroup.VZ.value: 2,
                        EmployeeGroup.TZ.value: 3,
                        EmployeeGroup.GFB.value: 4,
                    },
                    value=Employee.employee_group,
                )
            )
            .all()
        )

        if not employees:
            logger.warning("No active employees found")
            return []

        # Clear the employee cache
        self._employee_cache = {}

        # Log employee details and pre-fill cache
        for employee in employees:
            logger.info(
                f"Loaded employee: ID={employee.id}, "
                f"group={employee.employee_group}, "
                f"keyholder={employee.is_keyholder}"
            )
            self._employee_cache[employee.id] = employee

        return employees

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
        return [emp for emp in self.employees if emp.is_keyholder]

    def get_employees_by_group(self, group: EmployeeGroup) -> List[Employee]:
        """Return employees filtered by employee group"""
        return [emp for emp in self.employees if emp.employee_group == group]

    @functools.lru_cache(maxsize=128)
    def get_daily_coverage(self, day: date) -> List[Coverage]:
        """Get coverage requirements for a specific day"""
        # Reset the cache if we haven't done so yet to avoid old data
        if not self._date_caches_cleared:
            self.get_daily_coverage.cache_clear()
            self._date_caches_cleared = True

        weekday = day.weekday()
        return [cov for cov in self.coverage if cov.day_index == weekday]

    def get_employee_absences(
        self, employee_id: int, start_date: date, end_date: date
    ) -> List[Absence]:
        """Get absences for an employee in a date range"""
        # Check if employee exists to avoid unnecessary processing
        if employee_id not in self._employee_cache:
            return []

        return [
            absence
            for absence in self.absences
            if absence.employee_id == employee_id
            and not (absence.end_date < start_date or absence.start_date > end_date)
        ]

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
        for absence in self.absences:
            if (
                absence.employee_id == employee_id
                and absence.start_date <= day <= absence.end_date
            ):
                logger.info(f"Employee {employee_id} is absent on {day}")
                return False

        # Check if employee exists in the system - skip this check in test environments
        # where we may not have loaded employees but still need to test availability
        if self._employee_cache and employee_id not in self._employee_cache:
            logger.info(f"Employee {employee_id} not found in cache")
            return False

        # Check availability
        day_of_week = day.weekday()
        availabilities = self.get_employee_availability(employee_id, day_of_week)

        # If no availabilities are set, employee is unavailable
        if not availabilities:
            logger.info(
                f"Employee {employee_id} has no availability records for day {day_of_week}"
            )
            return False

        # Check if employee is available for all hours in the range
        for hour in range(start_hour, end_hour):
            hour_available = False
            for avail in availabilities:
                if avail.hour == hour:
                    # MODIFIED: Employee is available if EITHER:
                    # 1. is_available flag is true OR
                    # 2. availability_type is not UNAVAILABLE
                    if avail.is_available or (
                        avail.availability_type
                        and avail.availability_type != AvailabilityType.UNAVAILABLE
                    ):
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
        return self._employee_cache.get(employee_id)

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
