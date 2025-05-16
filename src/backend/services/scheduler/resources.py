"""Resource management for the scheduler"""

from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional, Set, Tuple, Union
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
            
            # Define necessary placeholder classes since all imports failed
            class MockSettings:
                """Fallback Settings class for when imports fail"""
                def __init__(self):
                    self.special_days = {}
                    self.special_hours = {}
                    self.id = 0
                
            # Define placeholder for Coverage model
            class MockCoverage:
                """Fallback Coverage class for when imports fail"""
                def __init__(self):
                    self.id = 0
                    self.day_index = 0
                    self.start_time = "09:00"
                    self.end_time = "17:00"
                    self.min_employees = 1
                    self.max_employees = 3
                    self.requires_keyholder = False
                
                @staticmethod
                def query():
                    class MockQuery:
                        @staticmethod
                        def all():
                            return []
                    return MockQuery()
            
            # Define placeholder for Employee model
            class MockEmployee:
                """Fallback Employee class for when imports fail"""
                def __init__(self):
                    self.id = 0
                    self.name = "Mock Employee"
                    self.is_keyholder = False
                    self.is_active = True
                    self.employee_group = None
                
                @staticmethod
                def query():
                    class MockQuery:
                        @staticmethod
                        def filter_by(**kwargs):
                            class MockFilterResult:
                                @staticmethod
                                def all():
                                    return []
                            return MockFilterResult()
                    return MockQuery()
            
            # Define placeholder for ShiftTemplate model
            class MockShiftTemplate:
                """Fallback ShiftTemplate class for when imports fail"""
                def __init__(self):
                    self.id = 0
                    self.name = "Mock Shift"
                    self.start_time = "09:00"
                    self.end_time = "17:00"
                    self.active_days = [0, 1, 2, 3, 4]
                    self.shift_type = "STANDARD"
                
                @staticmethod
                def query():
                    class MockQuery:
                        @staticmethod
                        def all():
                            return []
                    return MockQuery()
            
            # Define placeholder for Absence model
            class MockAbsence:
                """Fallback Absence class for when imports fail"""
                def __init__(self):
                    self.id = 0
                    self.employee_id = 0
                    self.start_date = date.today()
                    self.end_date = date.today()
                
                @staticmethod
                def query():
                    class MockQuery:
                        @staticmethod
                        def all():
                            return []
                    return MockQuery()
            
            # Define placeholder for EmployeeAvailability model
            class MockEmployeeAvailability:
                """Fallback EmployeeAvailability class for when imports fail"""
                def __init__(self):
                    self.id = 0
                    self.employee_id = 0
                    self.day_of_week = 0
                    self.hour = 9
                    self.is_available = True
                    self.availability_type = None
                
                @staticmethod
                def query():
                    class MockQuery:
                        @staticmethod
                        def all():
                            return []
                    return MockQuery()
            
            # Define placeholder for Schedule model
            class MockSchedule:
                """Fallback Schedule class for when imports fail"""
                def __init__(self):
                    self.id = 0
                    self.employee_id = 0
                    self.shift_id = 0
                    self.date = date.today()
                    self.status = "DRAFT"
                    self.version = 1
            
            # Define placeholder for EmployeeGroup and AvailabilityType enums
            class MockEmployeeGroup:
                """Fallback EmployeeGroup enum for when imports fail"""
                VZ = "VZ"  # Full-time
                TZ = "TZ"  # Part-time
                GFB = "GFB"  # Mini-job
                TL = "TL"  # Team leader
            
            class MockAvailabilityType:
                """Fallback AvailabilityType enum for when imports fail"""
                AVAILABLE = "AVAILABLE"
                PREFERRED = "PREFERRED"
                UNAVAILABLE = "UNAVAILABLE"
                FIXED = "FIXED"
            
            # Define placeholders for database access
            class MockDb:
                """Mock database class"""
                class session:
                    @staticmethod
                    def add(obj):
                        pass
                    @staticmethod
                    def commit():
                        pass
            
            # Assign the mocks to global scope
            Settings = MockSettings
            Coverage = MockCoverage
            Employee = MockEmployee
            ShiftTemplate = MockShiftTemplate
            Absence = MockAbsence
            EmployeeAvailability = MockEmployeeAvailability
            Schedule = MockSchedule
            EmployeeGroup = MockEmployeeGroup
            AvailabilityType = MockAvailabilityType
            db = MockDb()

# Configure logger
# logger = logging.getLogger(__name__) # Original logger
logger = logging.getLogger("schedule") # Explicitly use the 'schedule' logger


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
                    coverage = Coverage.query.all() # Re-query after generating
                    if not coverage: # Check again if demo data actually populated
                        self.logger.error("Failed to load any coverage even after attempting to generate demo data.")
                        return [] 
                except Exception as e:
                    self.logger.error(
                        f"Failed to generate demo coverage data: {str(e)}"
                    )
                    return [] # Important: if demo data gen fails, and initial was empty, return empty.
            
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
                day_specific_coverage = [c for c in coverage if getattr(c, 'day_index', -1) == day_idx]
                if day_specific_coverage:
                    self.logger.info(f"  {day_name} ({day_idx}): {len(day_specific_coverage)} coverage blocks")
                    # for c_idx, c_item in enumerate(day_specific_coverage):
                    #    self.logger.debug(f"    {c_idx}: Start: {c_item.start_time}, End: {c_item.end_time}, MinEmp: {c_item.min_employees}, KeyH: {c_item.requires_keyholder}")
                else:
                    self.logger.info(f"  {day_name} ({day_idx}): No coverage blocks")

            self.logger.info(f"Successfully loaded {len(coverage)} coverage records")
            return coverage

        except Exception as e:
            self.logger.error(f"Error loading coverage: {str(e)}", exc_info=True) # Added exc_info
            return []

    def _load_shifts(self) -> List[ShiftTemplate]:
        """Load shifts with error handling"""
        try:
            shifts = ShiftTemplate.query.all()
            if not shifts:
                self.logger.error("No shift templates found in database")
                return []

            self.logger.info(f"Successfully loaded {len(shifts)} shift templates. Verifying times...")
            for shift in shifts:
                start_time_val = getattr(shift, 'start_time', 'MISSING_ATTRIBUTE')
                end_time_val = getattr(shift, 'end_time', 'MISSING_ATTRIBUTE')
                active_days_val = getattr(shift, 'active_days', 'MISSING_ATTRIBUTE')
                shift_name = getattr(shift, 'name', 'N/A')
                
                self.logger.info(
                    f"Loaded ShiftTemplate: id={shift.id}, name='{shift_name}', "
                    f"raw_start_time='{start_time_val}' (type: {type(start_time_val)}), "
                    f"raw_end_time='{end_time_val}' (type: {type(end_time_val)}), "
                    f"active_days={active_days_val}"
                )
                
                # Basic validation check for format (doesn't guarantee parseability by int)
                is_start_time_valid_format = isinstance(start_time_val, str) and len(start_time_val) == 5 and ':' in start_time_val
                is_end_time_valid_format = isinstance(end_time_val, str) and len(end_time_val) == 5 and ':' in end_time_val
                
                if not is_start_time_valid_format and start_time_val != 'MISSING_ATTRIBUTE':
                    self.logger.warning(f"ShiftTemplate id={shift.id} name='{shift_name}' has an invalid start_time format or type: '{start_time_val}'")
                if not is_end_time_valid_format and end_time_val != 'MISSING_ATTRIBUTE':
                    self.logger.warning(f"ShiftTemplate id={shift.id} name='{shift_name}' has an invalid end_time format or type: '{end_time_val}'")

            return shifts
        except Exception as e:
            self.logger.error(f"Error loading shifts: {str(e)}", exc_info=True)
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
        # First, check if this is a special day when the store is closed
        if self.settings:
            # Convert date to string
            date_str = day.strftime('%Y-%m-%d')
            
            # Check special_days first
            if hasattr(self.settings, 'special_days') and self.settings.special_days:
                if date_str in self.settings.special_days and self.settings.special_days[date_str].get('is_closed', False):
                    logger.info(f"Date {date_str} is a closed special day. No employee is available.")
                    return False
            
            # As fallback, check legacy special_hours
            elif hasattr(self.settings, 'special_hours') and self.settings.special_hours:
                if date_str in self.settings.special_hours and self.settings.special_hours[date_str].get('is_closed', False):
                    logger.info(f"Date {date_str} is closed via special_hours. No employee is available.")
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
                            f"type={avail_type.value if avail_type is not None else 'None'}"
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
