from . import db
from datetime import datetime, time

class Schedule(db.Model):
    __tablename__ = 'schedules'

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    shift_id = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=False)
    break_start = db.Column(db.String(5), nullable=True)  # Format: "HH:MM"
    break_end = db.Column(db.String(5), nullable=True)    # Format: "HH:MM"
    notes = db.Column(db.String(200), nullable=True)      # For additional break info and other notes
    
    # Relationships
    employee = db.relationship('Employee', back_populates='shifts')
    shift = db.relationship('Shift', back_populates='schedules')

    def __init__(self, date, employee_id, shift_id, break_start=None, break_end=None):
        self.date = date
        self.employee_id = employee_id
        self.shift_id = shift_id
        self.break_start = break_start
        self.break_end = break_end

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
            'break_end': self.break_end,
            'notes': self.notes
        } 