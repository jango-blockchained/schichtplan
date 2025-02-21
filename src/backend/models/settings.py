from datetime import datetime, time
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
    store_opening = Column(String(5), nullable=False, default='09:00')
    store_closing = Column(String(5), nullable=False, default='20:00')
    keyholder_before_minutes = Column(Integer, nullable=False, default=30)  # Time before store opening
    keyholder_after_minutes = Column(Integer, nullable=False, default=30)   # Time after store closing
    
    # Store Opening Days and Hours
    opening_days = Column(JSON, nullable=False, default=lambda: {
        "0": False,  # Sunday
        "1": True,   # Monday
        "2": True,   # Tuesday
        "3": True,   # Wednesday
        "4": True,   # Thursday
        "5": True,   # Friday
        "6": True    # Saturday
    })
    
    # Special Opening Hours (overrides default hours)
    # Format: {"YYYY-MM-DD": {"is_closed": bool, "opening": "HH:MM", "closing": "HH:MM"}}
    special_hours = Column(JSON, nullable=False, default=dict)
    
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
    primary_color = Column(String(7), nullable=False, default='#1976D2')  # Blue
    secondary_color = Column(String(7), nullable=False, default='#424242')  # Gray
    accent_color = Column(String(7), nullable=False, default='#FF4081')  # Pink
    background_color = Column(String(7), nullable=False, default='#FFFFFF')  # White
    surface_color = Column(String(7), nullable=False, default='#F5F5F5')  # Light Gray
    text_color = Column(String(7), nullable=False, default='#212121')  # Dark Gray
    dark_theme_primary_color = Column(String(7), nullable=False, default='#90CAF9')  # Light Blue
    dark_theme_secondary_color = Column(String(7), nullable=False, default='#757575')  # Light Gray
    dark_theme_accent_color = Column(String(7), nullable=False, default='#FF80AB')  # Light Pink
    dark_theme_background_color = Column(String(7), nullable=False, default='#121212')  # Dark Gray
    dark_theme_surface_color = Column(String(7), nullable=False, default='#1E1E1E')  # Slightly lighter Dark Gray
    dark_theme_text_color = Column(String(7), nullable=False, default='#FFFFFF')  # White
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
    employee_types = Column(JSON, nullable=False, default=lambda: [
        {'id': 'full_time', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 40},
        {'id': 'part_time', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
        {'id': 'mini_job', 'name': 'Minijob', 'min_hours': 0, 'max_hours': 14}
    ])
    
    absence_types = Column(JSON, nullable=False, default=lambda: [
        {'id': 'vacation', 'name': 'Urlaub', 'color': '#FF9800'},
        {'id': 'sick', 'name': 'Krank', 'color': '#F44336'},
        {'id': 'unpaid', 'name': 'Unbezahlt', 'color': '#9E9E9E'}
    ])
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def is_store_open(self, date: datetime) -> bool:
        """Check if store is open on a specific date"""
        date_str = date.strftime('%Y-%m-%d')
        
        # Check special hours first
        if date_str in self.special_hours:
            return not self.special_hours[date_str].get('is_closed', False)
            
        # Check regular opening days
        weekday = str(date.weekday())
        return self.opening_days.get(weekday, False)

    def get_store_hours(self, date: datetime) -> tuple[str, str]:
        """Get store opening and closing hours for a specific date"""
        date_str = date.strftime('%Y-%m-%d')
        
        # Check special hours first
        if date_str in self.special_hours and not self.special_hours[date_str].get('is_closed', False):
            special = self.special_hours[date_str]
            return special.get('opening', self.store_opening), special.get('closing', self.store_closing)
            
        return self.store_opening, self.store_closing

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
                'time_format': self.time_format,
                'store_opening': self.store_opening,
                'store_closing': self.store_closing,
                'opening_days': self.opening_days,
                'special_hours': self.special_hours
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
                'accent_color': self.accent_color,
                'background_color': self.background_color,
                'surface_color': self.surface_color,
                'text_color': self.text_color,
                'dark_theme': {
                    'primary_color': self.dark_theme_primary_color,
                    'secondary_color': self.dark_theme_secondary_color,
                    'accent_color': self.dark_theme_accent_color,
                    'background_color': self.dark_theme_background_color,
                    'surface_color': self.dark_theme_surface_color,
                    'text_color': self.dark_theme_text_color
                },
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
                'employee_types': self.employee_types,
                'absence_types': self.absence_types
            }
        }

    @classmethod
    def get_default_settings(cls) -> 'Settings':
        """Create and return default settings"""
        settings = cls()
        settings.store_name = 'ShiftWise Store'
        settings.store_address = ''
        settings.store_contact = ''
        settings.timezone = 'Europe/Berlin'
        settings.language = 'de'
        settings.date_format = 'DD.MM.YYYY'
        settings.time_format = '24h'
        
        # Scheduling Settings
        settings.default_shift_duration = 8.0
        settings.min_break_duration = 30
        settings.max_daily_hours = 10.0
        settings.max_weekly_hours = 40.0
        settings.min_rest_between_shifts = 11.0
        settings.scheduling_period_weeks = 4
        settings.auto_schedule_preferences = True
        
        # Display Settings
        settings.theme = 'light'
        settings.primary_color = '#1976D2'  # Blue
        settings.secondary_color = '#424242'  # Gray
        settings.accent_color = '#FF4081'  # Pink
        settings.background_color = '#FFFFFF'  # White
        settings.surface_color = '#F5F5F5'  # Light Gray
        settings.text_color = '#212121'  # Dark Gray
        settings.dark_theme_primary_color = '#90CAF9'  # Light Blue
        settings.dark_theme_secondary_color = '#757575'  # Light Gray
        settings.dark_theme_accent_color = '#FF80AB'  # Light Pink
        settings.dark_theme_background_color = '#121212'  # Dark Gray
        settings.dark_theme_surface_color = '#1E1E1E'  # Slightly lighter Dark Gray
        settings.dark_theme_text_color = '#FFFFFF'  # White
        settings.show_weekends = True
        settings.start_of_week = 1
        
        # Notification Settings
        settings.email_notifications = True
        settings.schedule_published_notify = True
        settings.shift_changes_notify = True
        settings.time_off_requests_notify = True
        
        # PDF Layout Settings
        settings.page_size = 'A4'
        settings.orientation = 'portrait'
        settings.margin_top = 20.0
        settings.margin_right = 20.0
        settings.margin_bottom = 20.0
        settings.margin_left = 20.0
        settings.table_header_bg_color = '#f3f4f6'
        settings.table_border_color = '#e5e7eb'
        settings.table_text_color = '#111827'
        settings.table_header_text_color = '#111827'
        settings.font_family = 'Helvetica'
        settings.font_size = 10.0
        settings.header_font_size = 12.0
        settings.show_employee_id = True
        settings.show_position = True
        settings.show_breaks = True
        settings.show_total_hours = True
        
        # Employee Group Settings
        settings.employee_types = [
            {'id': 'full_time', 'name': 'Vollzeit', 'min_hours': 35, 'max_hours': 40},
            {'id': 'part_time', 'name': 'Teilzeit', 'min_hours': 15, 'max_hours': 34},
            {'id': 'mini_job', 'name': 'Minijob', 'min_hours': 0, 'max_hours': 14}
        ]
        
        settings.absence_types = [
            {'id': 'vacation', 'name': 'Urlaub', 'color': '#FF9800'},
            {'id': 'sick', 'name': 'Krank', 'color': '#F44336'},
            {'id': 'unpaid', 'name': 'Unbezahlt', 'color': '#9E9E9E'}
        ]
        
        return settings

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
                # Handle page size and orientation directly
                if 'page_size' in values:
                    self.page_size = values['page_size']
                if 'orientation' in values:
                    self.orientation = values['orientation']
                
                # Handle margins
                if 'margins' in values:
                    for key, value in values['margins'].items():
                        attr_name = f"margin_{key}"
                        if hasattr(self, attr_name):
                            setattr(self, attr_name, value)
                
                # Handle table style
                if 'table_style' in values:
                    table_style = values['table_style']
                    if 'header_bg_color' in table_style:
                        self.table_header_bg_color = table_style['header_bg_color']
                    if 'border_color' in table_style:
                        self.table_border_color = table_style['border_color']
                    if 'text_color' in table_style:
                        self.table_text_color = table_style['text_color']
                    if 'header_text_color' in table_style:
                        self.table_header_text_color = table_style['header_text_color']
                
                # Handle fonts
                if 'fonts' in values:
                    fonts = values['fonts']
                    if 'family' in fonts:
                        self.font_family = fonts['family']
                    if 'size' in fonts:
                        self.font_size = fonts['size']
                    if 'header_size' in fonts:
                        self.header_font_size = fonts['header_size']
                
                # Handle content visibility
                if 'content' in values:
                    content = values['content']
                    if 'show_employee_id' in content:
                        self.show_employee_id = content['show_employee_id']
                    if 'show_position' in content:
                        self.show_position = content['show_position']
                    if 'show_breaks' in content:
                        self.show_breaks = content['show_breaks']
                    if 'show_total_hours' in content:
                        self.show_total_hours = content['show_total_hours']
            
            elif category == 'employee_groups':
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)

    def __repr__(self):
        return f"<Settings {self.store_name}>"

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