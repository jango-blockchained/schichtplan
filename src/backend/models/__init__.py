from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models after db is defined to avoid circular imports
from .settings import Settings
from .shift import Shift
from .employee import Employee, EmployeeAvailability, EmployeeGroup
from .schedule import Schedule
from .absence import Absence
from .coverage import Coverage

__all__ = [
    'db',
    'Settings',
    'Shift',
    'Employee',
    'Schedule',
    'EmployeeAvailability',
    'EmployeeGroup',
    'Absence',
    'Coverage'
] 