from . import db
from datetime import datetime
from .settings import Settings


class ShiftValidationError(Exception):
    """Custom validation error for shifts"""

    pass


class Shift(db.Model):
    __tablename__ = "shifts"

    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    end_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    min_employees = db.Column(db.Integer, nullable=False)
    max_employees = db.Column(db.Integer, nullable=False)
    duration_hours = db.Column(db.Float, nullable=False)
    requires_break = db.Column(db.Boolean, nullable=False, default=True)
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

    # Relationships
    schedules = db.relationship("Schedule", back_populates="shift")

    def __init__(
        self,
        start_time,
        end_time,
        min_employees=1,
        max_employees=5,
        requires_break=True,
        active_days=None,
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
        start_hour, start_min = map(int, self.start_time.split(":"))
        end_hour, end_min = map(int, self.end_time.split(":"))
        duration_minutes = (end_hour * 60 + end_min) - (start_hour * 60 + start_min)
        self.duration_hours = duration_minutes / 60.0

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
            "active_days": self.active_days,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Shift {self.start_time}-{self.end_time}>"
