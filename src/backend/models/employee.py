from . import db
from enum import Enum
from datetime import datetime, date
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
# Re-add the import for backward compatibility
from .availability import AvailabilityType


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
    created_at = Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    schedule_entries = relationship("Schedule", back_populates="employee")
    # Define relationship with forward declaration
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
        self.updated_at = datetime.utcnow()

    def deactivate(self):
        """Deactivate the employee"""
        self.is_active = False
        self.updated_at = datetime.utcnow()

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
