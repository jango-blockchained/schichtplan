from models import db, Settings
from app import create_app
import json

app = create_app()

with app.app_context():
    # Check if settings exist
    settings = Settings.query.first()
    if not settings:
        print("No settings found. Creating default settings...")
        settings = Settings.get_default_settings()
        db.session.add(settings)
        try:
            db.session.commit()
            print("Default settings created successfully!")
        except Exception as e:
            db.session.rollback()
            print(f"Error creating settings: {str(e)}")
    else:
        print("Settings already exist in the database.")

    settings = Settings(
        store_name='Store Name',
        timezone='Europe/Berlin',
        language='de',
        date_format='DD.MM.YYYY',
        time_format='HH:mm',
        store_opening='08:00',
        store_closing='20:00',
        keyholder_before_minutes=30,
        keyholder_after_minutes=30,
        opening_days=json.dumps(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
        special_hours=json.dumps({}),
        scheduling_resource_type='shifts',
        default_shift_duration=8.0,
        min_break_duration=30,
        max_daily_hours=10.0,
        max_weekly_hours=40.0,
        min_rest_between_shifts=11.0,
        scheduling_period_weeks=4,
        auto_schedule_preferences=True,
        min_employees_per_shift=1,
        max_employees_per_shift=3,
        theme='light',
        primary_color='#1976D2',
        secondary_color='#424242',
        accent_color='#82B1FF',
        background_color='#FFFFFF',
        surface_color='#FFFFFF',
        text_color='#000000',
        dark_theme_primary_color='#1976D2',
        dark_theme_secondary_color='#424242',
        dark_theme_accent_color='#82B1FF',
        dark_theme_background_color='#121212',
        dark_theme_surface_color='#1E1E1E',
        dark_theme_text_color='#FFFFFF',
        show_sunday=False,
        show_weekdays=True,
        start_of_week=1,
        email_notifications=True,
        schedule_published_notify=True,
        shift_changes_notify=True,
        time_off_requests_notify=True,
        page_size='A4',
        orientation='portrait',
        margin_top=20.0,
        margin_right=20.0,
        margin_bottom=20.0,
        margin_left=20.0,
        table_header_bg_color='#F5F5F5',
        table_border_color='#E0E0E0',
        table_text_color='#000000',
        table_header_text_color='#000000',
        font_family='Arial',
        font_size=12.0,
        header_font_size=14.0,
        show_employee_id=True,
        show_position=True,
        show_breaks=True,
        show_total_hours=True,
        employee_types=json.dumps([
            {'id': 'VL', 'name': 'Vollzeit'},
            {'id': 'TL', 'name': 'Teilzeit'},
            {'id': 'TZ', 'name': 'Teilzeit'},
            {'id': 'GFB', 'name': 'Geringfügig Beschäftigt'}
        ]),
        absence_types=json.dumps([
            {'id': 'vacation', 'name': 'Urlaub'},
            {'id': 'sick', 'name': 'Krank'},
            {'id': 'other', 'name': 'Sonstiges'}
        ])
    )

    db.session.add(settings)
    db.session.commit()
    print('Settings added successfully!') 