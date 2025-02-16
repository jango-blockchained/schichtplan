from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .employee import Employee, EmployeeGroup
from .shift import Shift, ShiftType
from .schedule import Schedule
from .store_config import StoreConfig
from .shift_template import ShiftTemplate, ShiftTemplateEntry
from .availability import EmployeeAvailability, AvailabilityType

__all__ = [
    'db',
    'Employee',
    'EmployeeGroup',
    'Shift',
    'ShiftType',
    'Schedule',
    'StoreConfig',
    'ShiftTemplate',
    'EmployeeAvailability',
    'AvailabilityType'
] 