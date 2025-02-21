from . import db
from enum import Enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import date

class AvailabilityType(str, Enum):
    UNAVAILABLE = "unavailable"
    AVAILABLE = "available"
    PREFERRED_WORK = "preferred_work"
    REGULAR = "regular"
    TEMPORARY = "temporary"
    VACATION = "vacation"
    SICK = "sick"

class EmployeeGroup(str, Enum):
    VL = "VL"  # Vollzeit
    TZ = "TZ"  # Teilzeit
    GFB = "GFB"  # Geringfügig Beschäftigt
    TL = "TL"  # Team Leader

class Employee(db.Model):
    __tablename__ = 'employees'

    id = Column(Integer, primary_key=True)
    employee_id = Column(String(50), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    employee_group = Column(SQLEnum(EmployeeGroup), nullable=False)
    contracted_hours = Column(Float, nullable=False)
    is_keyholder = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    email = Column(String(120), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    created_at = Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    shifts = relationship('Schedule', back_populates='employee')
    availabilities = relationship("EmployeeAvailability", back_populates="employee", cascade="all, delete-orphan")

    def __init__(self, employee_id, first_name, last_name, employee_group, contracted_hours, 
                 is_keyholder=False, is_active=True, email=None, phone=None):
        self.employee_id = employee_id
        self.first_name = first_name
        self.last_name = last_name
        self.employee_group = employee_group
        self.contracted_hours = contracted_hours
        self.is_keyholder = is_keyholder
        self.is_active = is_active
        self.email = email
        self.phone = phone
        
        # Validate the employee data
        if not self.validate_hours():
            raise ValueError("Invalid contracted hours for employee group")

    def _generate_employee_id(self, first_name, last_name):
        """Generate a unique 3-letter identifier based on name"""
        # Handle short names by padding with 'X'
        first = first_name[0] if first_name else 'X'
        last = last_name[:2] if len(last_name) >= 2 else (last_name + 'X' * 2)[:2]
        base_id = (first + last).upper()
        
        # Check if ID exists and generate alternative if needed
        counter = 1
        temp_id = base_id
        while Employee.query.filter_by(employee_id=temp_id).first() is not None:
            temp_id = f"{base_id[0]}{counter:02d}"
            counter += 1
        return temp_id

    def validate_hours(self) -> bool:
        """Validate contracted hours based on employee group and legal limits"""
        if not 0 <= self.contracted_hours <= 48:  # German labor law maximum
            return False
            
        if self.employee_group == EmployeeGroup.VL or self.employee_group == EmployeeGroup.TL:
            # Full-time employees should work between 35 and 48 hours
            return 35 <= self.contracted_hours <= 48
        elif self.employee_group == EmployeeGroup.TZ:
            # Part-time employees can work up to 35 hours
            return 0 < self.contracted_hours < 35
        elif self.employee_group == EmployeeGroup.GFB:
            # Minijob employees must stay under the monthly limit (556 EUR / 12.41 EUR minimum wage)
            max_monthly_hours = 556 / 12.41  # ~44.8 hours per month
            max_weekly_hours = max_monthly_hours / 4.33  # Convert to weekly hours
            return 0 <= self.contracted_hours <= max_weekly_hours
        return False

    def get_max_daily_hours(self) -> float:
        """Get maximum allowed daily hours"""
        return 10.0  # Maximum 10 hours per day according to German law

    def get_max_weekly_hours(self) -> float:
        """Get maximum allowed weekly hours based on employment type"""
        if self.employee_group in [EmployeeGroup.VL, EmployeeGroup.TL]:
            return 48.0  # Maximum 48 hours per week for full-time
        elif self.employee_group == EmployeeGroup.TZ:
            return self.contracted_hours
        else:  # GFB
            # Convert monthly limit to weekly (assuming 4.33 weeks per month)
            max_monthly_hours = 556 / 12.41
            return max_monthly_hours / 4.33

    def to_dict(self):
        """Convert employee object to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'employee_group': self.employee_group.value,
            'contracted_hours': self.contracted_hours,
            'is_keyholder': self.is_keyholder,
            'is_active': self.is_active,
            'email': self.email,
            'phone': self.phone,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'max_daily_hours': self.get_max_daily_hours(),
            'max_weekly_hours': self.get_max_weekly_hours()
        }

    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.first_name} {self.last_name}>"

class EmployeeAvailability(db.Model):
    __tablename__ = 'employee_availabilities'

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey('employees.id', ondelete='CASCADE'), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    hour = Column(Integer, nullable=False)
    is_available = Column(Boolean, nullable=False, default=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_recurring = Column(Boolean, nullable=False, default=True)
    availability_type = Column(SQLEnum(AvailabilityType), nullable=False, default=AvailabilityType.REGULAR)
    created_at = Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", back_populates="availabilities")

    def __init__(self, employee_id, day_of_week, hour, is_available=True, start_date=None, end_date=None, is_recurring=True, availability_type=AvailabilityType.REGULAR):
        self.employee_id = employee_id
        self.day_of_week = day_of_week
        self.hour = hour
        self.is_available = is_available
        self.start_date = start_date
        self.end_date = end_date
        self.is_recurring = is_recurring
        self.availability_type = availability_type

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'day_of_week': self.day_of_week,
            'hour': self.hour,
            'is_available': self.is_available,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_recurring': self.is_recurring,
            'availability_type': self.availability_type.value,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def is_available_for_date(self, check_date: date, shift_start: str = None, shift_end: str = None) -> bool:
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

        # If no shift times provided, just check the date
        if shift_start is None or shift_end is None:
            return True

        # Convert shift times to hours
        start_hour = int(shift_start.split(':')[0])
        end_hour = int(shift_end.split(':')[0])

        # Check if the hour falls within the shift
        return start_hour <= self.hour < end_hour and self.is_available 