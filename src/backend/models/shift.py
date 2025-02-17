from . import db
from enum import Enum
from datetime import time, date, datetime, timedelta
from typing import Optional

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
        
        # Validate the shift data
        if not self.validate():
            raise ValueError("Invalid shift configuration")

    def validate(self) -> bool:
        """Validate shift configuration"""
        # Check if times are valid
        if not self.start_time or not self.end_time:
            return False
            
        # Check if min/max employees are valid
        if self.min_employees < 1 or self.max_employees < self.min_employees:
            return False
            
        # Check if shift duration is within legal limits
        if self.duration_hours > 10:
            return False
            
        return True

    @property
    def duration_hours(self) -> float:
        """Calculate shift duration in hours"""
        if not self.start_time or not self.end_time:
            return 0.0
            
        start = self.start_time.hour + self.start_time.minute / 60
        end = self.end_time.hour + self.end_time.minute / 60
        
        # Handle shifts crossing midnight
        if end < start:
            end += 24
            
        return end - start

    def requires_break(self) -> bool:
        """Check if shift duration requires a break according to German labor law"""
        return self.duration_hours > 6

    def get_required_break_duration(self) -> int:
        """Get required break duration in minutes according to German labor law"""
        if self.duration_hours > 9:
            return 45  # 45 minutes for shifts > 9 hours
        elif self.duration_hours > 6:
            return 30  # 30 minutes for shifts 6-9 hours
        return 0  # No break required for shifts <= 6 hours

    def get_optimal_break_time(self) -> tuple[Optional[time], Optional[time]]:
        """Calculate optimal break time (in the middle of the shift)"""
        if not self.requires_break():
            return None, None
            
        break_duration = self.get_required_break_duration()
        total_minutes = int(self.duration_hours * 60)
        mid_point_minutes = total_minutes // 2
        
        # Calculate break start time (30 minutes before midpoint)
        break_start_minutes = mid_point_minutes - (break_duration // 2)
        break_start = (
            datetime.combine(date.today(), self.start_time) + 
            timedelta(minutes=break_start_minutes)
        ).time()
        
        # Calculate break end time
        break_end = (
            datetime.combine(date.today(), break_start) + 
            timedelta(minutes=break_duration)
        ).time()
        
        return break_start, break_end

    def to_dict(self):
        """Convert shift object to dictionary for JSON serialization"""
        break_start, break_end = self.get_optimal_break_time()
        return {
            'id': self.id,
            'shift_type': self.shift_type.value,
            'start_time': self.start_time.strftime('%H:%M') if self.start_time else None,
            'end_time': self.end_time.strftime('%H:%M') if self.end_time else None,
            'min_employees': self.min_employees,
            'max_employees': self.max_employees,
            'duration_hours': self.duration_hours,
            'requires_break': self.requires_break(),
            'break_duration': self.get_required_break_duration(),
            'optimal_break_start': break_start.strftime('%H:%M') if break_start else None,
            'optimal_break_end': break_end.strftime('%H:%M') if break_end else None
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