"""
Database models initialization
"""

from flask_sqlalchemy import SQLAlchemy

# Create a database instance
db = SQLAlchemy()

# Import models after db instantiation to avoid circular imports
from .employee import Employee, EmployeeGroup
from .fixed_shift import ShiftTemplate, ShiftType, ShiftPattern
from .settings import Settings
from .schedule import Schedule, ScheduleStatus, ScheduleVersionMeta
from .coverage import Coverage, RecurringCoverage
from .absence import Absence
# Import availability after employee to avoid circular imports
from .availability import EmployeeAvailability, AvailabilityType
from .version import VersionMeta

# Export all models for ease of import
__all__ = [
    "db",
    "Employee",
    "EmployeeGroup",
    "ShiftTemplate",
    "ShiftType",
    "ShiftPattern",
    "Settings",
    "Schedule",
    "ScheduleStatus",
    "ScheduleVersionMeta",
    "Coverage",
    "RecurringCoverage",
    "Absence",
    "EmployeeAvailability",
    "AvailabilityType",
    "VersionMeta",
]
