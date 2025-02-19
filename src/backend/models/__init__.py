from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models after db is defined to avoid circular imports
from .settings import Settings
from .shift import Shift
from .employee import Employee
from .schedule import Schedule
from .availability import EmployeeAvailability as Availability

__all__ = [
    'db',
    'Settings',
    'Shift',
    'Employee',
    'Schedule',
    'Availability'
] 