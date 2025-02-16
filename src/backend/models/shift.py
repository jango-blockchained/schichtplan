from . import db
from enum import Enum
from datetime import time

class ShiftType(str, Enum):
    EARLY = "Frühschicht"
    MIDDLE = "Mittelschicht"
    LATE = "Spätschicht"

class Shift(db.Model):
    __tablename__ = 'shifts'

    id = db.Column(db.Integer, primary_key=True)
    shift_type = db.Column(db.Enum(ShiftType), nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    min_employees = db.Column(db.Integer, nullable=False)
    max_employees = db.Column(db.Integer, nullable=False)
    
    # Relationships
    schedules = db.relationship('Schedule', back_populates='shift')

    def __init__(self, shift_type, start_time, end_time, min_employees=1, max_employees=5):
        self.shift_type = shift_type
        self.start_time = start_time
        self.end_time = end_time
        self.min_employees = min_employees
        self.max_employees = max_employees

    @property
    def duration_hours(self):
        """Calculate shift duration in hours"""
        start = self.start_time.hour + self.start_time.minute / 60
        end = self.end_time.hour + self.end_time.minute / 60
        return end - start

    def requires_break(self):
        """Check if shift duration requires a break (>6 hours)"""
        return self.duration_hours > 6

    def to_dict(self):
        """Convert shift object to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'shift_type': self.shift_type.value,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'min_employees': self.min_employees,
            'max_employees': self.max_employees,
            'duration_hours': self.duration_hours,
            'requires_break': self.requires_break()
        }

    @classmethod
    def create_default_shifts(cls):
        """Create default shift definitions"""
        return [
            cls(
                ShiftType.EARLY,
                time(8, 55) if True else time(9, 0),  # Keyholder starts earlier
                time(17, 0),
                min_employees=2,
                max_employees=5
            ),
            cls(
                ShiftType.MIDDLE,
                time(11, 0),
                time(19, 0),
                min_employees=2,
                max_employees=5
            ),
            cls(
                ShiftType.LATE,
                time(13, 0),
                time(20, 10) if True else time(20, 0),  # Keyholder ends later
                min_employees=2,
                max_employees=4
            )
        ]

    def __repr__(self):
        return f"<Shift {self.shift_type.value}: {self.start_time}-{self.end_time}>" 