"""Availability checking module for the scheduler."""

from datetime import date, datetime
from typing import Dict, Any, List, Tuple
import logging
import sys
import os

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Try to handle imports in different environments
try:
    from models.employee import AvailabilityType
except ImportError:
    try:
        from backend.models.employee import AvailabilityType
    except ImportError:
        try:
            from src.backend.models.employee import AvailabilityType
        except ImportError:
            # Create a placeholder enum for standalone testing
            from enum import Enum

            class AvailabilityType(str, Enum):
                """Mock enum for availability types"""

                AVAILABLE = "AVL"
                FIXED = "FIX"
                PREFERRED = "PRF"
                UNAVAILABLE = "UNV"


# Try to handle imports in different environments
try:
    from models import Employee, ShiftTemplate, Schedule
except ImportError:
    try:
        from backend.models import Employee, ShiftTemplate, Schedule
    except ImportError:
        try:
            from src.backend.models import Employee, ShiftTemplate, Schedule
        except ImportError:
            # Create type hint classes for standalone testing
            class Employee:
                """Type hint class for Employee"""

                id: int

            class ShiftTemplate:
                """Type hint class for ShiftTemplate"""

                id: int
                name: str
                start_time: str
                end_time: str
                shift_type: str
                duration_hours: float


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

            # If we have both AVAILABLE and PREFERRED hours, prioritize PREFERRED
            if AvailabilityType.PREFERRED.value in availability_types:
                self.log_debug(
                    f"Employee {employee_id} has PREFERRED availability for shift on {date_to_check}"
                )
                return True, AvailabilityType.PREFERRED.value
            else:
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
        # If availability has specific date, check exact match
        if hasattr(availability, "date") and availability.date:
            avail_date = availability.date
            if isinstance(avail_date, str):
                try:
                    avail_date = datetime.fromisoformat(avail_date).date()
                except (ValueError, TypeError):
                    self.log_warning(
                        f"Invalid date format in availability record: {avail_date}"
                    )
                    return False

            return avail_date == date_to_check

        # If availability has day_of_week, check if it matches
        elif (
            hasattr(availability, "day_of_week")
            and availability.day_of_week is not None
        ):
            # day_of_week: 0 = Monday, 6 = Sunday
            return availability.day_of_week == date_to_check.weekday()

        # Default - availability doesn't apply to this date
        return False

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

    # Logging methods
    def log_error(self, message):
        if hasattr(self.logger, "error"):
            self.logger.error(message)
