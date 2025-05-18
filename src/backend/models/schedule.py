from . import db
from datetime import datetime, UTC
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from enum import Enum

# Import AvailabilityType from employee model
from .employee import AvailabilityType


class ScheduleStatus(str, Enum):
    DRAFT = "DRAFT"  # Initial state, can be modified
    PUBLISHED = "PUBLISHED"  # Published to employees, can't be modified
    ARCHIVED = "ARCHIVED"  # Old schedule, kept for records
    PENDING = "PENDING"  # Added to fix version 1 database records


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
    shift_type = Column(db.String(20), nullable=True)
    availability_type = Column(
        SQLEnum(AvailabilityType), nullable=True, default=AvailabilityType.AVAILABLE
    )  # AVAILABLE, FIXED, PREFERRED, UNAVAILABLE
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
        shift_type=None,
        availability_type=AvailabilityType.AVAILABLE,
        status=ScheduleStatus.DRAFT,
    ):
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.date = date
        self.version = version
        self.break_start = break_start
        self.break_end = break_end
        self.notes = notes
        self.shift_type = shift_type
        self.availability_type = availability_type.value if isinstance(availability_type, AvailabilityType) else availability_type
        self.status = status

    def to_dict(self):
        """Convert schedule to dictionary for API response"""
        from .fixed_shift import ShiftTemplate  # Import here to avoid circular imports
        
        data = {
            "id": self.id,
            "employee_id": self.employee_id,
            "shift_id": self.shift_id,
            "date": self.date.isoformat() if self.date is not None else None,
            "version": self.version,
            "break_start": self.break_start,
            "break_end": self.break_end,
            "notes": self.notes,
            "shift_type": self.shift_type,
            "availability_type": self.availability_type.value if isinstance(self.availability_type, AvailabilityType) else self.availability_type,
            "status": self.status.value if self.status is not None else "DRAFT",
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }

        # Add shift details if available through relationship
        if hasattr(self, 'shift') and self.shift:
            data.update(
                {
                    "shift_start": self.shift.start_time,
                    "shift_end": self.shift.end_time,
                    "duration_hours": self.shift.duration_hours
                    if hasattr(self.shift, "duration_hours")
                    else 0.0,
                    "shift_type_id": self.shift.shift_type_id,
                    "shift_type_name": self.shift.shift_type.value
                    if self.shift.shift_type
                    else None,
                }
            )
        # If no relationship but we have a shift_id, fetch the shift data
        elif self.shift_id is not None:
            try:
                # Try to get the shift directly from the database
                shift = db.session.get(ShiftTemplate, self.shift_id)
                if shift:
                    data.update(
                        {
                            "shift_start": shift.start_time,
                            "shift_end": shift.end_time,
                            "duration_hours": shift.duration_hours
                            if hasattr(shift, "duration_hours")
                            else 0.0,
                            "shift_type_id": shift.shift_type_id,
                            "shift_type_name": shift.shift_type.value
                            if shift.shift_type
                            else None,
                        }
                    )
            except Exception as e:
                # Log the error but don't fail the whole response
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error fetching shift data for schedule {self.id}: {e}")

        # Add employee name if available (for convenience)
        if hasattr(self, "employee") and self.employee:
            data["employee_name"] = (
                f"{self.employee.first_name} {self.employee.last_name}"
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

    def __init__(
        self,
        version,
        created_at=None,
        created_by=None,
        updated_at=None,
        updated_by=None,
        status=ScheduleStatus.DRAFT,
        date_range_start=None,
        date_range_end=None,
        base_version=None,
        notes=None,
    ):
        self.version = version
        self.created_at = created_at or datetime.now(UTC)
        self.created_by = created_by
        self.updated_at = updated_at
        self.updated_by = updated_by
        self.status = status
        self.date_range_start = date_range_start
        self.date_range_end = date_range_end
        self.base_version = base_version
        self.notes = notes

    def to_dict(self):
        return {
            "version": self.version,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "created_by": self.created_by,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
            "updated_by": self.updated_by,
            "status": self.status.value,
            "date_range": {
                "start": self.date_range_start.isoformat()
                if self.date_range_start is not None
                else None,
                "end": self.date_range_end.isoformat() if self.date_range_end is not None else None,
            },
            "base_version": self.base_version,
            "notes": self.notes,
        }
