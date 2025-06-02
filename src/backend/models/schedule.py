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
    ASSIGNED = "ASSIGNED"  # Legacy status for assigned schedules (treated as DRAFT)


class Schedule(db.Model):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)  # Reference to template
    date = Column(DateTime, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    
    # Independent shift timing fields (copied from template but can be modified)
    shift_start = Column(db.String(5), nullable=True)  # Format: "HH:MM"
    shift_end = Column(db.String(5), nullable=True)    # Format: "HH:MM"
    duration_hours = Column(db.Float, nullable=True)
    requires_break = Column(db.Boolean, nullable=True, default=False)
    shift_type_id = Column(db.String(50), nullable=True)  # EARLY, MIDDLE, LATE
    
    # Break timing fields
    break_start = Column(db.String(5), nullable=True)
    break_end = Column(db.String(5), nullable=True)
    break_duration = Column(db.Integer, nullable=True)  # Duration in minutes
    
    notes = Column(db.Text, nullable=True)
    shift_type = Column(db.String(20), nullable=True)  # Legacy field, keep for compatibility
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
        shift_start=None,
        shift_end=None,
        duration_hours=None,
        requires_break=None,
        shift_type_id=None,
        break_start=None,
        break_end=None,
        break_duration=None,
        notes=None,
        shift_type=None,
        availability_type=AvailabilityType.AVAILABLE,
        status=ScheduleStatus.DRAFT,
    ):
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.date = date
        self.version = version
        
        # Independent shift timing fields
        self.shift_start = shift_start
        self.shift_end = shift_end
        self.duration_hours = duration_hours
        self.requires_break = requires_break
        self.shift_type_id = shift_type_id
        
        # Break timing fields
        self.break_start = break_start
        self.break_end = break_end
        self.break_duration = break_duration
        
        self.notes = notes
        self.shift_type = shift_type  # Legacy field
        self.availability_type = (
            availability_type.value
            if isinstance(availability_type, AvailabilityType)
            else availability_type
        )
        self.status = status
        
        # If shift_id is provided but timing fields are not, copy from template
        if shift_id and not shift_start:
            self._copy_from_template()

    def _copy_from_template(self):
        """Copy timing data from the shift template to make this assignment independent"""
        if not self.shift_id:
            return
            
        try:
            from .fixed_shift import ShiftTemplate
            template = db.session.get(ShiftTemplate, self.shift_id)
            if template:
                self.shift_start = template.start_time
                self.shift_end = template.end_time
                self.duration_hours = template.duration_hours
                self.requires_break = template.requires_break
                self.shift_type_id = template.shift_type_id
                
                # Calculate break duration if break times are set
                if self.break_start and self.break_end:
                    self._calculate_break_duration()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error copying from template for schedule {self.id}: {e}")

    def _calculate_break_duration(self):
        """Calculate break duration in minutes from break_start and break_end"""
        if not self.break_start or not self.break_end:
            self.break_duration = None
            return
            
        try:
            start_hour, start_min = map(int, self.break_start.split(":"))
            end_hour, end_min = map(int, self.break_end.split(":"))
            
            start_minutes = start_hour * 60 + start_min
            end_minutes = end_hour * 60 + end_min
            
            # Handle breaks that cross midnight
            if end_minutes < start_minutes:
                end_minutes += 24 * 60
                
            self.break_duration = end_minutes - start_minutes
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error calculating break duration for schedule {self.id}: {e}")
            self.break_duration = None

    def to_dict(self):
        """Convert schedule to dictionary for API response"""
        data = {
            "id": self.id,
            "employee_id": self.employee_id,
            "shift_id": self.shift_id,
            "date": self.date.isoformat() if self.date is not None else None,
            "version": self.version,
            
            # Use schedule's own timing fields (independent from template)
            "shift_start": self.shift_start,
            "shift_end": self.shift_end,
            "duration_hours": self.duration_hours,
            "requires_break": self.requires_break,
            "shift_type_id": self.shift_type_id,
            
            # Break timing fields
            "break_start": self.break_start,
            "break_end": self.break_end,
            "break_duration": self.break_duration,
            
            "notes": self.notes,
            "shift_type": self.shift_type,  # Legacy field
            "availability_type": self.availability_type.value
            if isinstance(self.availability_type, AvailabilityType)
            else self.availability_type,
            "status": self.status.value if self.status is not None else "DRAFT",
            "created_at": self.created_at.isoformat()
            if self.created_at is not None
            else None,
            "updated_at": self.updated_at.isoformat()
            if self.updated_at is not None
            else None,
        }

        # Get shift type name from template if available
        if self.shift_id and hasattr(self, "shift") and self.shift:
            data["shift_type_name"] = (
                self.shift.shift_type.value if self.shift.shift_type else None
            )
        elif self.shift_id:
            # Fallback: get shift type name from template
            try:
                from .fixed_shift import ShiftTemplate
                shift = db.session.get(ShiftTemplate, self.shift_id)
                if shift:
                    data["shift_type_name"] = (
                        shift.shift_type.value if shift.shift_type else None
                    )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error fetching shift type name for schedule {self.id}: {e}")

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
            "created_at": self.created_at.isoformat()
            if self.created_at is not None
            else None,
            "created_by": self.created_by,
            "updated_at": self.updated_at.isoformat()
            if self.updated_at is not None
            else None,
            "updated_by": self.updated_by,
            "status": self.status.value,
            "date_range": {
                "start": self.date_range_start.isoformat()
                if self.date_range_start is not None
                else None,
                "end": self.date_range_end.isoformat()
                if self.date_range_end is not None
                else None,
            },
            "base_version": self.base_version,
            "notes": self.notes,
        }
