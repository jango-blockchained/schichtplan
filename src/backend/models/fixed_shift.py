from . import db
from datetime import datetime
from .settings import Settings
from enum import Enum


class ShiftType(Enum):
    EARLY = "early"
    MIDDLE = "middle"
    LATE = "late"


class ShiftValidationError(Exception):
    """Custom validation error for shifts"""

    pass


class ShiftTemplate(db.Model):
    __tablename__ = "shifts"

    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    end_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    min_employees = db.Column(db.Integer, nullable=False)
    max_employees = db.Column(db.Integer, nullable=False)
    duration_hours = db.Column(db.Float, nullable=False)
    requires_break = db.Column(db.Boolean, nullable=False, default=True)
    shift_type = db.Column(db.Enum(ShiftType), nullable=False)
    active_days = db.Column(
        db.JSON,
        nullable=False,
        default=lambda: {
            "0": False,  # Sunday
            "1": True,  # Monday
            "2": True,  # Tuesday
            "3": True,  # Wednesday
            "4": True,  # Thursday
            "5": True,  # Friday
            "6": True,  # Saturday
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
        min_employees=1,
        max_employees=5,
        requires_break=True,
        active_days=None,
        shift_type=None,
    ):
        self.start_time = start_time
        self.end_time = end_time
        self.min_employees = min_employees
        self.max_employees = max_employees
        self.requires_break = requires_break
        self.active_days = active_days or {
            "0": False,  # Sunday
            "1": True,  # Monday
            "2": True,  # Tuesday
            "3": True,  # Wednesday
            "4": True,  # Thursday
            "5": True,  # Friday
            "6": True,  # Saturday
        }

        # Determine shift type based on time if not provided
        if shift_type is None:
            start_hour = int(start_time.split(":")[0])
            end_hour = int(end_time.split(":")[0])

            if start_hour < 8:
                self.shift_type = ShiftType.EARLY
            elif end_hour >= 18:
                self.shift_type = ShiftType.LATE
            else:
                self.shift_type = ShiftType.MIDDLE
        else:
            self.shift_type = shift_type

        self._calculate_duration()
        self._needs_validation = True  # Flag to track if validation is needed

    def validate(self):
        """Validate shift data. Call this before saving to database."""
        if self._needs_validation:
            self._calculate_duration()
            self._validate_store_hours()
            self._needs_validation = False
        return self

    def _calculate_duration(self):
        """Calculate shift duration in hours"""
        start_hour, start_minute = map(int, self.start_time.split(":"))
        end_hour, end_minute = map(int, self.end_time.split(":"))

        # Convert to minutes
        start_minutes = start_hour * 60 + start_minute
        end_minutes = end_hour * 60 + end_minute

        # Handle overnight shifts
        if end_minutes < start_minutes:
            end_minutes += 24 * 60  # Add 24 hours

        # Calculate duration in hours
        self.duration_hours = (end_minutes - start_minutes) / 60

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
        return {
            "id": self.id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "min_employees": self.min_employees,
            "max_employees": self.max_employees,
            "duration_hours": self.duration_hours,
            "requires_break": self.requires_break,
            "shift_type": self.shift_type.value if self.shift_type else None,
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
                min_employees=2,
                max_employees=4,
                requires_break=True,
            ),
            ShiftTemplate(
                start_time="09:00",
                end_time="17:00",
                min_employees=2,
                max_employees=4,
                requires_break=True,
            ),
            # Midday shifts
            ShiftTemplate(
                start_time="10:00",
                end_time="18:00",
                min_employees=2,
                max_employees=4,
                requires_break=True,
            ),
            ShiftTemplate(
                start_time="11:00",
                end_time="19:00",
                min_employees=2,
                max_employees=4,
                requires_break=True,
            ),
            # Evening shifts
            ShiftTemplate(
                start_time="12:00",
                end_time="20:00",
                min_employees=2,
                max_employees=4,
                requires_break=True,
            ),
            # Part-time shifts
            ShiftTemplate(
                start_time="08:00",
                end_time="12:00",
                min_employees=1,
                max_employees=2,
                requires_break=False,
            ),
            ShiftTemplate(
                start_time="12:00",
                end_time="16:00",
                min_employees=1,
                max_employees=2,
                requires_break=False,
            ),
            ShiftTemplate(
                start_time="16:00",
                end_time="20:00",
                min_employees=1,
                max_employees=2,
                requires_break=False,
            ),
        ]
        return default_shifts
