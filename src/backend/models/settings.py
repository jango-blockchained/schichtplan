from datetime import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime
from . import db

class Settings(db.Model):
    __tablename__ = 'settings'

    id = Column(Integer, primary_key=True)
    category = Column(String(50), nullable=False)
    key = Column(String(100), nullable=False)
    value = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('category', 'key', name='uix_category_key'),)

    def to_dict(self):
        return {
            'id': self.id,
            'category': self.category,
            'key': self.key,
            'value': self.value,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @staticmethod
    def get_default_settings():
        return {
            'general': {
                'company_name': '',
                'store_name': '',
                'timezone': 'Europe/Berlin',
                'language': 'de',
                'date_format': 'DD.MM.YYYY',
                'time_format': '24h'
            },
            'scheduling': {
                'default_shift_duration': 8,
                'min_break_duration': 30,
                'max_daily_hours': 10,
                'max_weekly_hours': 40,
                'min_rest_between_shifts': 11,
                'scheduling_period_weeks': 4,
                'auto_schedule_preferences': True
            },
            'notifications': {
                'email_notifications': True,
                'schedule_published': True,
                'shift_changes': True,
                'time_off_requests': True
            },
            'shift_types': [
                {'id': 'early', 'name': 'Früh', 'start_time': '06:00', 'end_time': '14:00', 'color': '#4CAF50'},
                {'id': 'middle', 'name': 'Mittel', 'start_time': '10:00', 'end_time': '18:00', 'color': '#2196F3'},
                {'id': 'late', 'name': 'Spät', 'start_time': '14:00', 'end_time': '22:00', 'color': '#9C27B0'}
            ],
            'employee_types': [
                {'id': 'full_time', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 40},
                {'id': 'part_time', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
                {'id': 'mini_job', 'name': 'Minijob', 'min_hours': 0, 'max_hours': 14}
            ],
            'absence_types': [
                {'id': 'vacation', 'name': 'Urlaub', 'color': '#FF9800', 'paid': True},
                {'id': 'sick', 'name': 'Krank', 'color': '#F44336', 'paid': True},
                {'id': 'unpaid', 'name': 'Unbezahlt', 'color': '#9E9E9E', 'paid': False}
            ],
            'display': {
                'theme': 'light',
                'primary_color': '#1976D2',
                'secondary_color': '#424242',
                'show_weekends': True,
                'start_of_week': 1
            }
        } 