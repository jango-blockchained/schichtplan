from . import db
from datetime import datetime, time
from typing import Dict, Any


class Schedule(db.Model):
    __tablename__ = "schedules"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    shift_id = db.Column(
        db.Integer, db.ForeignKey("shifts.id"), nullable=True
    )  # Make nullable
    date = db.Column(db.Date, nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    break_start = db.Column(db.String(5), nullable=True)  # Format: "HH:MM"
    break_end = db.Column(db.String(5), nullable=True)  # Format: "HH:MM"
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    employee = db.relationship("Employee", back_populates="shifts")
    shift = db.relationship("ShiftTemplate", back_populates="schedules")

    def __init__(
        self,
        date,
        employee_id,
        shift_id=None,
        break_start=None,
        break_end=None,
        version=1,
    ):
        self.date = date
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.break_start = break_start
        self.break_end = break_end
        self.version = version

    def set_break(self, start_time: time, duration_minutes: int = 60):
        """Set break time for the shift"""
        self.break_start = start_time
        hours = duration_minutes // 60
        minutes = duration_minutes % 60
        end_hour = start_time.hour + hours
        end_minute = start_time.minute + minutes

        if end_minute >= 60:
            end_hour += 1
            end_minute -= 60

        self.break_end = time(end_hour, end_minute)

    @property
    def break_duration_minutes(self):
        """Calculate break duration in minutes"""
        if not self.break_start or not self.break_end:
            return 0

        break_start_minutes = self.break_start.hour * 60 + self.break_start.minute
        break_end_minutes = self.break_end.hour * 60 + self.break_end.minute
        return break_end_minutes - break_start_minutes

    def __repr__(self):
        return f"<Schedule {self.date}: Employee {self.employee_id} - Shift {self.shift_id}>"

    def to_dict(self) -> Dict[str, Any]:
        """Convert schedule to dictionary"""
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name}"
            if self.employee
            else None,
            "shift_id": self.shift_id,
            "shift_start": self.shift.start_time if self.shift else None,
            "shift_end": self.shift.end_time if self.shift else None,
            "date": self.date.strftime("%Y-%m-%d"),
            "version": self.version,
            "break_start": self.break_start,
            "break_end": self.break_end,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @classmethod
    def get_latest_version(
        cls, date_range_start: datetime.date, date_range_end: datetime.date
    ) -> int:
        """Get the latest version number for a date range"""
        result = (
            db.session.query(db.func.max(cls.version))
            .filter(cls.date >= date_range_start, cls.date <= date_range_end)
            .scalar()
        )
        return result or 0
