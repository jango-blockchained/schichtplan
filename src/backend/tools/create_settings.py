import sqlite3
import json
import datetime

conn = sqlite3.connect("src/instance/app.db")
cursor = conn.cursor()

# Default values
now = datetime.datetime.now().isoformat()
default_shift_types = json.dumps(
    [
        {"id": "EARLY", "name": "Frühschicht", "color": "#4CAF50", "type": "shift"},
        {"id": "MIDDLE", "name": "Mittelschicht", "color": "#2196F3", "type": "shift"},
        {"id": "LATE", "name": "Spätschicht", "color": "#9C27B0", "type": "shift"},
    ]
)
default_employee_types = json.dumps(
    [
        {
            "id": "VZ",
            "name": "Vollzeit",
            "min_hours": 35,
            "max_hours": 40,
            "type": "employee",
        },
        {
            "id": "TZ",
            "name": "Teilzeit",
            "min_hours": 15,
            "max_hours": 34,
            "type": "employee",
        },
        {
            "id": "GFB",
            "name": "Geringfügig Beschäftigt",
            "min_hours": 0,
            "max_hours": 14,
            "type": "employee",
        },
        {
            "id": "TL",
            "name": "Teamleiter",
            "min_hours": 35,
            "max_hours": 40,
            "type": "employee",
        },
    ]
)
default_absence_types = json.dumps(
    [
        {"id": "URL", "name": "Urlaub", "color": "#FF9800", "type": "absence"},
        {"id": "ABW", "name": "Abwesend", "color": "#F44336", "type": "absence"},
        {"id": "SLG", "name": "Schulung", "color": "#4CAF50", "type": "absence"},
    ]
)
default_opening_days = json.dumps(
    {
        "0": False,  # Sunday
        "1": True,  # Monday
        "2": True,  # Tuesday
        "3": True,  # Wednesday
        "4": True,  # Thursday
        "5": True,  # Friday
        "6": True,  # Saturday
    }
)

# Insert default settings
cursor.execute(
    """
INSERT INTO settings (
    store_name, store_address, store_contact, timezone, language, date_format, time_format,
    store_opening, store_closing, keyholder_before_minutes, keyholder_after_minutes,
    opening_days, special_hours, scheduling_resource_type, default_shift_duration,
    min_break_duration, max_daily_hours, max_weekly_hours, min_rest_between_shifts,
    scheduling_period_weeks, auto_schedule_preferences, theme, primary_color,
    secondary_color, accent_color, background_color, surface_color, text_color,
    dark_theme_primary_color, dark_theme_secondary_color, dark_theme_accent_color,
    dark_theme_background_color, dark_theme_surface_color, dark_theme_text_color,
    show_sunday, show_weekdays, start_of_week, email_notifications,
    schedule_published_notify, shift_changes_notify, time_off_requests_notify,
    page_size, orientation, margin_top, margin_right, margin_bottom, margin_left,
    table_header_bg_color, table_border_color, table_text_color, table_header_text_color,
    font_family, font_size, header_font_size, show_employee_id, show_position,
    show_breaks, show_total_hours, employee_types, shift_types, absence_types,
    created_at, updated_at
) VALUES (
    'ShiftWise Store', '', '', 'Europe/Berlin', 'de', 'DD.MM.YYYY', '24h',
    '09:00', '20:00', 5, 10,
    ?, '{}', 'shifts', 8.0,
    30, 10.0, 40.0, 11.0,
    4, 1, 'light', '#1976D2',
    '#424242', '#FF4081', '#FFFFFF', '#F5F5F5', '#212121',
    '#90CAF9', '#757575', '#FF80AB', '#121212', '#1E1E1E', '#FFFFFF',
    0, 0, 1, 1,
    1, 1, 1,
    'A4', 'portrait', 20.0, 20.0, 20.0, 20.0,
    '#f3f4f6', '#e5e7eb', '#111827', '#111827',
    'Helvetica', 10.0, 12.0, 1, 1,
    1, 1, ?, ?, ?,
    ?, ?
)
""",
    (
        default_opening_days,
        default_employee_types,
        default_shift_types,
        default_absence_types,
        now,
        now,
    ),
)

conn.commit()
print("Default settings created successfully")
conn.close()
