from datetime import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime
from . import db
from typing import Dict, Any, Optional
import json

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

    @classmethod
    def get_pdf_layout_config(cls) -> Dict[str, Any]:
        """Get PDF layout configuration"""
        settings = cls.query.filter_by(category='pdf_layout').all()
        config = {}
        for setting in settings:
            config[setting.key] = setting.value
        return config or cls.get_default_pdf_layout()

    @classmethod
    def get_default_pdf_layout(cls) -> Dict[str, Any]:
        """Get default PDF layout configuration"""
        return {
            'table': {
                'column_widths': [1.5, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2],  # in inches
                'style': {
                    'alignment': 'center',
                    'valign': 'middle',
                    'grid': True,
                    'header_background': '#808080',
                    'header_text_color': '#F5F5F5',
                    'header_font': 'Helvetica-Bold',
                    'header_font_size': 12,
                    'row_font': 'Helvetica',
                    'row_font_size': 10,
                    'leading': 14,
                    'alternating_row_color': '#F9FAFB'
                }
            },
            'title': {
                'font': 'Helvetica-Bold',
                'size': 16,
                'color': '#000000',
                'alignment': 'center',
                'spacing': 30
            },
            'margins': {
                'right': 30,
                'left': 30,
                'top': 30,
                'bottom': 30
            },
            'page': {
                'size': 'A4',
                'orientation': 'landscape'
            }
        }

    @classmethod
    def save_pdf_layout_config(cls, config: Dict[str, Any]) -> None:
        """Save PDF layout configuration"""
        for key, value in config.items():
            setting = cls.query.filter_by(category='pdf_layout', key=key).first()
            if setting:
                setting.value = value
            else:
                setting = cls(category='pdf_layout', key=key, value=value)
                db.session.add(setting)
        db.session.commit()

    @classmethod
    def get_pdf_layout_presets(cls) -> Dict[str, Dict[str, Any]]:
        """Get PDF layout presets"""
        setting = cls.query.filter_by(category='pdf_layout_presets', key='presets').first()
        if setting:
            return setting.value
        return cls.get_default_pdf_presets()

    @classmethod
    def get_default_pdf_presets(cls) -> Dict[str, Dict[str, Any]]:
        """Get default PDF layout presets"""
        return {
            'Classic': cls.get_default_pdf_layout(),
            'Modern': {
                'table': {
                    'column_widths': [2.0, 1.0, 1.0, 1.2, 1.2, 1.2, 1.2],
                    'style': {
                        'alignment': 'left',
                        'valign': 'middle',
                        'grid': False,
                        'header_background': '#1E293B',
                        'header_text_color': '#FFFFFF',
                        'header_font': 'Helvetica-Bold',
                        'header_font_size': 14,
                        'row_font': 'Helvetica',
                        'row_font_size': 11,
                        'leading': 16,
                        'alternating_row_color': '#F8FAFC'
                    }
                },
                'title': {
                    'font': 'Helvetica-Bold',
                    'size': 20,
                    'color': '#1E293B',
                    'alignment': 'left',
                    'spacing': 40
                },
                'margins': {
                    'right': 40,
                    'left': 40,
                    'top': 40,
                    'bottom': 40
                },
                'page': {
                    'size': 'A4',
                    'orientation': 'landscape'
                }
            },
            'Compact': {
                'table': {
                    'column_widths': [1.2, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                    'style': {
                        'alignment': 'center',
                        'valign': 'middle',
                        'grid': True,
                        'header_background': '#374151',
                        'header_text_color': '#FFFFFF',
                        'header_font': 'Helvetica-Bold',
                        'header_font_size': 10,
                        'row_font': 'Helvetica',
                        'row_font_size': 9,
                        'leading': 12,
                        'alternating_row_color': '#F3F4F6'
                    }
                },
                'title': {
                    'font': 'Helvetica-Bold',
                    'size': 14,
                    'color': '#374151',
                    'alignment': 'center',
                    'spacing': 20
                },
                'margins': {
                    'right': 20,
                    'left': 20,
                    'top': 20,
                    'bottom': 20
                },
                'page': {
                    'size': 'A4',
                    'orientation': 'landscape'
                }
            }
        }

    @classmethod
    def save_pdf_layout_preset(cls, name: str, config: Dict[str, Any]) -> None:
        """Save a new PDF layout preset"""
        presets = cls.get_pdf_layout_presets()
        presets[name] = config
        setting = cls.query.filter_by(category='pdf_layout_presets', key='presets').first()
        if setting:
            setting.value = presets
        else:
            setting = cls(category='pdf_layout_presets', key='presets', value=presets)
            db.session.add(setting)
        db.session.commit()

    @classmethod
    def delete_pdf_layout_preset(cls, name: str) -> bool:
        """Delete a PDF layout preset"""
        if name in ['Classic', 'Modern', 'Compact']:
            return False  # Cannot delete default presets
        presets = cls.get_pdf_layout_presets()
        if name in presets:
            del presets[name]
            setting = cls.query.filter_by(category='pdf_layout_presets', key='presets').first()
            if setting:
                setting.value = presets
                db.session.commit()
            return True
        return False 