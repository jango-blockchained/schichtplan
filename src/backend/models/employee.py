from . import db
from enum import Enum
from datetime import datetime, date, UTC
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Float,
    ForeignKey,
    Date,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship
import logging


class AvailabilityType(str, Enum):
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


class EmployeeGroup(str, Enum):
    VZ = "VZ"  # Vollzeit
    TZ = "TZ"  # Teilzeit
    GFB = "GFB"  # Geringfügig Beschäftigt
    TL = "TL"  # Team Leader


class Employee(db.Model):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    employee_id = Column(String(50), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    employee_group = Column(SQLEnum(EmployeeGroup), nullable=False)
    contracted_hours = Column(Float, nullable=False)
    is_keyholder = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    birthday = Column(Date, nullable=True)
    email = Column(String(120), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    created_at = Column(db.DateTime, nullable=False, default=datetime.now(UTC))
    updated_at = Column(
        db.DateTime, nullable=False, default=datetime.now(UTC), onupdate=datetime.now(UTC)
    )

    # Relationships
    schedule_entries = relationship("Schedule", back_populates="employee")
    availabilities = relationship(
        "EmployeeAvailability", back_populates="employee", cascade="all, delete-orphan"
    )

    def __init__(
        self,
        first_name,
        last_name,
        employee_group,
        contracted_hours,
        employee_id=None,
        is_keyholder=False,
        is_active=True,
        birthday=None,
        email=None,
        phone=None,
    ):
        self.first_name = first_name
        self.last_name = last_name
        self.employee_group = employee_group
        self.contracted_hours = contracted_hours
        self.employee_id = employee_id or self._generate_employee_id(
            first_name, last_name
        )
        self.is_keyholder = is_keyholder
        self.is_active = is_active
        self.birthday = birthday
        self.email = email
        self.phone = phone

        # Validate the employee data
        if not self.validate_hours():
            raise ValueError("Invalid contracted hours for employee group")

    def _generate_employee_id(self, first_name, last_name):
        """Generate a unique 3-letter identifier based on name"""
        # Handle short names by padding with 'X'
        first = first_name[0] if first_name else "X"
        last = last_name[:2] if len(last_name) >= 2 else (last_name + "X" * 2)[:2]
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
        logging.info(
            f"Validating hours for employee: {self.first_name} {self.last_name}"
        )
        logging.info(
            f"Employee group: {self.employee_group}, type: {type(self.employee_group)}"
        )
        logging.info(f"Contracted hours: {self.contracted_hours}")

        if not 0 <= self.contracted_hours <= 48:  # German labor law maximum
            logging.warning(
                f"Contracted hours outside of legal limit: {self.contracted_hours}"
            )
            return False

        if self.employee_group in [EmployeeGroup.VZ, EmployeeGroup.TL]:
            # Full-time employees should work between 35 and 48 hours
            valid = 35 <= self.contracted_hours <= 48
            logging.info(f"VZ/TL validation result: {valid}")
            return valid
        elif self.employee_group == EmployeeGroup.TZ:
            # Part-time employees should work between 10 and 35 hours
            valid = 10 <= self.contracted_hours <= 35
            logging.info(f"TZ validation result: {valid}")
            return valid
        elif self.employee_group == EmployeeGroup.GFB:
            # Geringfügig Beschäftigt employees must stay under the monthly limit (556 EUR / 12.41 EUR minimum wage)
            max_monthly_hours = 556 / 12.41  # ~44.8 hours per month
            max_weekly_hours = max_monthly_hours / 4.33  # Convert to weekly hours
            valid = 0 <= self.contracted_hours <= max_weekly_hours
            logging.info(
                f"GFB validation result: {valid}, max_weekly_hours: {max_weekly_hours}"
            )
            return valid

        logging.warning(f"Unknown employee group: {self.employee_group}")
        return False

    def get_max_daily_hours(self) -> float:
        """Get maximum allowed daily hours"""
        return 10.0  # Maximum 10 hours per day according to German law

    def get_max_weekly_hours(self) -> float:
        """Get maximum allowed weekly hours based on employment type"""
        if self.employee_group in [EmployeeGroup.VZ, EmployeeGroup.TL]:
            return 48.0  # Maximum 48 hours per week for full-time
        elif self.employee_group == EmployeeGroup.TZ:
            return self.contracted_hours
        else:  # GFB
            # Convert monthly limit to weekly (assuming 4.33 weeks per month)
            max_monthly_hours = 556 / 12.41
            return max_monthly_hours / 4.33

    def activate(self):
        """Activate the employee"""
        self.is_active = True
        self.updated_at = datetime.now(UTC)

    def deactivate(self):
        """Deactivate the employee"""
        self.is_active = False
        self.updated_at = datetime.now(UTC)

    def to_dict(self):
        """Convert employee object to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "employee_group": self.employee_group.value,
            "contracted_hours": self.contracted_hours,
            "is_keyholder": self.is_keyholder,
            "is_active": self.is_active,
            "birthday": self.birthday.isoformat() if self.birthday else None,
            "email": self.email,
            "phone": self.phone,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "max_daily_hours": self.get_max_daily_hours(),
            "max_weekly_hours": self.get_max_weekly_hours(),
        }

    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.first_name} {self.last_name}>"


class EmployeeAvailability(db.Model):
    __tablename__ = "employee_availabilities"

    id = Column(Integer, primary_key=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    day_of_week = Column(Integer, nullable=False)
    hour = Column(Integer, nullable=False)
    is_available = Column(Boolean, nullable=False, default=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_recurring = Column(Boolean, nullable=False, default=True)
    availability_type = Column(
        SQLEnum(AvailabilityType), nullable=False, default=AvailabilityType.AVAILABLE
    )
    created_at = Column(db.DateTime, nullable=False, default=datetime.now(UTC))
    updated_at = Column(
        db.DateTime, nullable=False, default=datetime.now(UTC), onupdate=datetime.now(UTC)
    )

    employee = relationship("Employee", back_populates="availabilities")

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

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "day_of_week": self.day_of_week,
            "hour": self.hour,
            "is_available": self.is_available,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "is_recurring": self.is_recurring,
            "availability_type": self.availability_type.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
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
