from datetime import date
from typing import List, Optional, Dict, Tuple
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
import logging
import functools


# Create a standard logger
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


class ScheduleResourceError(Exception):
    """Exception raised for errors in the ScheduleResources class"""

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
        return coverage

    def _load_shifts(self) -> List[ShiftTemplate]:
        """Load shifts with error handling"""
        shifts = ShiftTemplate.query.all()
        if not shifts:
            logger.error("No shift templates found in database")
            raise ScheduleResourceError("No shift templates found")
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

        # Clear the employee cache
        self._employee_cache = {}

        # Pre-fill employee cache with useful lookups
        for employee in employees:
            self._employee_cache[employee.id] = employee

        return employees

    def _load_absences(self) -> List[Absence]:
        """Load absences with error handling"""
        return Absence.query.all()

    def _load_availabilities(self) -> List[EmployeeAvailability]:
        """Load availabilities with error handling"""
        return EmployeeAvailability.query.filter(
            EmployeeAvailability.availability_type != AvailabilityType.UNAVAILABLE
        ).all()

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
                return False

        # Check if employee exists in the system - skip this check in test environments
        # where we may not have loaded employees but still need to test availability
        if self._employee_cache and employee_id not in self._employee_cache:
            return False

        # Check availability
        day_of_week = day.weekday()
        availabilities = self.get_employee_availability(employee_id, day_of_week)

        # If no availabilities are set, employee is unavailable
        if not availabilities:
            return False

        # Check if employee is available for all hours in the range
        for hour in range(start_hour, end_hour):
            hour_available = False
            for avail in availabilities:
                if (
                    avail.hour == hour
                    and avail.availability_type != AvailabilityType.UNAVAILABLE
                ):
                    hour_available = True
                    break
            if not hour_available:
                return False

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
