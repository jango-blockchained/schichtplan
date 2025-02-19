from . import db
from datetime import datetime

class Shift(db.Model):
    __tablename__ = 'shifts'
    
    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    end_time = db.Column(db.String(5), nullable=False)    # Format: "HH:MM"
    min_employees = db.Column(db.Integer, nullable=False)
    max_employees = db.Column(db.Integer, nullable=False)
    duration_hours = db.Column(db.Float, nullable=False)
    requires_break = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schedules = db.relationship('Schedule', back_populates='shift')

    def __init__(self, start_time, end_time, min_employees=1, max_employees=5, requires_break=True):
        self.start_time = start_time
        self.end_time = end_time
        self.min_employees = min_employees
        self.max_employees = max_employees
        self.requires_break = requires_break
        self._calculate_duration()

    def _calculate_duration(self):
        """Calculate shift duration in hours"""
        start_hour, start_min = map(int, self.start_time.split(':'))
        end_hour, end_min = map(int, self.end_time.split(':'))
        duration_minutes = (end_hour * 60 + end_min) - (start_hour * 60 + start_min)
        self.duration_hours = duration_minutes / 60.0

    def to_dict(self):
        """Convert shift to dictionary"""
        return {
            'id': self.id,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'min_employees': self.min_employees,
            'max_employees': self.max_employees,
            'duration_hours': self.duration_hours,
            'requires_break': self.requires_break,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f"<Shift {self.start_time}-{self.end_time}>" 