from . import db
from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum


class ScheduleStatus(str, Enum):
    DRAFT = "DRAFT"  # Initial state, can be modified
    PUBLISHED = "PUBLISHED"  # Published to employees, can't be modified
    ARCHIVED = "ARCHIVED"  # Old schedule, kept for records


class Schedule(db.Model):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    date = Column(DateTime, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    break_start = Column(db.String(5), nullable=True)
    break_end = Column(db.String(5), nullable=True)
    notes = Column(db.Text, nullable=True)
    status = Column(
        SQLEnum(ScheduleStatus), nullable=False, default=ScheduleStatus.DRAFT
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Add simple one-way relationships
    shift = relationship("ShiftTemplate")
    employee = relationship("Employee", back_populates="schedule_entries")

    def __init__(
        self,
        employee_id,
        shift_id,
        date,
        version=1,
        break_start=None,
        break_end=None,
        notes=None,
    ):
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.date = date
        self.version = version
        self.break_start = break_start
        self.break_end = break_end
        self.notes = notes

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "shift_id": self.shift_id,
            "date": self.date.isoformat(),
            "version": self.version,
            "break_start": self.break_start,
            "break_end": self.break_end,
            "notes": self.notes,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Schedule {self.id}: Employee {self.employee_id} on {self.date}>"
