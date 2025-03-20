"""Resource management for the scheduler"""

from datetime import date, datetime
from typing import List, Optional, Dict, Tuple, Any
import logging
import functools
import sys
import os

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(os.path.dirname(current_dir))
project_dir = os.path.dirname(backend_dir)
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

# Import demo_data only when needed to avoid circular imports
# from api.demo_data import generate_coverage_data

# Try to handle imports in different environments
try:
    # First try importing from src.backend.models
    from src.backend.models import (
        Employee,
        ShiftTemplate as Shift,
        Settings,
        Coverage,
        db,
        Absence,
        EmployeeAvailability,
        Schedule,
    )
    from src.backend.models.employee import AvailabilityType, EmployeeGroup

    # The Session is likely from db
    Session = db.session
except (ImportError, AttributeError):
    # Then try importing from models
    try:
        from models import (
            Employee,
            ShiftTemplate as Shift,
            Settings,
            Coverage,
            db,
            Absence,
            EmployeeAvailability,
            Schedule,
        )
        from models.employee import AvailabilityType, EmployeeGroup

        # The Session is likely from db
        Session = db.session
    except (ImportError, AttributeError):
        # Finally try a relative import
        try:
            from ...models import (
                Employee,
                ShiftTemplate as Shift,
                Settings,
                Coverage,
                db,
                Absence,
                EmployeeAvailability,
                Schedule,
            )
            from ...models.employee import AvailabilityType, EmployeeGroup

            # The Session is likely from db
            Session = db.session
        except (ImportError, AttributeError) as e:
            print(f"Error importing models: {e}")
            # We'll define placeholder classes for testing
            Employee = None
            Shift = None
            Settings = None
            Coverage = None
            db = None
            Session = None
            Absence = None
            EmployeeAvailability = None
            Schedule = None

            # Define placeholder enums
            class AvailabilityType:
                AVAILABLE = "AVL"
                FIXED = "FIX"
                PREFERRED = "PRF"
                UNAVAILABLE = "UNV"

            class EmployeeGroup:
                VZ = "VZ"
                TZ = "TZ"
                GFB = "GFB"
                TL = "TL"


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
    """Resource manager for schedule generation"""

    def __init__(self, db_session=None):
        """Initialize the resource manager"""
        self.logger = logging.getLogger(__name__)
        self.db = db_session
        if not self.db:
            from models import db

            self.db = db.session

        # Initialize caches
        self._employee_cache = {}
        self._shift_cache = {}
        self._coverage_cache = {}
        self._availability_cache = {}
        self._absence_cache = {}

        # Initialize data containers
        self.settings = None
        self.coverage = []
        self.shifts = []
        self.employees = []
        self.absences = []
        self.availabilities = []
        self.schedule_data = None

    def verify_loaded_resources(self) -> bool:
        """Verify that all required resources are loaded"""
        if not self.shifts:
            self.logger.error("No shifts loaded")
            return False
        if not self.coverage:
            self.logger.error("No coverage loaded")
            return False
        if not self.employees:
            self.logger.error("No employees loaded")
            return False
        return True

    def load(self) -> None:
        """Load all required resources"""
        try:
            # Load settings first as they may affect other resources
            self.settings = self._load_settings()

            # Load core resources
            self.employees = self._load_employees()
            self.shifts = self._load_shifts()
            self.coverage = self._load_coverage()

            # Load additional resources
            self.absences = self._load_absences()
            self.availabilities = self._load_availabilities()

            # Verify resources
            if not self.verify_loaded_resources():
                raise ValueError("Failed to load all required resources")

            self.logger.info("Successfully loaded all resources")

        except Exception as e:
            self.logger.error(f"Error loading resources: {str(e)}")
            raise

    def _load_settings(self) -> Settings:
        """Load settings with error handling"""
        try:
            settings = Settings.query.first()
            if settings:
                self.logger.info(f"Successfully loaded settings: {settings}")
                return settings
            else:
                self.logger.warning("No settings found in database")
                return None

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
                    # Import demo_data only when needed to avoid circular imports
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
                    self.logger.error(f"Error generating demo coverage data: {str(e)}")
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

            # Cache coverage by day
            self._coverage_cache = by_day

            return coverage

        except Exception as e:
            self.logger.error(f"Error loading coverage: {str(e)}")
            return []

    def _load_shifts(self) -> List[Dict[str, Any]]:
        """Load shifts from the database"""
        try:
            self.logger.info("Loading shifts...")

            # Query all shifts from the database
            shifts = self.db.query(Shift).all()
            if not shifts:
                self.logger.warning("No shifts found in database")
                return []

            # Convert shifts to dictionaries and validate
            shift_dicts = []
            invalid_shifts = []

            for shift in shifts:
                try:
                    shift_dict = {
                        "id": shift.id,
                        "type": shift.type,
                        "day_index": shift.day_index,
                        "start_time": shift.start_time,
                        "end_time": shift.end_time,
                        "duration": None,  # Will be calculated below
                    }

                    # Calculate duration
                    if shift.start_time is not None and shift.end_time is not None:
                        start_dt = datetime.strptime(shift.start_time, "%H:%M")
                        end_dt = datetime.strptime(shift.end_time, "%H:%M")
                        duration = (
                            end_dt - start_dt
                        ).seconds / 3600  # Convert to hours
                        shift_dict["duration"] = duration

                        # Validate duration
                        if duration <= 0:
                            self.logger.warning(
                                f"Invalid duration for shift {shift.id}: {duration} hours"
                            )
                            invalid_shifts.append(shift.id)
                            continue
                    else:
                        self.logger.warning(
                            f"Missing start or end time for shift {shift.id}"
                        )
                        invalid_shifts.append(shift.id)
                        continue

                    shift_dicts.append(shift_dict)
                    self.logger.debug(f"Loaded shift: {shift_dict}")

                except Exception as e:
                    self.logger.error(f"Error processing shift {shift.id}: {str(e)}")
                    invalid_shifts.append(shift.id)

            # Remove invalid shifts
            if invalid_shifts:
                self.logger.warning(
                    f"Removed {len(invalid_shifts)} invalid shifts: {invalid_shifts}"
                )

            # Cache valid shifts
            self._shift_cache = {shift["id"]: shift for shift in shift_dicts}

            self.logger.info(f"Successfully loaded {len(shift_dicts)} shifts")
            return shift_dicts

        except Exception as e:
            self.logger.error(f"Error loading shifts: {str(e)}")
            return []

    def _load_employees(self) -> List[Employee]:
        """Load employees with error handling"""
        try:
            # Load employees ordered by type: TL, VZ, TZ, GFB
            employees = (
                Employee.query.filter_by(is_active=True)
                .order_by(
                    db.case(
                        (Employee.employee_group == EmployeeGroup.TL.value, 1),
                        (Employee.employee_group == EmployeeGroup.VZ.value, 2),
                        (Employee.employee_group == EmployeeGroup.TZ.value, 3),
                        (Employee.employee_group == EmployeeGroup.GFB.value, 4),
                    )
                )
                .all()
            )

            # Update employee cache
            self._employee_cache = {emp.id: emp for emp in employees}

            # Log employee details
            for emp in employees:
                self.logger.debug(
                    f"Loaded employee {emp.id}: {emp.first_name} {emp.last_name}, "
                    f"group={emp.employee_group}, keyholder={emp.is_keyholder}"
                )

            self.logger.info(f"Successfully loaded {len(employees)} employees")
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

    def get_shifts_for_date(self, target_date: date) -> List[Dict[str, Any]]:
        """Get shifts for a specific date"""
        self.logger.info(f"Getting shifts for date {target_date}")

        # Get day of week (0 = Monday, 6 = Sunday)
        day_index = target_date.weekday()

        # Filter shifts for this day
        date_shifts = []
        for shift in self.shifts:
            if shift.get("day_index") == day_index:
                shift_copy = shift.copy()
                shift_copy["date"] = target_date
                date_shifts.append(shift_copy)

        if not date_shifts:
            self.logger.warning(
                f"No shifts found for date {target_date} (day index {day_index})"
            )
        else:
            self.logger.info(f"Found {len(date_shifts)} shifts for date {target_date}")

        return date_shifts

    def get_coverage_for_date(self, target_date: date) -> Optional[Dict[str, Any]]:
        """Get coverage requirements for a specific date"""
        self.logger.info(f"Getting coverage for date {target_date}")

        # Get day of week (0 = Monday, 6 = Sunday)
        day_index = target_date.weekday()

        # Find coverage for this day
        coverage = None
        for cov in self.coverage:
            if cov.get("day_index") == day_index:
                coverage = cov.copy()
                coverage["date"] = target_date
                break

        if not coverage:
            self.logger.warning(
                f"No coverage found for date {target_date} (day index {day_index})"
            )
        else:
            self.logger.info(f"Found coverage for date {target_date}: {coverage}")

        return coverage

    def is_employee_available(
        self, employee: Dict[str, Any], target_date: date, shift: Dict[str, Any]
    ) -> bool:
        """Check if an employee is available for a given date and shift"""
        # Check absences
        for absence in self.absences:
            if absence.get("employee_id") == employee.get("id") and absence.get(
                "start_date"
            ) <= target_date <= absence.get("end_date"):
                return False

        # Check availabilities
        for availability in self.availabilities:
            if (
                availability.get("employee_id") == employee.get("id")
                and availability.get("day_index") == target_date.weekday()
            ):
                # Check if shift time falls within availability window
                shift_start = shift.get("start_time")
                shift_end = shift.get("end_time")
                avail_start = availability.get("start_time")
                avail_end = availability.get("end_time")

                if not (avail_start <= shift_start and shift_end <= avail_end):
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

    def get_shift(self, shift_id: int) -> Optional[Shift]:
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

    def _load_coverage_data(self) -> List[Dict[str, Any]]:
        """Load coverage data for all days, either from database or fallback to demo data."""
        try:
            # Get the availability dates
            start_date = self.start_date
            end_date = self.end_date

            # If using the database model
            if self.use_db:
                covs = Coverage.query.filter(
                    Coverage.date >= start_date, Coverage.date <= end_date
                ).all()
                return [cov.to_dict() for cov in covs]

            if not self.coverage_slots:
                # Try to conditionally import demo_data to avoid circular imports
                try:
                    from api.demo_data import generate_coverage_data

                    self.coverage_slots = generate_coverage_data()
                except ImportError:
                    self.logger.warning(
                        "Could not import demo_data. Using empty coverage data."
                    )
                    # Fallback to empty coverage data
                    self.coverage_slots = []

            return self.coverage_slots
        except Exception as e:
            self.logger.error(f"Error loading coverage data: {e}")
            return []
