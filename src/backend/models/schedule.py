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

    # Add relationships with eager loading
    shift = relationship("ShiftTemplate", lazy="joined", innerjoin=False)
    employee = relationship(
        "Employee", back_populates="schedule_entries", lazy="joined"
    )

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
        """Convert schedule to dictionary with shift details"""
        data = {
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

        # Add shift details if available
        if self.shift:
            data.update(
                {
                    "shift_start": self.shift.start_time,
                    "shift_end": self.shift.end_time,
                    "duration_hours": self.shift.duration_hours
                    if hasattr(self.shift, "duration_hours")
                    else None,
                    "is_empty": False,
                }
            )
        else:
            data.update(
                {
                    "shift_start": None,
                    "shift_end": None,
                    "duration_hours": 0.0,
                    "is_empty": True,
                }
            )

        return data

    def __repr__(self):
        return f"<Schedule {self.id}: Employee {self.employee_id} on {self.date}>"


class ScheduleVersionMeta(db.Model):
    """Store metadata for schedule versions"""

    __tablename__ = "schedule_version_meta"

    version = Column(Integer, primary_key=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(
        Integer, nullable=True
    )  # ForeignKey to users could be added later
    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(
        Integer, nullable=True
    )  # ForeignKey to users could be added later
    status = Column(
        SQLEnum(ScheduleStatus), nullable=False, default=ScheduleStatus.DRAFT
    )
    date_range_start = Column(db.Date, nullable=False)
    date_range_end = Column(db.Date, nullable=False)
    base_version = Column(Integer, nullable=True)
    notes = Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "version": self.version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by": self.created_by,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updated_by": self.updated_by,
            "status": self.status.value,
            "date_range": {
                "start": self.date_range_start.isoformat()
                if self.date_range_start
                else None,
                "end": self.date_range_end.isoformat() if self.date_range_end else None,
            },
            "base_version": self.base_version,
            "notes": self.notes,
        }
