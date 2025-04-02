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
        try:
            # Log the attempt
            self.log_info(
                f"[DIAGNOSTIC] Check availability: Emp {employee_id} on {date_to_check} "
                f"for Shift {getattr(shift, 'id', 'unknown')}"
            )

            start_time = None
            end_time = None
            if hasattr(shift, 'start_time'):
                start_time = shift.start_time
            elif isinstance(shift, dict) and 'start_time' in shift:
                start_time = shift['start_time']
            
            if hasattr(shift, 'end_time'):
                end_time = shift.end_time
            elif isinstance(shift, dict) and 'end_time' in shift:
                end_time = shift['end_time']
                
            if not start_time or not end_time:
                self.log_warning(
                    f"[DIAGNOSTIC] Shift {getattr(shift, 'id', 'unknown')} has "
                    f"invalid times: start={start_time}, end={end_time}"
                )
                # Default to available even with invalid shift times (emergency fallback)
                return True, AvailabilityType.AVAILABLE.value

            # Check if employee is on leave - only hard constraint we won't override
            if self.is_employee_on_leave(employee_id, date_to_check):
                self.log_info(
                    f"[DIAGNOSTIC] Emp {employee_id} on leave/absence "
                    f"on {date_to_check}"
                )
                return False, AvailabilityType.UNAVAILABLE.value

            # Get availability records for this date
            availability_records = self.get_availability_records(
                employee_id, date_to_check
            )

            # Log what records we found
            if availability_records:
                self.log_debug(
                    f"[DIAGNOSTIC] Found {len(availability_records)} avail records "
                    f"for Emp {employee_id} on {date_to_check}"
                )
                for idx, record in enumerate(availability_records):
                    start_hour = record.get("start_hour", "?")
                    end_hour = record.get("end_hour", "?")
                    avail_type = record.get("availability_type", "?")
                    self.log_debug(
                        f"[DIAGNOSTIC]   Record {idx+1}: {start_hour}-{end_hour}, "
                        f"type={avail_type}"
                    )
            else:
                self.log_info(
                    f"[DIAGNOSTIC] No avail records for Emp {employee_id} "
                    f"on {date_to_check}, default AVAILABLE (fallback)"
                )
                # Default to available if no records
                return True, AvailabilityType.AVAILABLE.value

            # Get hours covered by this shift
            shift_hours = self.get_shift_hours(start_time, end_time)
            self.log_debug(
                f"[DIAGNOSTIC] Checking availability for hours: {shift_hours}"
            )

            # Check every hour to determine overall availability
            availability_types = set()
            unavailable_hours = []

            for hour in shift_hours:
                is_available, avail_type = self.is_hour_available(
                    availability_records, hour
                )

                if not is_available:
                    self.log_debug(
                        f"[DIAGNOSTIC] Emp {employee_id} unavailable at hour {hour} "
                        f"on {date_to_check}"
                    )
                    unavailable_hours.append(hour)
                else:
                    self.log_debug(
                        f"[DIAGNOSTIC] Emp {employee_id} available at hour {hour} "
                        f"on {date_to_check} with type {avail_type}"
                    )
                availability_types.add(avail_type)

            # RELAXED CHECK: Only mark employee as unavailable if ALL hours are unavailable
            if unavailable_hours and len(unavailable_hours) == len(shift_hours):
                self.log_info(
                    f"[DIAGNOSTIC] Emp {employee_id} UNAVAILABLE for shift on "
                    f"{date_to_check}. All hours unavailable: {unavailable_hours}"
                )
                return False, AvailabilityType.UNAVAILABLE.value
            elif unavailable_hours:
                self.log_info(
                    f"[DIAGNOSTIC] Emp {employee_id} has some unavailable hours "
                    f"({len(unavailable_hours)}/{len(shift_hours)}), but considered "
                    f"AVAILABLE for shift on {date_to_check} (fallback)"
                )
                return True, AvailabilityType.AVAILABLE.value

            # If we have both AVAILABLE and PREFERRED hours, prioritize PREFERRED
            if AvailabilityType.PREFERRED.value in availability_types:
                self.log_info(
                    f"[DIAGNOSTIC] Emp {employee_id} has PREFERRED availability "
                    f"for shift on {date_to_check}"
                )
                return True, AvailabilityType.PREFERRED.value
            else:
                self.log_info(
                    f"[DIAGNOSTIC] Emp {employee_id} is AVAILABLE for shift "
                    f"on {date_to_check}"
                )
                return True, AvailabilityType.AVAILABLE.value

        except Exception as e:
            self.log_warning(
                f"[DIAGNOSTIC] Error checking availability for emp {employee_id}: {e}"
            )
            import traceback
            self.log_warning(f"[DIAGNOSTIC] Traceback: {traceback.format_exc()}")
            # Default to AVAILABLE on error as fallback
            self.log_info(
                f"[DIAGNOSTIC] Defaulting Emp {employee_id} to AVAILABLE "
                f"due to error (fallback)"
            )
            return True, AvailabilityType.AVAILABLE.value

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

    def get_availability_records(
        self, employee_id: int, date_to_check: date
    ) -> List[Dict]:
        """Get availability records for the employee on the specific date"""
        self.log_debug(f"[DIAGNOSTIC] Getting availability records for employee {employee_id} on {date_to_check}")
        
        # Check if resources has availabilities
        if not hasattr(self.resources, 'availabilities') or not self.resources.availabilities:
            self.log_warning(f"[DIAGNOSTIC] No availability data in resources for employee {employee_id}")
            return []
            
        self.log_debug(f"[DIAGNOSTIC] Found {len(self.resources.availabilities)} total availability records in resources")
        
        # Match records by employee ID and date
        matching_records = []
        employee_records = 0
        day_matched = 0
        date_matched = 0
        
        for avail in self.resources.availabilities:
            try:
                if not hasattr(avail, 'employee_id'):
                    continue
                    
                if avail.employee_id == employee_id:
                    employee_records += 1
                    day_of_week = date_to_check.weekday()  # 0 = Monday, 6 = Sunday
                    
                    # Check if this availability applies to this date
                    day_matches = False
                    date_in_range = False
                    
                    # Check day of week match
                    if hasattr(avail, 'day_of_week') and avail.day_of_week == day_of_week:
                        day_matches = True
                        day_matched += 1
                    
                    # Check date range match (if applicable)
                    if hasattr(avail, 'start_date') and hasattr(avail, 'end_date'):
                        if (avail.start_date is None or avail.start_date <= date_to_check) and \
                           (avail.end_date is None or date_to_check <= avail.end_date):
                            date_in_range = True
                            date_matched += 1
                    
                    # Legacy compatibility - delegate to is_availability_for_date if available
                    if hasattr(avail, 'is_available_for_date'):
                        try:
                            is_available = avail.is_available_for_date(date_to_check)
                            if is_available:
                                self.log_debug(f"[DIAGNOSTIC] Found matching record using is_available_for_date: {avail}")
                                matching_records.append(self._create_availability_dict(avail))
                                continue
                        except Exception as e:
                            self.log_warning(f"[DIAGNOSTIC] Error calling is_available_for_date: {str(e)}")
                    
                    # Add record if it's for this day of week or within date range
                    if day_matches or date_in_range:
                        self.log_debug(f"[DIAGNOSTIC] Found matching record: day_match={day_matches}, date_match={date_in_range}")
                        matching_records.append(self._create_availability_dict(avail))
            except Exception as e:
                self.log_warning(f"[DIAGNOSTIC] Error processing availability record: {str(e)}")
                
        # Log results
        self.log_info(
            f"[DIAGNOSTIC] Availability search results for employee {employee_id} on {date_to_check} (day {date_to_check.weekday()}):\n"
            f"  - Total employee records: {employee_records}\n"
            f"  - Day of week matches: {day_matched}\n"
            f"  - Date range matches: {date_matched}\n"
            f"  - Total matching records: {len(matching_records)}"
        )
        
        return matching_records
        
    def _create_availability_dict(self, avail) -> Dict:
        """Convert availability model to dictionary"""
        availability_dict = {}
        
        try:
            # Handle hour or time range
            if hasattr(avail, 'hour'):
                availability_dict["start_hour"] = avail.hour
                availability_dict["end_hour"] = avail.hour + 1
            elif hasattr(avail, 'start_hour') and hasattr(avail, 'end_hour'):
                availability_dict["start_hour"] = avail.start_hour
                availability_dict["end_hour"] = avail.end_hour
            
            # Handle availability type
            if hasattr(avail, 'availability_type'):
                if isinstance(avail.availability_type, str):
                    availability_dict["availability_type"] = avail.availability_type
                else:
                    availability_dict["availability_type"] = avail.availability_type.value
            else:
                availability_dict["availability_type"] = AvailabilityType.AVAILABLE.value
                
            # Handle is_available flag
            if hasattr(avail, 'is_available'):
                availability_dict["is_available"] = avail.is_available
            else:
                availability_dict["is_available"] = True
                
        except Exception as e:
            self.log_warning(f"[DIAGNOSTIC] Error creating availability dict: {str(e)}")
            
        return availability_dict

    # Logging methods
    def log_error(self, message):
        if hasattr(self.logger, "error"):
            self.logger.error(message)
