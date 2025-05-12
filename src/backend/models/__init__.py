from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models after db is defined to avoid circular imports
from .settings import Settings
from .fixed_shift import ShiftTemplate, ShiftType
from .employee import Employee, EmployeeAvailability, EmployeeGroup
from .schedule import Schedule, ScheduleVersionMeta, ScheduleStatus
from .absence import Absence
from .coverage import Coverage
from .user import User, UserRole

__all__ = [
    "db",
    "Settings",
    "ShiftTemplate",
    "ShiftType",
    "Employee",
    "Schedule",
    "ScheduleVersionMeta",
    "ScheduleStatus",
    "EmployeeAvailability",
    "EmployeeGroup",
    "Absence",
    "Coverage",
    "User",
    "UserRole",
]
