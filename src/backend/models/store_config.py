from . import db
from datetime import time

class StoreConfig(db.Model):
    __tablename__ = 'store_config'
    
    id = db.Column(db.Integer, primary_key=True)
    store_name = db.Column(db.String(100), nullable=False)
    opening_time = db.Column(db.Time, nullable=False)
    closing_time = db.Column(db.Time, nullable=False)
    min_employees_per_shift = db.Column(db.Integer, nullable=False)
    max_employees_per_shift = db.Column(db.Integer, nullable=False)
    break_duration_minutes = db.Column(db.Integer, nullable=False)

    def __init__(self, store_name, opening_time, closing_time, min_employees_per_shift,
                 max_employees_per_shift, break_duration_minutes):
        self.store_name = store_name
        self.opening_time = opening_time
        self.closing_time = closing_time
        self.min_employees_per_shift = min_employees_per_shift
        self.max_employees_per_shift = max_employees_per_shift
        self.break_duration_minutes = break_duration_minutes

    def to_dict(self):
        """Convert store config object to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'store_name': self.store_name,
            'opening_time': self.opening_time.strftime('%H:%M') if self.opening_time else None,
            'closing_time': self.closing_time.strftime('%H:%M') if self.closing_time else None,
            'min_employees_per_shift': self.min_employees_per_shift,
            'max_employees_per_shift': self.max_employees_per_shift,
            'break_duration_minutes': self.break_duration_minutes
        }

    @classmethod
    def get_default_config(cls):
        """Create default store configuration"""
        return cls(
            store_name="ShiftWise Store",
            opening_time=time(9, 0),
            closing_time=time(20, 0),
            min_employees_per_shift=2,
            max_employees_per_shift=5,
            break_duration_minutes=60
        )

    def __repr__(self):
        return f"<StoreConfig {self.store_name}>" 