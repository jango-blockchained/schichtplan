from datetime import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime, Float, Boolean
from . import db
from typing import Dict, Any, Optional
import json

class Settings(db.Model):
    __tablename__ = 'settings'

    id = Column(Integer, primary_key=True)
    
    # General Settings
    store_name = Column(String(100), nullable=False, default='ShiftWise Store')
    store_address = Column(String(200))
    store_contact = Column(String(100))
    timezone = Column(String(50), nullable=False, default='Europe/Berlin')
    language = Column(String(10), nullable=False, default='de')
    date_format = Column(String(20), nullable=False, default='DD.MM.YYYY')
    time_format = Column(String(10), nullable=False, default='24h')
    
    # Scheduling Settings
    default_shift_duration = Column(Float, nullable=False, default=8.0)
    min_break_duration = Column(Integer, nullable=False, default=30)
    max_daily_hours = Column(Float, nullable=False, default=10.0)
    max_weekly_hours = Column(Float, nullable=False, default=40.0)
    min_rest_between_shifts = Column(Float, nullable=False, default=11.0)
    scheduling_period_weeks = Column(Integer, nullable=False, default=4)
    auto_schedule_preferences = Column(Boolean, nullable=False, default=True)
    
    # Display Settings
    theme = Column(String(20), nullable=False, default='light')
    primary_color = Column(String(7), nullable=False, default='#1976D2')
    secondary_color = Column(String(7), nullable=False, default='#424242')
    show_weekends = Column(Boolean, nullable=False, default=True)
    start_of_week = Column(Integer, nullable=False, default=1)  # 1 = Monday
    
    # Notification Settings
    email_notifications = Column(Boolean, nullable=False, default=True)
    schedule_published_notify = Column(Boolean, nullable=False, default=True)
    shift_changes_notify = Column(Boolean, nullable=False, default=True)
    time_off_requests_notify = Column(Boolean, nullable=False, default=True)
    
    # PDF Layout Settings
    page_size = Column(String(10), nullable=False, default='A4')
    orientation = Column(String(10), nullable=False, default='portrait')
    margin_top = Column(Float, nullable=False, default=20.0)
    margin_right = Column(Float, nullable=False, default=20.0)
    margin_bottom = Column(Float, nullable=False, default=20.0)
    margin_left = Column(Float, nullable=False, default=20.0)
    table_header_bg_color = Column(String(7), nullable=False, default='#f3f4f6')
    table_border_color = Column(String(7), nullable=False, default='#e5e7eb')
    table_text_color = Column(String(7), nullable=False, default='#111827')
    table_header_text_color = Column(String(7), nullable=False, default='#111827')
    font_family = Column(String(50), nullable=False, default='Helvetica')
    font_size = Column(Float, nullable=False, default=10.0)
    header_font_size = Column(Float, nullable=False, default=12.0)
    show_employee_id = Column(Boolean, nullable=False, default=True)
    show_position = Column(Boolean, nullable=False, default=True)
    show_breaks = Column(Boolean, nullable=False, default=True)
    show_total_hours = Column(Boolean, nullable=False, default=True)
    
    # Employee Group Settings
    shift_types = Column(JSON, nullable=False, default=lambda: [
        {'id': 'early', 'name': 'Früh', 'start_time': '06:00', 'end_time': '14:00', 'color': '#4CAF50'},
        {'id': 'middle', 'name': 'Mittel', 'start_time': '10:00', 'end_time': '18:00', 'color': '#2196F3'},
        {'id': 'late', 'name': 'Spät', 'start_time': '14:00', 'end_time': '22:00', 'color': '#9C27B0'}
    ])
    
    employee_types = Column(JSON, nullable=False, default=lambda: [
        {'id': 'full_time', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 40},
        {'id': 'part_time', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
        {'id': 'mini_job', 'name': 'Minijob', 'min_hours': 0, 'max_hours': 14}
    ])
    
    absence_types = Column(JSON, nullable=False, default=lambda: [
        {'id': 'vacation', 'name': 'Urlaub', 'color': '#FF9800', 'paid': True},
        {'id': 'sick', 'name': 'Krank', 'color': '#F44336', 'paid': True},
        {'id': 'unpaid', 'name': 'Unbezahlt', 'color': '#9E9E9E', 'paid': False}
    ])
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert settings to dictionary format"""
        return {
            'general': {
                'store_name': self.store_name,
                'store_address': self.store_address,
                'store_contact': self.store_contact,
                'timezone': self.timezone,
                'language': self.language,
                'date_format': self.date_format,
                'time_format': self.time_format
            },
            'scheduling': {
                'default_shift_duration': self.default_shift_duration,
                'min_break_duration': self.min_break_duration,
                'max_daily_hours': self.max_daily_hours,
                'max_weekly_hours': self.max_weekly_hours,
                'min_rest_between_shifts': self.min_rest_between_shifts,
                'scheduling_period_weeks': self.scheduling_period_weeks,
                'auto_schedule_preferences': self.auto_schedule_preferences
            },
            'display': {
                'theme': self.theme,
                'primary_color': self.primary_color,
                'secondary_color': self.secondary_color,
                'show_weekends': self.show_weekends,
                'start_of_week': self.start_of_week
            },
            'notifications': {
                'email_notifications': self.email_notifications,
                'schedule_published': self.schedule_published_notify,
                'shift_changes': self.shift_changes_notify,
                'time_off_requests': self.time_off_requests_notify
            },
            'pdf_layout': {
                'page_size': self.page_size,
                'orientation': self.orientation,
                'margins': {
                    'top': self.margin_top,
                    'right': self.margin_right,
                    'bottom': self.margin_bottom,
                    'left': self.margin_left
                },
                'table_style': {
                    'header_bg_color': self.table_header_bg_color,
                    'border_color': self.table_border_color,
                    'text_color': self.table_text_color,
                    'header_text_color': self.table_header_text_color
                },
                'fonts': {
                    'family': self.font_family,
                    'size': self.font_size,
                    'header_size': self.header_font_size
                },
                'content': {
                    'show_employee_id': self.show_employee_id,
                    'show_position': self.show_position,
                    'show_breaks': self.show_breaks,
                    'show_total_hours': self.show_total_hours
                }
            },
            'employee_groups': {
                'shift_types': self.shift_types,
                'employee_types': self.employee_types,
                'absence_types': self.absence_types
            }
        }

    @classmethod
    def get_default_settings(cls) -> 'Settings':
        """Create and return default settings"""
        return cls()

    def update_from_dict(self, data: Dict[str, Any]) -> None:
        """Update settings from dictionary data"""
        for category, values in data.items():
            if category == 'general':
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)
            elif category == 'scheduling':
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)
            elif category == 'display':
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)
            elif category == 'notifications':
                for key, value in values.items():
                    attr_name = f"{key}_notify" if key != 'email_notifications' else key
                    if hasattr(self, attr_name):
                        setattr(self, attr_name, value)
            elif category == 'pdf_layout':
                if 'margins' in values:
                    for key, value in values['margins'].items():
                        attr_name = f"margin_{key}"
                        if hasattr(self, attr_name):
                            setattr(self, attr_name, value)
                if 'table_style' in values:
                    for key, value in values['table_style'].items():
                        attr_name = f"table_{key}"
                        if hasattr(self, attr_name):
                            setattr(self, attr_name, value)
                if 'fonts' in values:
                    for key, value in values['fonts'].items():
                        if key == 'family':
                            self.font_family = value
                        elif key == 'size':
                            self.font_size = value
                        elif key == 'header_size':
                            self.header_font_size = value
                if 'content' in values:
                    for key, value in values['content'].items():
                        if hasattr(self, f"show_{key}"):
                            setattr(self, f"show_{key}", value)
            elif category == 'employee_groups':
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)

    def __repr__(self):
        return f"<Settings {self.store_name}>"

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