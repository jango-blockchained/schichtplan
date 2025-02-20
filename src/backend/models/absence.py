from . import db
from datetime import datetime

class Absence(db.Model):
    __tablename__ = 'absences'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    absence_type_id = db.Column(db.String(50), nullable=False)  # References an ID in settings.absence_types JSON array
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    note = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = db.relationship('Employee', backref=db.backref('absences', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'absence_type_id': self.absence_type_id,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @staticmethod
    def from_dict(data):
        return Absence(
            employee_id=data.get('employee_id'),
            absence_type_id=data.get('absence_type_id'),
            start_date=datetime.strptime(data.get('start_date'), '%Y-%m-%d').date(),
            end_date=datetime.strptime(data.get('end_date'), '%Y-%m-%d').date(),
            note=data.get('note')
        ) 