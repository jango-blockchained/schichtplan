"""Serialization utilities for the scheduler."""

from datetime import date, datetime
from typing import Dict, List, Any, Optional
import sys
import os

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

# Try to handle imports in different environments
try:
    from models import Employee, ShiftTemplate, Schedule
    from models.employee import AvailabilityType
    from utils.logger import logger
except ImportError:
    try:
        from backend.models import Employee, ShiftTemplate, Schedule
        from backend.models.employee import AvailabilityType
        from backend.utils.logger import logger
    except ImportError:
        try:
            from src.backend.models import Employee, ShiftTemplate, Schedule
            from src.backend.models.employee import AvailabilityType
            from src.backend.utils.logger import logger
        except ImportError:
            # Create type hint classes for standalone testing
            class AvailabilityType:
                """Enum placeholder for availability types"""

                AVAILABLE = "AVL"
                FIXED = "FIX"
                PREFERRED = "PRF"
                UNAVAILABLE = "UNV"

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
                required_skills: List[str] = []

            class Schedule:
                """Type hint class for Schedule"""

                class Entry:
                    id: int
                    employee_id: int
                    shift_id: int
                    date: date
                    shift: ShiftTemplate = None
                    status: str = "PENDING"
                    version: int = 1
                    availability_type: str = AvailabilityType.AVAILABLE

                id: int
                start_date: date
                end_date: date
                entries: List[Entry] = []
                status: str = "DRAFT"
                version: int = 1


class ScheduleSerializer:
    """Class for serializing schedule data between different formats"""

    def __init__(self, logger):
        self.logger = logger

    def serialize_schedule(self, schedule) -> Dict[str, Any]:
        """Convert a schedule object to a dictionary"""
        try:
            # Convert to dictionary
            return self.convert_schedule_to_dict(schedule)
        except Exception as e:
            self.log_error(f"Error serializing schedule: {str(e)}")
            raise

    def serialize_to_json(self, schedule) -> str:
        """Convert a schedule object to a JSON string"""
        try:
            # First convert to dictionary
            schedule_dict = self.serialize_schedule(schedule)

            # Convert to JSON string
            import json

            return json.dumps(schedule_dict)
        except Exception as e:
            self.log_error(f"Error serializing schedule to JSON: {str(e)}")
            raise

    def convert_schedule_to_dict(self, schedule) -> Dict[str, Any]:
        """Convert a schedule object to a dictionary for API responses"""
        if not schedule:
            return {}

        # Convert schedule to JSON-serializable format
        result = {
            "schedule_id": getattr(schedule, "id", None),
            "version": getattr(schedule, "version", 1),
            "status": getattr(schedule, "status", "DRAFT"),
            "entries": [],
        }

        # Add entries if they exist
        if hasattr(schedule, "entries") and schedule.entries:
            for entry in schedule.entries:
                entry_dict = self.convert_entry_to_dict(entry)
                if entry_dict:
                    result["entries"].append(entry_dict)

        return result

    def convert_entry_to_dict(self, entry) -> Dict[str, Any]:
        """Convert a schedule entry to a dictionary"""
        if not entry:
            return {}

        try:
            # Get basic entry properties
            entry_dict = {
                "id": getattr(entry, "id", None),
                "employee_id": getattr(entry, "employee_id", None),
                "date": self.format_date(getattr(entry, "date", None)),
                "version": getattr(entry, "version", 1),
                "status": getattr(entry, "status", "PENDING"),
            }

            # Add shift information if available
            if hasattr(entry, "shift_id") and entry.shift_id:
                entry_dict["shift_id"] = entry.shift_id

            if hasattr(entry, "shift") and entry.shift:
                entry_dict["shift"] = self.convert_shift_to_dict(entry.shift)

            if hasattr(entry, "availability_type") and entry.availability_type:
                entry_dict["availability_type"] = entry.availability_type

            return entry_dict

        except Exception as e:
            self.log_error(f"Error converting entry to dict: {str(e)}")
            return {}

    def convert_shift_to_dict(self, shift) -> Dict[str, Any]:
        """Convert a shift template to a dictionary"""
        if not shift:
            return {}

        shift_dict = {
            "id": getattr(shift, "id", None),
            "name": getattr(shift, "name", ""),
            "start_time": getattr(shift, "start_time", ""),
            "end_time": getattr(shift, "end_time", ""),
            "shift_type": getattr(shift, "shift_type", ""),
        }

        if hasattr(shift, "required_skills") and shift.required_skills:
            shift_dict["required_skills"] = shift.required_skills

        if hasattr(shift, "duration_hours") and shift.duration_hours is not None:
            shift_dict["duration_hours"] = shift.duration_hours

        return shift_dict

    def create_schedule_entries(
        self, employees_assigned, schedule_id=None, status="DRAFT", version=None
    ) -> List[Any]:
        """
        Create schedule entries from assigned employees
        """
        entries = []

        for assignment in employees_assigned:
            # Get employee ID and other data
            if isinstance(assignment, dict):
                employee_id = assignment.get("employee_id")
                shift_id = assignment.get("shift_id")
                assignment_date = assignment.get("date")
                shift_template = assignment.get("shift_template")
                availability_type = assignment.get(
                    "availability_type", AvailabilityType.AVAILABLE.value
                )
                assignment_status = assignment.get("status", status)
                assignment_version = assignment.get("version", version or 1)
            else:
                employee_id = assignment.id
                shift_id = None  # Will be determined based on best match
                assignment_date = None  # Will be determined from context
                shift_template = None
                availability_type = AvailabilityType.AVAILABLE.value
                assignment_status = status
                assignment_version = version or 1

            try:
                # For cases where we need to find the best matching shift
                best_shift = None
                best_availability = "AVAILABLE"

                # Find all shifts for this employee's date
                if not assignment_date:
                    self.log_warning(f"Missing date for employee {employee_id}")
                    continue

                # Logic for determining the best shift and availability goes here
                # This would typically use availability checker and match calculation

                if best_shift:
                    # Create entry with the best matching shift
                    entry = Schedule.Entry(
                        employee_id=employee_id,
                        shift_id=best_shift.id,
                        date=assignment_date,
                        status="PENDING",
                        version=assignment_version,
                        availability_type=best_availability,
                    )
                    entries.append(entry)

            except Exception as e:
                self.log_error(f"Error creating schedule entry: {str(e)}")

        return entries

    def format_date(self, date_value) -> Optional[str]:
        """Format a date value to ISO format string"""
        if not date_value:
            return None

        if isinstance(date_value, date):
            return date_value.isoformat()
        elif isinstance(date_value, datetime):
            return date_value.date().isoformat()
        elif isinstance(date_value, str):
            # If already a string, ensure it's in ISO format
            try:
                parsed_date = datetime.fromisoformat(date_value).date()
                return parsed_date.isoformat()
            except ValueError:
                self.log_warning(f"Invalid date format: {date_value}")
                return date_value
        else:
            self.log_warning(f"Unhandled date type: {type(date_value)}")
            return None

    # Logging methods
    def log_debug(self, message):
        if hasattr(self.logger, "debug"):
            self.logger.debug(message)

    def log_warning(self, message):
        if hasattr(self.logger, "warning"):
            self.logger.warning(message)

    def log_error(self, message):
        if hasattr(self.logger, "error"):
            self.logger.error(message)
