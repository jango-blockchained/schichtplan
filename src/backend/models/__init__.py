from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models after db is defined to avoid circular imports
from .settings import Settings
from .shift import Shift
from .employee import Employee, EmployeeAvailability
from .schedule import Schedule
from .absence import Absence

__all__ = [
    'db',
    'Settings',
    'Shift',
    'Employee',
    'Schedule',
    'EmployeeAvailability',
    'Absence'
] 