"""Availability checking module for the scheduler."""

import logging
import os
import sys
from datetime import date
from typing import Any, Dict, List, Tuple

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Use centralized import utilities
from .import_utils import ModelImportError, import_availability_type, safe_import_models

# Import models using the centralized utility
try:
    (
        Employee,
        ShiftTemplate,
        Settings,
        Coverage,
        db,
        Absence,
        EmployeeAvailability,
        Schedule,
        AvailabilityType,
        EmployeeGroup,
    ) = safe_import_models(use_mocks_on_failure=True)
    import_logger = logging.getLogger(__name__)
    import_logger.info("Successfully imported models for availability module")
except ModelImportError as e:
    import_logger = logging.getLogger(__name__)
    import_logger.critical(f"Failed to import models: {e}")
    # Try to import just AvailabilityType as fallback
    try:
        AvailabilityType = import_availability_type()
    except ModelImportError:
        # Create a placeholder enum for standalone testing
        from enum import Enum

        class AvailabilityType(str, Enum):
            """Mock enum for availability types"""

            AVAILABLE = "AVAILABLE"
            FIXED = "FIXED"
            PREFERRED = "PREFERRED"
            UNAVAILABLE = "UNAVAILABLE"

    raise


class AvailabilityChecker:
    """
    Handles checking if employees are available for a given shift
    """

    def __init__(self, resources, logger=None):
        """Initialize the availability checker with resources"""
        self.resources = resources
        self.logger = logger or logging.getLogger(__name__)

    def log_debug(self, message):
        """Utility method for debug logging"""
        if self.logger:
            self.logger.debug(message)

    def log_info(self, message):
        """Utility method for info logging"""
        if self.logger:
            self.logger.info(message)

    def log_warning(self, message):
        """Utility method for warning logging"""
        if self.logger:
            self.logger.warning(message)

    def is_employee_available(self, employee_id, date_to_check, shift):
        """
        Check if an employee is available for a specific shift on a specific date
        Returns a tuple of (available, availability_type)
        """
        self.log_debug(
            f"Checking availability for employee {employee_id} on {date_to_check} for shift {shift.id}"
        )

        # First, check if this is a special day when the store is closed
        if hasattr(self.resources, "settings") and self.resources.settings:
            # Convert date to string if needed
            date_str = date_to_check
            if hasattr(date_to_check, "strftime"):
                date_str = date_to_check.strftime("%Y-%m-%d")

            # Check special_days first
            if (
                hasattr(self.resources.settings, "special_days")
                and self.resources.settings.special_days
            ):
                if (
                    date_str in self.resources.settings.special_days
                    and self.resources.settings.special_days[date_str].get(
                        "is_closed", False
                    )
                ):
                    self.log_debug(
                        f"Date {date_str} is a closed special day. No employee is available."
                    )
                    return False, AvailabilityType.UNAVAILABLE.value

            # As fallback, check legacy special_hours
            elif (
                hasattr(self.resources.settings, "special_hours")
                and self.resources.settings.special_hours
            ):
                if (
                    date_str in self.resources.settings.special_hours
                    and self.resources.settings.special_hours[date_str].get(
                        "is_closed", False
                    )
                ):
                    self.log_debug(
                        f"Date {date_str} is closed via special_hours. No employee is available."
                    )
                    return False, AvailabilityType.UNAVAILABLE.value

        # Check if employee is on leave
        if self.is_employee_on_leave(employee_id, date_to_check):
            self.log_debug(f"Employee {employee_id} is on leave on {date_to_check}")
            return False, AvailabilityType.UNAVAILABLE.value

        # Get availability records for this date
        availability_records = self.get_availability_records(employee_id, date_to_check)

        if not availability_records:
            self.log_debug(
                f"No availability records for employee {employee_id} on {date_to_check}"
            )
            # Default to available if no records
            return True, AvailabilityType.AVAILABLE.value

        # Validate shift times
        if not shift.start_time or not shift.end_time:
            self.log_warning(f"Shift {shift.id} has invalid times")
            return False, AvailabilityType.UNAVAILABLE.value

        try:
            # Get hours covered by this shift
            shift_hours = self.get_shift_hours(shift.start_time, shift.end_time)
            self.log_debug(f"Checking availability for hours: {shift_hours}")

            # Check every hour to determine overall availability
            availability_types = set()

            for hour in shift_hours:
                is_available, avail_type = self.is_hour_available(
                    availability_records, hour
                )

                if not is_available:
                    self.log_debug(
                        f"Employee {employee_id} is unavailable at hour {hour} on {date_to_check}"
                    )
                    return False, AvailabilityType.UNAVAILABLE.value

                availability_types.add(avail_type)

            # Priority: UNAVAILABLE (already handled by returning early) > FIXED > PREFERRED > AVAILABLE
            if AvailabilityType.FIXED.value in availability_types:
                self.log_debug(
                    f"Employee {employee_id} has FIXED availability for shift on {date_to_check}"
                )
                return True, AvailabilityType.FIXED.value
            elif AvailabilityType.PREFERRED.value in availability_types:
                self.log_debug(
                    f"Employee {employee_id} has PREFERRED availability for shift on {date_to_check}"
                )
                return True, AvailabilityType.PREFERRED.value
            else:  # Assumes only AVAILABLE is left if no FIXED or PREFERRED
                self.log_debug(
                    f"Employee {employee_id} is available for shift on {date_to_check}"
                )
                return True, AvailabilityType.AVAILABLE.value

        except Exception as e:
            self.log_warning(f"Error checking availability: {str(e)}")
            # Default to unavailable on error
            return False, AvailabilityType.UNAVAILABLE.value

    def is_hour_available(
        self, availability_records: List[Dict], hour: int
    ) -> Tuple[bool, str]:
        """
        Check if a specific hour is available in the availability records
        Returns a tuple of (available, availability_type)
        """
        # Default to available if no records
        if not availability_records:
            return True, AvailabilityType.AVAILABLE.value

        for record in availability_records:
            start_hour = record.get("start_hour")
            end_hour = record.get("end_hour")

            if start_hour is None or end_hour is None:
                continue

            avail_type = record.get(
                "availability_type", AvailabilityType.AVAILABLE.value
            )

            if start_hour <= hour < end_hour:
                if avail_type == AvailabilityType.UNAVAILABLE.value:
                    return False, AvailabilityType.UNAVAILABLE.value
                elif avail_type == AvailabilityType.FIXED.value:
                    return True, AvailabilityType.FIXED.value
                elif avail_type == AvailabilityType.PREFERRED.value:
                    return True, AvailabilityType.PREFERRED.value
                else:
                    return True, AvailabilityType.AVAILABLE.value

        # If no specific record found for this hour, default to available
        return True, AvailabilityType.AVAILABLE.value

    def get_shift_hours(self, start_time: str, end_time: str) -> List[int]:
        """Get a list of hours covered by this shift"""
        try:
            # Parse the times
            start_parts = start_time.split(":")
            end_parts = end_time.split(":")

            start_hour = int(start_parts[0])
            end_hour = int(end_parts[0])

            # Handle shifts that span midnight
            if end_hour < start_hour:
                end_hour += 24

            # Generate list of hours
            hours = list(range(start_hour, end_hour))

            # Handle hours > 23 (next day)
            hours = [h % 24 for h in hours]

            return hours

        except Exception as e:
            self.log_error(f"Error parsing shift hours: {str(e)}")
            return list(range(0, 24))  # Default to all hours if parsing fails

    def is_valid_time_range(self, start_time: str, end_time: str) -> bool:
        """Check if the time range is valid"""
        try:
            # Parse time strings
            start_parts = start_time.split(":")
            end_parts = end_time.split(":")

            if len(start_parts) < 1 or len(end_parts) < 1:
                return False

            # Basic validation
            start_hour = int(start_parts[0])
            end_hour = int(end_parts[0])

            if not (0 <= start_hour < 24) or not (0 <= end_hour < 24):
                if not (start_hour == end_hour == 24):  # Allow 24:00 for midnight
                    return False

            return True

        except Exception:
            return False

    def is_employee_on_leave(self, employee_id: int, date_to_check: date) -> bool:
        """Check if employee is on leave for the given date"""
        # Check absences from resources
        if self.resources.is_employee_on_leave(employee_id, date_to_check):
            self.log_debug(
                f"Employee {employee_id} is on leave/absence for {date_to_check}"
            )
            return True

        return False

    def get_employee_availability(
        self, employee_id: int, date_to_check: date
    ) -> List[Dict[str, Any]]:
        """Get availability records for an employee on a specific date"""
        availability_records = []

        # Find availability records for this employee and date
        for avail in self.resources.availabilities:
            if avail.employee_id == employee_id:
                # Check if this availability applies to this date
                if self.is_availability_for_date(avail, date_to_check):
                    # Add this availability record
                    availability_records.append(
                        {
                            "availability_type": avail.availability_type,
                            "start_hour": avail.start_hour,
                            "end_hour": avail.end_hour,
                        }
                    )

        return availability_records

    def is_availability_for_date(self, availability, date_to_check: date) -> bool:
        """Check if an availability record applies to a specific date"""
        # Use the same logic as EmployeeAvailability.is_available_for_date
        # If not recurring, check start_date and end_date
        if hasattr(availability, "is_recurring") and not availability.is_recurring:
            if not (
                hasattr(availability, "start_date")
                and hasattr(availability, "end_date")
            ):
                return False
            if not (availability.start_date and availability.end_date):
                return False
            if not (availability.start_date <= date_to_check <= availability.end_date):
                return False

        # Check if this availability applies to the given day of week
        if hasattr(availability, "day_of_week"):
            if availability.day_of_week != date_to_check.weekday():
                return False
        else:
            return False

        # If all checks pass, the availability applies to this date
        return True

    def check_availability(self, employee_id: int, date: date) -> bool:
        """Check if an employee is available on a given date"""
        # Check absences from resources
        if self.resources.is_employee_on_leave(employee_id, date):
            self.logger.debug(f"Employee {employee_id} is on leave/absence for {date}")
            return False

        # Get employee's availability for this day
        day_of_week = date.weekday()
        availabilities = self.resources.get_employee_availability(
            employee_id, day_of_week
        )

        # If no availabilities are set, employee is unavailable
        if not availabilities:
            self.logger.debug(
                f"No availability records found for employee {employee_id} on {date}"
            )
            return False

        # Check if employee is available for any shift on this date
        for shift in self.resources.shifts:
            start_hour = int(shift.start_time.split(":")[0])
            end_hour = int(shift.end_time.split(":")[0])

            if self.resources.is_employee_available(
                employee_id, date, start_hour, end_hour
            ):
                return True

        return False

    def get_availability_records(
        self, employee_id: int, date_to_check: date
    ) -> List[Dict]:
        """Get availability records for an employee on a specific date"""
        # Get employee's availability for this day
        day_of_week = date_to_check.weekday()
        availabilities = self.resources.get_employee_availability(
            employee_id, day_of_week
        )

        # Convert availabilities to dictionary format
        records = []
        for avail in availabilities:
            if hasattr(avail, "hour"):
                records.append(
                    {
                        "start_hour": avail.hour,
                        "end_hour": avail.hour + 1,
                        "availability_type": getattr(
                            avail, "availability_type", AvailabilityType.AVAILABLE.value
                        ),
                    }
                )

        self.log_debug(
            f"Found {len(records)} availability records for employee {employee_id} on {date_to_check}"
        )
        return records

    def is_employee_available_for_date(self, employee_id: int, date_to_check: date) -> bool:
        """
        Check if an employee is available for assignments on a specific date.
        
        This checks for:
        1. Employee absences on the date
        2. Employee availability records for the day of week
        
        Args:
            employee_id: The employee ID to check
            date_to_check: The date to check availability for
            
        Returns:
            bool: True if employee is available for assignments, False otherwise
        """
        self.log_debug(
            f"Checking general availability for employee {employee_id} on {date_to_check}"
        )

        # Check if employee is on leave/absence
        if self.is_employee_on_leave(employee_id, date_to_check):
            self.log_debug(f"Employee {employee_id} is on leave on {date_to_check}")
            return False

        # Get availability records for this date
        day_of_week = date_to_check.weekday()
        
        # Query availability records for this employee and day of week
        try:
            if hasattr(self.resources, 'availabilities'):
                # Use resources if available
                availability_records = [
                    avail for avail in self.resources.availabilities
                    if avail.employee_id == employee_id and 
                    self.is_availability_for_date(avail, date_to_check)
                ]
            else:
                # Fallback to direct database query
                availability_records = EmployeeAvailability.query.filter(
                    EmployeeAvailability.employee_id == employee_id,
                    EmployeeAvailability.day_of_week == day_of_week
                ).all()
            
            # Check if there are any UNAVAILABLE records for this day
            for record in availability_records:
                if (hasattr(record, 'availability_type') and 
                    record.availability_type == AvailabilityType.UNAVAILABLE.value):
                    self.log_debug(
                        f"Employee {employee_id} has UNAVAILABLE availability on {date_to_check}"
                    )
                    return False
                elif (hasattr(record, 'is_available') and 
                      record.is_available is False):
                    self.log_debug(
                        f"Employee {employee_id} is marked as unavailable on {date_to_check}"
                    )
                    return False
            
            # If no explicit unavailability found, employee is available
            self.log_debug(
                f"Employee {employee_id} is available for assignments on {date_to_check}"
            )
            return True
            
        except Exception as e:
            self.log_error(
                f"Error checking employee availability for date: {str(e)}"
            )
            # Default to unavailable on error for safety
            return False

    # Logging methods
    def log_error(self, message):
        """Utility method for error logging"""
        if self.logger:
            self.logger.error(message)

    def get_available_employees(
        self, check_date: date, employees: List[Any]
    ) -> List[Any]:
        """
        Get a list of employees who are available on the given date.

        Args:
            check_date: The date to check availability for
            employees: List of employee objects to filter

        Returns:
            List of employees who are available on the given date
        """
        available_employees = []

        if not employees:
            self.log_warning(
                f"No employees provided to check availability for {check_date}"
            )
            return available_employees

        self.log_debug(
            f"Checking availability for {len(employees)} employees on {check_date}"
        )

        for employee in employees:
            try:
                # Get employee ID
                employee_id = getattr(employee, "id", None) or getattr(
                    employee, "employee_id", None
                )
                if employee_id is None:
                    self.log_warning(f"Employee has no ID: {employee}")
                    continue

                # Check if employee is active
                is_active = getattr(employee, "is_active", True)
                if not is_active:
                    self.log_debug(f"Employee {employee_id} is not active")
                    continue

                # Check if employee is on leave
                if self.is_employee_on_leave(employee_id, check_date):
                    self.log_debug(
                        f"Employee {employee_id} is on leave on {check_date}"
                    )
                    continue

                # Check basic availability (not shift-specific)
                if self.check_availability(employee_id, check_date):
                    available_employees.append(employee)
                    self.log_debug(
                        f"Employee {employee_id} is available on {check_date}"
                    )
                else:
                    self.log_debug(
                        f"Employee {employee_id} is not available on {check_date}"
                    )

            except Exception as e:
                self.log_warning(
                    f"Error checking availability for employee {employee}: {e}"
                )
                continue

        self.log_info(
            f"Found {len(available_employees)} available employees out of {len(employees)} on {check_date}"
        )
        return available_employees
