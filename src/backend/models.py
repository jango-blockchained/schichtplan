from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Enum, JSON
from enum import Enum as PyEnum

db = SQLAlchemy()

class EmployeeGroup(PyEnum):
    VL = "VL"  # Vollzeit
    TZ = "TZ"  # Teilzeit
    GFB = "GfB"  # Geringfügig Beschäftigt
    TL = "TL"  # Teamleiter

class ShiftType(PyEnum):
    EARLY = "Frühschicht"
    MIDDLE = "Mittelschicht"
    LATE = "Spätschicht"

class Employee(db.Model):
    __tablename__ = 'employees'
    
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.String(3), unique=True, nullable=True)
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    employee_group = db.Column(Enum(EmployeeGroup), nullable=True)
    contracted_hours = db.Column(db.Float, nullable=True)
    is_keyholder = db.Column(db.Boolean, nullable=True, default=False)

    def __init__(self, first_name=None, last_name=None, employee_group=None, contracted_hours=None, is_keyholder=False):
        self.first_name = first_name
        self.last_name = last_name
        self.employee_group = employee_group
        self.contracted_hours = contracted_hours
        self.is_keyholder = is_keyholder

    def to_dict(self):
        """Convert employee object to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'employee_group': self.employee_group.value if self.employee_group else None,
            'contracted_hours': self.contracted_hours,
            'is_keyholder': self.is_keyholder
        }

class Shift(db.Model):
    __tablename__ = 'shifts'
    
    id = db.Column(db.Integer, primary_key=True)
    shift_type = db.Column(Enum(ShiftType), nullable=False)
    start_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    end_time = db.Column(db.String(5), nullable=False)    # Format: "HH:MM"
    min_employees = db.Column(db.Integer, nullable=False)
    max_employees = db.Column(db.Integer, nullable=False)
    duration_hours = db.Column(db.Float, nullable=False)
    requires_break = db.Column(db.Boolean, nullable=False, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'shift_type': self.shift_type.value,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'min_employees': self.min_employees,
            'max_employees': self.max_employees,
            'duration_hours': self.duration_hours,
            'requires_break': self.requires_break
        }

class Schedule(db.Model):
    __tablename__ = 'schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=False)
    break_start = db.Column(db.String(5), nullable=True)  # Format: "HH:MM"
    break_end = db.Column(db.String(5), nullable=True)    # Format: "HH:MM"
    
    employee = db.relationship('Employee', backref='schedules')
    shift = db.relationship('Shift', backref='schedules')

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.strftime('%Y-%m-%d'),
            'employee': {
                'id': self.employee.id,
                'name': f"{self.employee.first_name} {self.employee.last_name}"
            },
            'shift': {
                'id': self.shift.id,
                'type': self.shift.shift_type.value,
                'start_time': self.shift.start_time,
                'end_time': self.shift.end_time
            },
            'break_start': self.break_start,
            'break_end': self.break_end
        }

class StoreConfig(db.Model):
    __tablename__ = 'store_config'
    
    id = db.Column(db.Integer, primary_key=True)
    store_name = db.Column(db.String(100), nullable=False)
    opening_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    closing_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    min_employees_per_shift = db.Column(db.Integer, nullable=False)
    max_employees_per_shift = db.Column(db.Integer, nullable=False)
    break_duration_minutes = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'store_name': self.store_name,
            'opening_time': self.opening_time,
            'closing_time': self.closing_time,
            'min_employees_per_shift': self.min_employees_per_shift,
            'max_employees_per_shift': self.max_employees_per_shift,
            'break_duration_minutes': self.break_duration_minutes
        } 