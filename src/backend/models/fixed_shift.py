from . import db
from datetime import datetime
from .settings import Settings
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# Keep the enum for backward compatibility but prefer settings-based shift types
class ShiftType(Enum):
    EARLY = "EARLY"
    MIDDLE = "MIDDLE"
    LATE = "LATE"

    def __str__(self):
        return self.value

    @classmethod
    def from_time(cls, time_str: str) -> "ShiftType":
        if not time_str:
            return cls.EARLY

        hour = int(time_str.split(":")[0])
        if hour < 10:
            return cls.EARLY
        if hour < 14:
            return cls.MIDDLE
        return cls.LATE


class ShiftValidationError(Exception):
    """Custom validation error for shifts"""

    pass


class ShiftTemplate(db.Model):
    __tablename__ = "shifts"

    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    end_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    duration_hours = db.Column(db.Float, nullable=False)
    requires_break = db.Column(db.Boolean, nullable=False, default=True)
    shift_type = db.Column(db.Enum(ShiftType), nullable=False)
    shift_type_id = db.Column(
        db.String(50), nullable=True
    )  # Store the ID from settings.shift_types
    active_days = db.Column(
        db.JSON,
        nullable=False,
        default=lambda: {
            "0": True,  # Monday
            "1": True,  # Tuesday
            "2": True,  # Wednesday
            "3": True,  # Thursday
            "4": True,  # Friday
            "5": True,  # Saturday
            "6": False, # Sunday
        },
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __init__(
        self,
        start_time,
        end_time,
        requires_break=True,
        active_days=None,
        shift_type=None,
        shift_type_id=None,
    ):
        self.start_time = start_time
        self.end_time = end_time
        self.requires_break = requires_break
        self.active_days = active_days or {
            "0": True,  # Monday
            "1": True,  # Tuesday
            "2": True,  # Wednesday
            "3": True,  # Thursday
            "4": True,  # Friday
            "5": True,  # Saturday
            "6": False, # Sunday
        }
        self.shift_type_id = shift_type_id

        # Determine shift type based on time if not provided
        if shift_type is None:
            start_hour = int(start_time.split(":")[0])
            end_hour = int(end_time.split(":")[0])

            # Get settings-based shift types if available
            settings = Settings.query.first()
            if settings and hasattr(settings, "shift_types") and settings.shift_types:
                # Determine the shift type ID and enum based on time
                if start_hour < 11:
                    self.shift_type = ShiftType.EARLY
                    # If shift_type_id wasn't explicitly provided, set it to "EARLY"
                    if not self.shift_type_id:
                        self.shift_type_id = "EARLY"
                elif end_hour >= 18:
                    self.shift_type = ShiftType.LATE
                    # If shift_type_id wasn't explicitly provided, set it to "LATE"
                    if not self.shift_type_id:
                        self.shift_type_id = "LATE"
                else:
                    self.shift_type = ShiftType.MIDDLE
                    # If shift_type_id wasn't explicitly provided, set it to "MIDDLE"
                    if not self.shift_type_id:
                        self.shift_type_id = "MIDDLE"
            else:
                # Fall back to enum-based ShiftType
                if start_hour < 11:
                    self.shift_type = ShiftType.EARLY
                    if not self.shift_type_id:
                        self.shift_type_id = "EARLY"
                elif end_hour >= 18:
                    self.shift_type = ShiftType.LATE
                    if not self.shift_type_id:
                        self.shift_type_id = "LATE"
                else:
                    self.shift_type = ShiftType.MIDDLE
                    if not self.shift_type_id:
                        self.shift_type_id = "MIDDLE"
        else:
            self.shift_type = shift_type
            # Set the shift_type_id based on the enum if not provided
            if not self.shift_type_id:
                if self.shift_type == ShiftType.EARLY:
                    self.shift_type_id = "EARLY"
                elif self.shift_type == ShiftType.MIDDLE:
                    self.shift_type_id = "MIDDLE"
                elif self.shift_type == ShiftType.LATE:
                    self.shift_type_id = "LATE"

        # Calculate duration and validate
        self._calculate_duration()
        self.validate()

    def validate(self):
        """Validate shift data. Call this before saving to database."""
        # Always recalculate duration before validation
        self._calculate_duration()
        self._validate_store_hours()
        return self

    def _calculate_duration(self):
        """Calculate the duration of the shift in hours"""
        try:
            # Get hours and minutes
            start_hour, start_minute = map(int, self.start_time.split(":"))
            end_hour, end_minute = map(int, self.end_time.split(":"))

            # Convert to minutes
            start_minutes = start_hour * 60 + start_minute
            end_minutes = end_hour * 60 + end_minute

            # Handle shifts that go past midnight
            if end_minutes < start_minutes:
                end_minutes += 24 * 60  # Add 24 hours

            # Calculate duration in hours
            duration = (end_minutes - start_minutes) / 60

            # Log the calculation
            if hasattr(logger, "schedule_logger"):
                logger.schedule_logger.debug(
                    f"Calculated shift duration: {self.start_time} - {self.end_time} = {duration:.2f} hours"
                )
            else:
                logger.debug(
                    f"Calculated shift duration: {self.start_time} - {self.end_time} = {duration:.2f} hours"
                )

            # Set the duration
            self.duration_hours = duration
            return duration
        except Exception as e:
            if hasattr(logger, "schedule_logger"):
                logger.schedule_logger.error(
                    f"Error calculating shift duration: {str(e)}"
                )
            else:
                logger.error(f"Error calculating shift duration: {str(e)}")
            return 0

    def _validate_store_hours(self):
        """Validate that shift times are within store hours, considering keyholder requirements"""
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()

        def time_to_minutes(time_str: str) -> int:
            hours, minutes = map(int, time_str.split(":"))
            return hours * 60 + minutes

        shift_start = time_to_minutes(self.start_time)
        shift_end = time_to_minutes(self.end_time)
        store_open = time_to_minutes(settings.store_opening)
        store_close = time_to_minutes(settings.store_closing)

        # For opening shifts, allow starting before store opening if requires_keyholder
        earliest_allowed_start = store_open - settings.keyholder_before_minutes
        latest_allowed_end = store_close + settings.keyholder_after_minutes

        # if shift_start < earliest_allowed_start:
        #     raise ShiftValidationError(
        #         f"Shift cannot start more than {settings.keyholder_before_minutes} minutes before store opening time ({settings.store_opening})"
        #     )
        if shift_end > latest_allowed_end:
            raise ShiftValidationError(
                f"Shift cannot end more than {settings.keyholder_after_minutes} minutes after store closing time ({settings.store_closing})"
            )

    def to_dict(self):
        """Convert shift to dictionary"""
        # Ensure duration is calculated before converting to dict
        if self.duration_hours is None or self.duration_hours <= 0:
            self._calculate_duration()

        # Try to get settings-based shift type first
        settings = Settings.query.first()
        shift_type_value = self.shift_type.value if self.shift_type else None
        shift_type_data = None

        # If settings exist, try to find a matching shift type by ID
        if settings and hasattr(settings, "shift_types") and settings.shift_types:
            # Try to find a matching shift type from settings using shift_type_id
            if self.shift_type_id:
                shift_type_data = next(
                    (t for t in settings.shift_types if t["id"] == self.shift_type_id),
                    None,
                )

            # If no match found or no shift_type_id provided, fall back to mapping from enum
            if not shift_type_data and shift_type_value:
                shift_type_map = {"early": "EARLY", "middle": "MIDDLE", "late": "LATE"}
                if shift_type_value in shift_type_map:
                    shift_id = shift_type_map[shift_type_value]
                    shift_type_data = next(
                        (t for t in settings.shift_types if t["id"] == shift_id), None
                    )

            # If we found shift type data, use the name
            if shift_type_data:
                shift_type_value = shift_type_data["name"]

        return {
            "id": self.id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_hours": self.duration_hours,
            "requires_break": self.requires_break,
            "shift_type": shift_type_value,
            "shift_type_id": self.shift_type_id,
            "active_days": self.active_days,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<ShiftTemplate {self.start_time}-{self.end_time}>"

    @staticmethod
    def time_to_minutes(time_str):
        """Convert time string to minutes since midnight"""
        hour, minute = map(int, time_str.split(":"))
        return hour * 60 + minute

    def validate_times(self):
        """Validate shift times"""
        # Check if end time is after start time
        start_minutes = self.time_to_minutes(self.start_time)
        end_minutes = self.time_to_minutes(self.end_time)

        # Allow overnight shifts
        if end_minutes < start_minutes:
            end_minutes += 24 * 60  # Add 24 hours

        # Check if shift is too short (less than 1 hour)
        if end_minutes - start_minutes < 60:
            raise ShiftValidationError("Shift must be at least 1 hour long")

        # Check if shift is too long (more than 12 hours)
        if end_minutes - start_minutes > 12 * 60:
            raise ShiftValidationError("Shift cannot be longer than 12 hours")

        # Check if break is required
        if self.requires_break and end_minutes - start_minutes > 6 * 60:
            # Shifts longer than 6 hours require a break
            pass  # This is just a validation, actual break scheduling happens elsewhere

        return True

    @staticmethod
    def create_default_shifts():
        """Create a set of default shifts for a typical retail store"""
        default_shifts = [
            # Morning shifts
            ShiftTemplate(
                start_time="08:00",
                end_time="16:00",
                requires_break=True,
            ),
            ShiftTemplate(
                start_time="09:00",
                end_time="17:00",
                requires_break=True,
            ),
            # Midday shifts
            ShiftTemplate(
                start_time="10:00",
                end_time="18:00",
                requires_break=True,
            ),
            ShiftTemplate(
                start_time="11:00",
                end_time="19:00",
                requires_break=True,
            ),
            # Evening shifts
            ShiftTemplate(
                start_time="12:00",
                end_time="20:00",
                requires_break=True,
            ),
            # Part-time shifts
            ShiftTemplate(
                start_time="08:00",
                end_time="12:00",
                requires_break=False,
            ),
            ShiftTemplate(
                start_time="12:00",
                end_time="16:00",
                requires_break=False,
            ),
            ShiftTemplate(
                start_time="16:00",
                end_time="20:00",
                requires_break=False,
            ),
        ]
        return default_shifts
