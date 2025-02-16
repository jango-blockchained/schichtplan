from . import db
from datetime import date, time
from enum import Enum

class AvailabilityType(str, Enum):
    UNAVAILABLE = "unavailable"  # Completely unavailable (vacation, sick leave, etc.)
    PREFERRED_OFF = "preferred_off"  # Prefers not to work but can if needed
    PREFERRED_WORK = "preferred_work"  # Prefers to work
    AVAILABLE = "available"  # Default state - can work

class EmployeeAvailability(db.Model):
    __tablename__ = 'employee_availabilities'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=True)  # If null, applies to whole day
    end_time = db.Column(db.Time, nullable=True)    # If null, applies to whole day
    availability_type = db.Column(db.Enum(AvailabilityType), nullable=False, default=AvailabilityType.UNAVAILABLE)
    reason = db.Column(db.String(200), nullable=True)
    is_recurring = db.Column(db.Boolean, default=False)  # For weekly recurring preferences
    recurrence_day = db.Column(db.Integer, nullable=True)  # 0-6 for Monday-Sunday if recurring

    # Relationships
    employee = db.relationship('Employee', backref='availabilities')

    def __init__(self, employee_id, start_date, end_date, availability_type=AvailabilityType.UNAVAILABLE,
                 start_time=None, end_time=None, reason=None, is_recurring=False, recurrence_day=None):
        self.employee_id = employee_id
        self.start_date = start_date
        self.end_date = end_date
        self.start_time = start_time
        self.end_time = end_time
        self.availability_type = availability_type
        self.reason = reason
        self.is_recurring = is_recurring
        self.recurrence_day = recurrence_day

    def to_dict(self):
        """Convert availability object to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'start_date': self.start_date.strftime('%Y-%m-%d'),
            'end_date': self.end_date.strftime('%Y-%m-%d'),
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'availability_type': self.availability_type.value,
            'reason': self.reason,
            'is_recurring': self.is_recurring,
            'recurrence_day': self.recurrence_day
        }

    def overlaps(self, other):
        """Check if this availability period overlaps with another"""
        return (
            self.employee_id == other.employee_id and
            self.start_date <= other.end_date and
            self.end_date >= other.start_date and
            (
                not self.start_time or
                not other.start_time or
                (self.start_time <= other.end_time and self.end_time >= other.start_time)
            )
        )

    def is_available_for_date(self, check_date, check_start_time=None, check_end_time=None):
        """Check if employee is available for a specific date and time range"""
        # Check if date is within range
        if not (self.start_date <= check_date <= self.end_date):
            if not self.is_recurring:
                return self.availability_type != AvailabilityType.UNAVAILABLE
            # For recurring availabilities, check if the day of week matches
            if self.recurrence_day != check_date.weekday():
                return self.availability_type != AvailabilityType.UNAVAILABLE

        # If no time specified, just check the date
        if not check_start_time or not check_end_time or not self.start_time or not self.end_time:
            return self.availability_type != AvailabilityType.UNAVAILABLE

        # Check time overlap
        if (self.start_time <= check_end_time and self.end_time >= check_start_time):
            return self.availability_type != AvailabilityType.UNAVAILABLE

        return True

    def __repr__(self):
        return f"<EmployeeAvailability {self.employee_id}: {self.start_date} to {self.end_date}>" 