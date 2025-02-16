from datetime import datetime
from . import db
from sqlalchemy.dialects.postgresql import ARRAY
from .shift import ShiftType

class ShiftTemplate(db.Model):
    """Model for shift templates"""
    __tablename__ = 'shift_templates'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with shift template entries
    shifts = db.relationship('ShiftTemplateEntry', backref='template', lazy=True, cascade='all, delete-orphan')

    def __init__(self, name, shifts, description=None, is_active=True, is_default=False):
        self.name = name
        self.shifts = shifts
        self.description = description
        self.is_active = is_active
        self.is_default = is_default

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'is_default': self.is_default,
            'shifts': [shift.to_dict() for shift in self.shifts],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def create_default_template(cls):
        """Create the default shift template"""
        default_shifts = [
            ShiftTemplateEntry(
                shift_type=ShiftType.EARLY.value,
                start_time='08:55',
                end_time='17:00',
                min_employees=2,
                max_employees=5,
                days='MO,TU,WE,TH,FR,SA'
            ),
            ShiftTemplateEntry(
                shift_type=ShiftType.MIDDLE.value,
                start_time='11:00',
                end_time='19:00',
                min_employees=2,
                max_employees=5,
                days='MO,TU,WE,TH,FR,SA'
            ),
            ShiftTemplateEntry(
                shift_type=ShiftType.LATE.value,
                start_time='13:00',
                end_time='20:10',
                min_employees=2,
                max_employees=4,
                days='MO,TU,WE,TH,FR,SA'
            )
        ]

        return cls(
            name="Standard Shift Template",
            description="Default template with early, middle, and late shifts",
            shifts=default_shifts,
            is_default=True
        )

    def __repr__(self):
        return f"<ShiftTemplate {self.name}>"

class ShiftTemplateEntry(db.Model):
    """Model for individual shift entries in a template"""
    __tablename__ = 'shift_template_entries'

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('shift_templates.id'), nullable=False)
    shift_type = db.Column(db.String(50), nullable=False)  # 'Frühschicht', 'Mittelschicht', 'Spätschicht'
    start_time = db.Column(db.String(5), nullable=False)  # Format: "HH:MM"
    end_time = db.Column(db.String(5), nullable=False)    # Format: "HH:MM"
    min_employees = db.Column(db.Integer, nullable=False)
    max_employees = db.Column(db.Integer, nullable=False)
    days = db.Column(db.String(20), nullable=False)  # Comma-separated days: 'MO,TU,WE,TH,FR,SA'

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            'shift_type': self.shift_type,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'min_employees': self.min_employees,
            'max_employees': self.max_employees,
            'days': self.days.split(',') if self.days else []
        }

    @staticmethod
    def from_dict(data):
        """Create model from dictionary"""
        if 'days' in data and isinstance(data['days'], list):
            data = data.copy()
            data['days'] = ','.join(data['days'])
        return ShiftTemplateEntry(**data)

    def __repr__(self):
        return f"<ShiftTemplateEntry {self.shift_type}>" 