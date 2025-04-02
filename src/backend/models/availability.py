"""
Employee availability models for scheduling.
"""

from datetime import datetime, date
from . import db
from enum import Enum
from sqlalchemy import (
    Column, 
    Integer, 
    Boolean, 
    Date, 
    ForeignKey,
    Enum as SQLEnum
)
from sqlalchemy.orm import relationship

class AvailabilityType(str, Enum):
    """Enum for availability types."""
    AVAILABLE = "AVAILABLE"  # Available for work
    FIXED = "FIXED"  # Fixed working hours
    PREFERRED = "PREFERRED"  # Preferred hours
    UNAVAILABLE = "UNAVAILABLE"  # Not available

    @property
    def is_available(self):
        """Check if this availability type counts as available for scheduling"""
        return self in [self.AVAILABLE, self.FIXED, self.PREFERRED]

    @property
    def priority(self):
        """Get priority for scheduling (lower number = higher priority)"""
        priorities = {
            self.FIXED: 1,
            self.AVAILABLE: 2,
            self.PREFERRED: 3,
            self.UNAVAILABLE: 4,
        }
        return priorities.get(self, 4)

class EmployeeAvailability(db.Model):
    """
    Model for storing employee availability for specific days and hours.
    This allows employees to specify when they are available to work.
    """
    __tablename__ = 'employee_availabilities'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(
        db.Integer, 
        db.ForeignKey('employees.id', ondelete="CASCADE"), 
        nullable=False
    )
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Monday, 6=Sunday
    hour = db.Column(db.Integer, nullable=False)  # 0-23 (hour of day)
    is_available = db.Column(db.Boolean, default=True, nullable=False)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    is_recurring = db.Column(db.Boolean, nullable=False, default=True)
    availability_type = db.Column(
        db.Enum(AvailabilityType), 
        nullable=False,
        default=AvailabilityType.AVAILABLE
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, 
        default=datetime.utcnow, 
        onupdate=datetime.utcnow, 
        nullable=False
    )
    
    # Define relationship with no back reference
    employee = db.relationship("Employee", back_populates="availabilities", foreign_keys=[employee_id])
    
    def __init__(
        self,
        employee_id,
        day_of_week,
        hour,
        is_available=True,
        start_date=None,
        end_date=None,
        is_recurring=True,
        availability_type=AvailabilityType.AVAILABLE,
    ):
        self.employee_id = employee_id
        self.day_of_week = day_of_week
        self.hour = hour
        self.is_available = is_available
        self.start_date = start_date
        self.end_date = end_date
        self.is_recurring = is_recurring
        self.availability_type = availability_type
    
    def __repr__(self):
        return f"<EmployeeAvailability employee_id={self.employee_id} day={self.day_of_week} hour={self.hour} available={self.is_available}>"
    
    def to_dict(self):
        """Convert to dictionary representation"""
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'day_of_week': self.day_of_week,
            'hour': self.hour,
            'is_available': self.is_available,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_recurring': self.is_recurring,
            'availability_type': self.availability_type.value if self.availability_type else AvailabilityType.AVAILABLE.value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
    def is_available_for_date(
        self, check_date: date, shift_start: str = None, shift_end: str = None
    ) -> bool:
        """Check if the availability applies for a given date and shift times."""
        # First check if the availability applies to this date
        if not self.is_recurring:
            if not (self.start_date and self.end_date):
                return False
            if not (self.start_date <= check_date <= self.end_date):
                return False

        # Check if this availability applies to the given day of week
        if self.day_of_week != check_date.weekday():
            return False

        # If no shift times provided, just check the date and availability
        if shift_start is None or shift_end is None:
            return self.is_available is True

        # For FIXED and PREFERRED availability types, they are available for any shift time
        if self.availability_type in [
            AvailabilityType.FIXED,
            AvailabilityType.PREFERRED,
        ]:
            return self.is_available is True

        # Convert shift times to hours
        start_hour = int(shift_start.split(":")[0])
        end_hour = int(shift_end.split(":")[0])

        # For AVAILABLE type, check if the availability hour overlaps with the shift hours
        # The employee needs to be available for at least one hour during the shift
        # Use 'is True' for SQLAlchemy boolean comparison
        if self.is_available is not True:
            return False

        # Check if the availability hour overlaps with the shift hours
        return (
            (
                self.hour >= start_hour and self.hour < end_hour
            )  # Hour is within shift time
            or (
                self.hour + 1 > start_hour and self.hour < end_hour
            )  # Hour overlaps with shift
        ) 