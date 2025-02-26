from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from . import db

class Coverage(db.Model):
    __tablename__ = 'coverage'

    id = Column(Integer, primary_key=True)
    day_index = Column(Integer, nullable=False)  # 0-6 (Sunday-Saturday)
    start_time = Column(String(5), nullable=False)  # Format: "HH:MM"
    end_time = Column(String(5), nullable=False)  # Format: "HH:MM"
    min_employees = Column(Integer, nullable=False, default=1)
    max_employees = Column(Integer, nullable=False, default=3)
    employee_types = Column(JSON, nullable=False, default=list)  # List of employee type IDs
    requires_keyholder = Column(Boolean, nullable=False, default=False)  # Whether this coverage block requires a keyholder
    keyholder_before_minutes = Column(Integer, nullable=True)  # Minutes keyholder needs to be there before
    keyholder_after_minutes = Column(Integer, nullable=True)  # Minutes keyholder needs to stay after
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert coverage to dictionary"""
        return {
            'id': self.id,
            'day_index': self.day_index,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'min_employees': self.min_employees,
            'max_employees': self.max_employees,
            'employee_types': self.employee_types,
            'requires_keyholder': self.requires_keyholder,
            'keyholder_before_minutes': self.keyholder_before_minutes,
            'keyholder_after_minutes': self.keyholder_after_minutes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f"<Coverage {self.day_index} {self.start_time}-{self.end_time}>" 