from datetime import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime, Float, Boolean
from sqlalchemy.orm import deferred
from sqlalchemy.ext.hybrid import hybrid_property
from . import db
from typing import Dict, Any


class Settings(db.Model):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)

    # General Settings
    store_name = Column(String(100), nullable=False, default="TEDi Store")
    store_address = Column(String(200))
    store_contact = Column(String(100))
    timezone = Column(String(50), nullable=False, default="Europe/Berlin")
    language = Column(String(10), nullable=False, default="de")
    date_format = Column(String(20), nullable=False, default="DD.MM.YYYY")
    time_format = Column(String(10), nullable=False, default="24h")

    # Store Hours
    store_opening = Column(String(5), nullable=False, default="09:00")
    store_closing = Column(String(5), nullable=False, default="20:00")

    # PDF Layout Presets
    pdf_layout_presets = Column(JSON, nullable=True)

    # Keyholder Time Settings
    keyholder_before_minutes = Column(
        Integer, nullable=False, default=5
    )  # Time before store opening
    keyholder_after_minutes = Column(
        Integer, nullable=False, default=10
    )  # Time after store closing

    # Store Opening Days and Hours
    opening_days = Column(
        JSON,
        nullable=False,
        default=lambda: {
            "0": False,  # Sunday
            "1": True,  # Monday
            "2": True,  # Tuesday
            "3": True,  # Wednesday
            "4": True,  # Thursday
            "5": True,  # Friday
            "6": True,  # Saturday
        },
    )

    # Special Opening Hours (overrides default hours)
    # Format: {"YYYY-MM-DD": {"is_closed": bool, "opening": "HH:MM", "closing": "HH:MM"}}
    special_hours = Column(JSON, nullable=False, default=dict)

    # Availability Types
    availability_types = Column(
        JSON,
        nullable=True,
        default=lambda: {
            "types": [
                {
                    "id": "AVL",
                    "name": "Available",
                    "description": "Available for work",
                    "color": "#22c55e",
                    "priority": 2,
                    "is_available": True,
                },
                {
                    "id": "FIX",
                    "name": "Fixed",
                    "description": "Fixed working hours",
                    "color": "#3b82f6",
                    "priority": 1,
                    "is_available": True,
                },
                {
                    "id": "PRM",
                    "name": "Preferred",
                    "description": "Preferred hours",
                    "color": "#f59e0b",
                    "priority": 3,
                    "is_available": True,
                },
                {
                    "id": "UNV",
                    "name": "Unavailable",
                    "description": "Not available",
                    "color": "#ef4444",
                    "priority": 4,
                    "is_available": False,
                },
            ]
        },
    )

    # Scheduling Settings
    scheduling_resource_type = Column(
        String(20), nullable=False, default="coverage"
    )  # 'shifts' or 'coverage'
    default_shift_duration = Column(Float, nullable=False, default=8.0)
    min_break_duration = Column(Integer, nullable=False, default=30)
    max_daily_hours = Column(Float, nullable=False, default=10.0)
    max_weekly_hours = Column(Float, nullable=False, default=40.0)
    min_rest_between_shifts = Column(Float, nullable=False, default=11.0)
    scheduling_period_weeks = Column(Integer, nullable=False, default=4)
    auto_schedule_preferences = Column(Boolean, nullable=False, default=True)

    # Display and Notification Settings
    theme = Column(String(20), nullable=False, default="light")
    primary_color = Column(String(7), nullable=False, default="#1976D2")  # Blue
    secondary_color = Column(String(7), nullable=False, default="#424242")  # Gray
    accent_color = Column(String(7), nullable=False, default="#FF4081")  # Pink
    background_color = Column(String(7), nullable=False, default="#FFFFFF")  # White
    surface_color = Column(String(7), nullable=False, default="#F5F5F5")  # Light Gray
    text_color = Column(String(7), nullable=False, default="#212121")  # Dark Gray
    dark_theme_primary_color = Column(
        String(7), nullable=False, default="#90CAF9"
    )  # Light Blue
    dark_theme_secondary_color = Column(
        String(7), nullable=False, default="#757575"
    )  # Light Gray
    dark_theme_accent_color = Column(
        String(7), nullable=False, default="#FF80AB"
    )  # Light Pink
    dark_theme_background_color = Column(
        String(7), nullable=False, default="#121212"
    )  # Dark Gray
    dark_theme_surface_color = Column(
        String(7), nullable=False, default="#1E1E1E"
    )  # Slightly lighter Dark Gray
    dark_theme_text_color = Column(
        String(7), nullable=False, default="#FFFFFF"
    )  # White
    show_sunday = Column(
        Boolean, nullable=False, default=False
    )  # Show Sunday even if not an opening day
    show_weekdays = Column(
        Boolean, nullable=False, default=False
    )  # Show weekdays even if not opening days
    start_of_week = Column(Integer, nullable=False, default=1)
    email_notifications = Column(Boolean, nullable=False, default=True)
    schedule_published_notify = Column(Boolean, nullable=False, default=True)
    shift_changes_notify = Column(Boolean, nullable=False, default=True)
    time_off_requests_notify = Column(Boolean, nullable=False, default=True)

    # PDF Layout Settings
    page_size = Column(String(10), nullable=False, default="A4")
    orientation = Column(String(10), nullable=False, default="portrait")
    margin_top = Column(Float, nullable=False, default=20.0)
    margin_right = Column(Float, nullable=False, default=20.0)
    margin_bottom = Column(Float, nullable=False, default=20.0)
    margin_left = Column(Float, nullable=False, default=20.0)
    table_header_bg_color = Column(String(7), nullable=False, default="#f3f4f6")
    table_border_color = Column(String(7), nullable=False, default="#e5e7eb")
    table_text_color = Column(String(7), nullable=False, default="#111827")
    table_header_text_color = Column(String(7), nullable=False, default="#111827")
    font_family = Column(String(50), nullable=False, default="Helvetica")
    font_size = Column(Float, nullable=False, default=10.0)
    header_font_size = Column(Float, nullable=False, default=12.0)
    show_employee_id = Column(Boolean, nullable=False, default=True)
    show_position = Column(Boolean, nullable=False, default=True)
    show_breaks = Column(Boolean, nullable=False, default=True)
    show_total_hours = Column(Boolean, nullable=False, default=True)

    # Employee Group Settings
    employee_types = Column(
        JSON,
        nullable=False,
        default=lambda: [
            {
                "id": "VZ",
                "name": "Vollzeit",
                "min_hours": 35,
                "max_hours": 40,
                "max_daily_hours": 8.0,
                "type": "employee",
            },
            {
                "id": "TZ",
                "name": "Teilzeit",
                "min_hours": 15,
                "max_hours": 34,
                "max_daily_hours": 6.0,
                "type": "employee",
            },
            {
                "id": "GFB",
                "name": "Geringfügig Beschäftigt",
                "min_hours": 0,
                "max_hours": 14,
                "max_daily_hours": 5.0,
                "type": "employee",
            },
            {
                "id": "TL",
                "name": "Teamleiter",
                "min_hours": 35,
                "max_hours": 40,
                "max_daily_hours": 8.0,
                "type": "employee",
            },
        ],
    )

    # Use deferred loading for shift_types to handle the case where the column doesn't exist
    _shift_types = deferred(Column("shift_types", JSON, nullable=True))

    def get_shift_types(self):
        """Get the shift types with fallback to default value"""
        try:
            return self._shift_types or [
                {
                    "id": "EARLY",
                    "name": "Frühschicht",
                    "color": "#4CAF50",
                    "type": "shift",
                    "hourConditions": {
                        "startTime": "08:30",
                        "endTime": "14:00",
                        "minDuration": 5.0,
                        "maxDuration": 6.0,
                    },
                },
                {
                    "id": "MIDDLE",
                    "name": "Mittelschicht",
                    "color": "#2196F3",
                    "type": "shift",
                    "hourConditions": {
                        "startTime": "11:00",
                        "endTime": "17:00",
                        "minDuration": 5.0,
                        "maxDuration": 6.0,
                    },
                },
                {
                    "id": "LATE",
                    "name": "Spätschicht",
                    "color": "#9C27B0",
                    "type": "shift",
                    "hourConditions": {
                        "startTime": "14:00",
                        "endTime": "20:00",
                        "minDuration": 5.0,
                        "maxDuration": 6.0,
                    },
                },
            ]
        except Exception:
            return [
                {
                    "id": "EARLY",
                    "name": "Frühschicht",
                    "color": "#4CAF50",
                    "type": "shift",
                    "hourConditions": {
                        "startTime": "08:30",
                        "endTime": "14:00",
                        "minDuration": 5.0,
                        "maxDuration": 6.0,
                    },
                },
                {
                    "id": "MIDDLE",
                    "name": "Mittelschicht",
                    "color": "#2196F3",
                    "type": "shift",
                    "hourConditions": {
                        "startTime": "11:00",
                        "endTime": "17:00",
                        "minDuration": 5.0,
                        "maxDuration": 6.0,
                    },
                },
                {
                    "id": "LATE",
                    "name": "Spätschicht",
                    "color": "#9C27B0",
                    "type": "shift",
                    "hourConditions": {
                        "startTime": "14:00",
                        "endTime": "20:00",
                        "minDuration": 5.0,
                        "maxDuration": 6.0,
                    },
                },
            ]

    def set_shift_types(self, value):
        """Set the shift types"""
        self._shift_types = value

    shift_types = hybrid_property(get_shift_types, set_shift_types)

    absence_types = Column(
        JSON,
        nullable=False,
        default=lambda: [
            {"id": "URL", "name": "Urlaub", "color": "#FF9800", "type": "absence"},
            {"id": "ABW", "name": "Abwesend", "color": "#F44336", "type": "absence"},
            {"id": "SLG", "name": "Schulung", "color": "#4CAF50", "type": "absence"},
        ],
    )

    # Actions Settings - deferred loading to prevent errors if column doesn't exist
    _actions_demo_data = deferred(Column("actions_demo_data", JSON, nullable=True))

    # Advanced scheduling settings
    scheduling_advanced = Column(JSON, nullable=True, default=dict)

    def get_actions_demo_data(self):
        """Get the actions demo data with fallback to default value"""
        try:
            return self._actions_demo_data or {
                "selected_module": "",
                "last_execution": None,
            }
        except:
            return {"selected_module": "", "last_execution": None}

    def set_actions_demo_data(self, value):
        """Set the actions demo data"""
        self._actions_demo_data = value

    actions_demo_data = hybrid_property(get_actions_demo_data, set_actions_demo_data)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def is_store_open(self, date: datetime) -> bool:
        """Check if store is open on a specific date"""
        date_str = date.strftime("%Y-%m-%d")

        # Check special hours first
        if date_str in self.special_hours:
            return not self.special_hours[date_str].get("is_closed", False)

        # Check regular opening days
        weekday = str(date.weekday())
        return self.opening_days.get(weekday, False)

    def get_store_hours(self, date: datetime) -> tuple[str, str]:
        """Get store opening and closing hours for a specific date"""
        date_str = date.strftime("%Y-%m-%d")

        # Check special hours first
        if date_str in self.special_hours and not self.special_hours[date_str].get(
            "is_closed", False
        ):
            special = self.special_hours[date_str]
            # Use the special hours if available, otherwise fall back to default store hours
            opening = special.get("opening", str(self.store_opening))
            closing = special.get("closing", str(self.store_closing))
            return opening, closing

        # Return the default store hours
        return str(self.store_opening), str(self.store_closing)

    def to_dict(self) -> Dict[str, Any]:
        """Convert settings to dictionary format"""
        result = {
            "general": {
                "store_name": self.store_name,
                "store_address": self.store_address,
                "store_contact": self.store_contact,
                "timezone": self.timezone,
                "language": self.language,
                "date_format": self.date_format,
                "time_format": self.time_format,
                "store_opening": self.store_opening,
                "store_closing": self.store_closing,
                "keyholder_before_minutes": self.keyholder_before_minutes,
                "keyholder_after_minutes": self.keyholder_after_minutes,
                "opening_days": self.opening_days,
                "special_hours": self.special_hours,
            },
            "scheduling": {
                "scheduling_resource_type": self.scheduling_resource_type,
                "default_shift_duration": self.default_shift_duration,
                "min_break_duration": self.min_break_duration,
                "max_daily_hours": self.max_daily_hours,
                "max_weekly_hours": self.max_weekly_hours,
                "min_rest_between_shifts": self.min_rest_between_shifts,
                "scheduling_period_weeks": self.scheduling_period_weeks,
                "auto_schedule_preferences": self.auto_schedule_preferences,
            },
            "display": {
                "theme": self.theme,
                "primary_color": self.primary_color,
                "secondary_color": self.secondary_color,
                "accent_color": self.accent_color,
                "background_color": self.background_color,
                "surface_color": self.surface_color,
                "text_color": self.text_color,
                "dark_theme": {
                    "primary_color": self.dark_theme_primary_color,
                    "secondary_color": self.dark_theme_secondary_color,
                    "accent_color": self.dark_theme_accent_color,
                    "background_color": self.dark_theme_background_color,
                    "surface_color": self.dark_theme_surface_color,
                    "text_color": self.dark_theme_text_color,
                },
                "show_sunday": self.show_sunday,
                "show_weekdays": self.show_weekdays,
                "start_of_week": self.start_of_week,
                "email_notifications": self.email_notifications,
                "schedule_published": self.schedule_published_notify,
                "shift_changes": self.shift_changes_notify,
                "time_off_requests": self.time_off_requests_notify,
            },
            "pdf_layout": {
                "page_size": self.page_size,
                "orientation": self.orientation,
                "margins": {
                    "top": self.margin_top,
                    "right": self.margin_right,
                    "bottom": self.margin_bottom,
                    "left": self.margin_left,
                },
                "table_style": {
                    "header_bg_color": self.table_header_bg_color,
                    "border_color": self.table_border_color,
                    "text_color": self.table_text_color,
                    "header_text_color": self.table_header_text_color,
                },
                "fonts": {
                    "family": self.font_family,
                    "size": self.font_size,
                    "header_size": self.header_font_size,
                },
                "content": {
                    "show_employee_id": self.show_employee_id,
                    "show_position": self.show_position,
                    "show_breaks": self.show_breaks,
                    "show_total_hours": self.show_total_hours,
                },
            },
            "employee_groups": {
                "employee_types": self.employee_types,
                "shift_types": self.shift_types,
                "absence_types": self.absence_types,
            },
            "availability_types": (
                self.availability_types
                if self.availability_types is not None
                else {
                    "types": [
                        {
                            "id": "AVL",
                            "name": "Available",
                            "description": "Available for work",
                            "color": "#22c55e",
                            "priority": 2,
                            "is_available": True,
                        },
                        {
                            "id": "FIX",
                            "name": "Fixed",
                            "description": "Fixed working hours",
                            "color": "#3b82f6",
                            "priority": 1,
                            "is_available": True,
                        },
                        {
                            "id": "PRM",
                            "name": "Preferred",
                            "description": "Preferred hours",
                            "color": "#f59e0b",
                            "priority": 3,
                            "is_available": True,
                        },
                        {
                            "id": "UNV",
                            "name": "Unavailable",
                            "description": "Not available",
                            "color": "#ef4444",
                            "priority": 4,
                            "is_available": False,
                        },
                    ]
                }
            ),
            "actions": {"demo_data": self.actions_demo_data},
        }

        # Include scheduling_advanced data in the scheduling section if it exists
        if self.scheduling_advanced and isinstance(self.scheduling_advanced, dict):
            # Merge with the scheduling section
            result["scheduling"].update(self.scheduling_advanced)

        return result

    @classmethod
    def get_default_settings(cls) -> "Settings":
        """Create and return default settings"""
        settings = cls()
        settings.store_name = "ShiftWise Store"
        settings.store_address = ""
        settings.store_contact = ""
        settings.timezone = "Europe/Berlin"
        settings.language = "de"
        settings.date_format = "DD.MM.YYYY"
        settings.time_format = "24h"

        # Scheduling Settings
        settings.scheduling_resource_type = "shifts"
        settings.default_shift_duration = 8.0
        settings.min_break_duration = 30
        settings.max_daily_hours = 10.0
        settings.max_weekly_hours = 40.0
        settings.min_rest_between_shifts = 11.0
        settings.scheduling_period_weeks = 4
        settings.auto_schedule_preferences = True

        # Display Settings
        settings.theme = "light"
        settings.primary_color = "#1976D2"  # Blue
        settings.secondary_color = "#424242"  # Gray
        settings.accent_color = "#FF4081"  # Pink
        settings.background_color = "#FFFFFF"  # White
        settings.surface_color = "#F5F5F5"  # Light Gray
        settings.text_color = "#212121"  # Dark Gray
        settings.dark_theme_primary_color = "#90CAF9"  # Light Blue
        settings.dark_theme_secondary_color = "#757575"  # Light Gray
        settings.dark_theme_accent_color = "#FF80AB"  # Light Pink
        settings.dark_theme_background_color = "#121212"  # Dark Gray
        settings.dark_theme_surface_color = "#1E1E1E"  # Slightly lighter Dark Gray
        settings.dark_theme_text_color = "#FFFFFF"  # White
        settings.show_sunday = False
        settings.show_weekdays = False
        settings.start_of_week = 1

        # Notification Settings
        settings.email_notifications = True
        settings.schedule_published_notify = True
        settings.shift_changes_notify = True
        settings.time_off_requests_notify = True

        # PDF Layout Settings
        settings.page_size = "A4"
        settings.orientation = "portrait"
        settings.margin_top = 20.0
        settings.margin_right = 20.0
        settings.margin_bottom = 20.0
        settings.margin_left = 20.0
        settings.table_header_bg_color = "#f3f4f6"
        settings.table_border_color = "#e5e7eb"
        settings.table_text_color = "#111827"
        settings.table_header_text_color = "#111827"
        settings.font_family = "Helvetica"
        settings.font_size = 10.0
        settings.header_font_size = 12.0
        settings.show_employee_id = True
        settings.show_position = True
        settings.show_breaks = True
        settings.show_total_hours = True

        # Employee Group Settings
        settings.employee_types = [
            {
                "id": "VZ",
                "name": "Vollzeit",
                "min_hours": 35,
                "max_hours": 40,
                "max_daily_hours": 8.0,
                "type": "employee",
            },
            {
                "id": "TZ",
                "name": "Teilzeit",
                "min_hours": 15,
                "max_hours": 34,
                "max_daily_hours": 6.0,
                "type": "employee",
            },
            {
                "id": "GFB",
                "name": "Geringfügig Beschäftigt",
                "min_hours": 0,
                "max_hours": 14,
                "max_daily_hours": 5.0,
                "type": "employee",
            },
            {
                "id": "TL",
                "name": "Teamleiter",
                "min_hours": 35,
                "max_hours": 40,
                "max_daily_hours": 8.0,
                "type": "employee",
            },
        ]

        settings.shift_types = [
            {"id": "EARLY", "name": "Frühschicht", "color": "#4CAF50", "type": "shift"},
            {
                "id": "MIDDLE",
                "name": "Mittelschicht",
                "color": "#2196F3",
                "type": "shift",
            },
            {"id": "LATE", "name": "Spätschicht", "color": "#9C27B0", "type": "shift"},
        ]

        settings.absence_types = [
            {"id": "URL", "name": "Urlaub", "color": "#FF9800", "type": "absence"},
            {"id": "ABW", "name": "Abwesend", "color": "#F44336", "type": "absence"},
            {"id": "SLG", "name": "Schulung", "color": "#4CAF50", "type": "absence"},
        ]

        try:
            settings.actions_demo_data = {"selected_module": "", "last_execution": None}
        except:
            pass

        return settings

    def update_from_dict(self, data: Dict[str, Any]) -> None:
        """Update settings from dictionary data"""
        for category, values in data.items():
            if category == "general":
                for key, value in values.items():
                    # Explicitly handle keyholder time settings
                    if key == "keyholder_before_minutes":
                        self.keyholder_before_minutes = int(value)
                    elif key == "keyholder_after_minutes":
                        self.keyholder_after_minutes = int(value)
                    elif hasattr(self, key):
                        setattr(self, key, value)
            elif category == "scheduling":
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)
            elif category == "display":
                for key, value in values.items():
                    if key == "dark_theme":
                        # Handle nested dark theme settings
                        for theme_key, theme_value in value.items():
                            attr_name = f"dark_theme_{theme_key}"
                            if hasattr(self, attr_name):
                                setattr(self, attr_name, theme_value)
                    elif key == "show_sunday":
                        self.show_sunday = bool(value)
                    elif key == "show_weekdays":
                        self.show_weekdays = bool(value)
                    elif hasattr(self, key):
                        setattr(self, key, value)
            elif category == "notifications":
                for key, value in values.items():
                    attr_name = f"{key}_notify" if key != "email_notifications" else key
                    if hasattr(self, attr_name):
                        setattr(self, attr_name, value)
            elif category == "availability_types":
                # Handle availability types directly
                if hasattr(self, category):
                    setattr(self, category, values)
            elif category == "pdf_layout":
                # Handle page size and orientation directly
                if "page_size" in values:
                    self.page_size = values["page_size"]
                if "orientation" in values:
                    self.orientation = values["orientation"]

                # Handle margins
                if "margins" in values:
                    for key, value in values["margins"].items():
                        attr_name = f"margin_{key}"
                        if hasattr(self, attr_name):
                            setattr(self, attr_name, value)

                # Handle table style
                if "table_style" in values:
                    table_style = values["table_style"]
                    if "header_bg_color" in table_style:
                        self.table_header_bg_color = table_style["header_bg_color"]
                    if "border_color" in table_style:
                        self.table_border_color = table_style["border_color"]
                    if "text_color" in table_style:
                        self.table_text_color = table_style["text_color"]
                    if "header_text_color" in table_style:
                        self.table_header_text_color = table_style["header_text_color"]

                # Handle fonts
                if "fonts" in values:
                    fonts = values["fonts"]
                    if "family" in fonts:
                        self.font_family = fonts["family"]
                    if "size" in fonts:
                        self.font_size = fonts["size"]
                    if "header_size" in fonts:
                        self.header_font_size = fonts["header_size"]

                # Handle content visibility
                if "content" in values:
                    content = values["content"]
                    if "show_employee_id" in content:
                        self.show_employee_id = content["show_employee_id"]
                    if "show_position" in content:
                        self.show_position = content["show_position"]
                    if "show_breaks" in content:
                        self.show_breaks = content["show_breaks"]
                    if "show_total_hours" in content:
                        self.show_total_hours = content["show_total_hours"]

            elif category == "employee_groups":
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)
            elif category == "actions":
                for key, value in values.items():
                    if hasattr(self, key):
                        setattr(self, key, value)

    def __repr__(self):
        return f"<Settings {self.store_name}>"

    @classmethod
    def get_pdf_layout_config(cls) -> Dict[str, Any]:
        """Get PDF layout configuration"""
        settings = cls.query.first()
        if not settings:
            return cls.get_default_pdf_layout()

        return {
            "page_size": settings.page_size,
            "orientation": settings.orientation,
            "margins": {
                "top": settings.margin_top,
                "right": settings.margin_right,
                "bottom": settings.margin_bottom,
                "left": settings.margin_left,
            },
            "table_style": {
                "header_bg_color": settings.table_header_bg_color,
                "border_color": settings.table_border_color,
                "text_color": settings.table_text_color,
                "header_text_color": settings.table_header_text_color,
            },
            "fonts": {
                "family": settings.font_family,
                "size": settings.font_size,
                "header_size": settings.header_font_size,
            },
            "content": {
                "show_employee_id": settings.show_employee_id,
                "show_position": settings.show_position,
                "show_breaks": settings.show_breaks,
                "show_total_hours": settings.show_total_hours,
            },
        }

    @classmethod
    def get_default_pdf_layout(cls) -> Dict[str, Any]:
        """Get default PDF layout configuration"""
        return {
            "table": {
                "column_widths": [1.5, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2],  # in inches
                "style": {
                    "alignment": "center",
                    "valign": "middle",
                    "grid": True,
                    "header_background": "#808080",
                    "header_text_color": "#F5F5F5",
                    "header_font": "Helvetica-Bold",
                    "header_font_size": 12,
                    "row_font": "Helvetica",
                    "row_font_size": 10,
                    "leading": 14,
                    "alternating_row_color": "#F9FAFB",
                },
            },
            "title": {
                "font": "Helvetica-Bold",
                "size": 16,
                "color": "#000000",
                "alignment": "center",
                "spacing": 30,
            },
            "margins": {"right": 30, "left": 30, "top": 30, "bottom": 30},
            "page": {"size": "A4", "orientation": "landscape"},
        }

    @classmethod
    def save_pdf_layout_config(cls, config: Dict[str, Any]) -> None:
        """Save PDF layout configuration"""
        settings = cls.query.first()
        if not settings:
            settings = cls()
            db.session.add(settings)

        # Update settings with the provided config
        for key, value in config.items():
            if hasattr(settings, key):
                setattr(settings, key, value)

        db.session.commit()

    @classmethod
    def get_pdf_layout_presets(cls) -> Dict[str, Dict[str, Any]]:
        """Get PDF layout presets"""
        setting = cls.query.filter_by(
            category="pdf_layout_presets", key="presets"
        ).first()
        if setting:
            return setting.value
        return cls.get_default_pdf_presets()

    @classmethod
    def get_default_pdf_presets(cls) -> Dict[str, Dict[str, Any]]:
        """Get default PDF layout presets"""
        return {
            "Classic": cls.get_default_pdf_layout(),
            "Modern": {
                "table": {
                    "column_widths": [2.0, 1.0, 1.0, 1.2, 1.2, 1.2, 1.2],
                    "style": {
                        "alignment": "left",
                        "valign": "middle",
                        "grid": False,
                        "header_background": "#1E293B",
                        "header_text_color": "#FFFFFF",
                        "header_font": "Helvetica-Bold",
                        "header_font_size": 14,
                        "row_font": "Helvetica",
                        "row_font_size": 11,
                        "leading": 16,
                        "alternating_row_color": "#F8FAFC",
                    },
                },
                "title": {
                    "font": "Helvetica-Bold",
                    "size": 20,
                    "color": "#1E293B",
                    "alignment": "left",
                    "spacing": 40,
                },
                "margins": {"right": 40, "left": 40, "top": 40, "bottom": 40},
                "page": {"size": "A4", "orientation": "landscape"},
            },
            "Compact": {
                "table": {
                    "column_widths": [1.2, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                    "style": {
                        "alignment": "center",
                        "valign": "middle",
                        "grid": True,
                        "header_background": "#374151",
                        "header_text_color": "#FFFFFF",
                        "header_font": "Helvetica-Bold",
                        "header_font_size": 10,
                        "row_font": "Helvetica",
                        "row_font_size": 9,
                        "leading": 12,
                        "alternating_row_color": "#F3F4F6",
                    },
                },
                "title": {
                    "font": "Helvetica-Bold",
                    "size": 14,
                    "color": "#374151",
                    "alignment": "center",
                    "spacing": 20,
                },
                "margins": {"right": 20, "left": 20, "top": 20, "bottom": 20},
                "page": {"size": "A4", "orientation": "landscape"},
            },
        }

    @classmethod
    def save_pdf_layout_preset(cls, name: str, config: Dict[str, Any]) -> None:
        """Save a new PDF layout preset"""
        settings = cls.query.first()
        if not settings:
            settings = cls()
            db.session.add(settings)

        # Get existing presets or initialize with defaults
        presets = settings.get_pdf_layout_presets()
        presets[name] = config

        # Store presets in a JSON field
        settings.pdf_layout_presets = presets
        db.session.commit()

    @classmethod
    def delete_pdf_layout_preset(cls, name: str) -> bool:
        """Delete a PDF layout preset"""
        if name in ["Classic", "Modern", "Compact"]:
            return False  # Cannot delete default presets
        presets = cls.get_pdf_layout_presets()
        if name in presets:
            del presets[name]
            setting = cls.query.filter_by(
                category="pdf_layout_presets", key="presets"
            ).first()
            if setting:
                setting.value = presets
                db.session.commit()
            return True
        return False

    @classmethod
    def get_or_create_default(cls):
        """Get existing settings or create default settings"""
        settings = cls.query.first()
        if not settings:
            settings = cls()
            db.session.add(settings)
            db.session.commit()
        return settings
