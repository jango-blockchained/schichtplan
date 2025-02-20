from app import create_app
from models import db, Employee, Settings, Shift
from models.employee import EmployeeGroup

def init_db():
    """Initialize the database with default data"""
    app = create_app()
    with app.app_context():
        db.create_all()

        # Create default settings if not exists
        if not Settings.query.first():
            settings = Settings()
            settings.store_name = 'ShiftWise Store'
            settings.store_address = 'Example Street 123, 12345 City'
            settings.store_contact = 'contact@shiftwisestore.com'
            settings.timezone = 'Europe/Berlin'
            settings.language = 'de'
            settings.date_format = 'DD.MM.YYYY'
            settings.time_format = '24h'
            settings.store_opening = '07:00'
            settings.store_closing = '22:00'
            settings.opening_days = {
                "0": False,  # Sunday
                "1": True,   # Monday
                "2": True,   # Tuesday
                "3": True,   # Wednesday
                "4": True,   # Thursday
                "5": True,   # Friday
                "6": True    # Saturday
            }
            settings.special_hours = {}
            settings.default_shift_duration = 8.0
            settings.min_break_duration = 30
            settings.max_daily_hours = 10.0
            settings.max_weekly_hours = 40.0
            settings.min_rest_between_shifts = 11.0
            settings.scheduling_period_weeks = 4
            settings.auto_schedule_preferences = True
            
            db.session.add(settings)
            db.session.commit()

        # Create test shifts
        test_shifts = [
            Shift(
                start_time='07:00',
                end_time='15:00',
                min_employees=2,
                max_employees=3,
                requires_break=True
            ),
            Shift(
                start_time='09:00',
                end_time='17:00',
                min_employees=2,
                max_employees=4,
                requires_break=True
            ),
            Shift(
                start_time='14:00',
                end_time='22:00',
                min_employees=2,
                max_employees=3,
                requires_break=True
            )
        ]

        for shift in test_shifts:
            db.session.add(shift)
        db.session.commit()

        # Create some test employees
        test_employees = [
            Employee(
                first_name="John",
                last_name="Doe",
                employee_group=EmployeeGroup.TL.value,
                contracted_hours=40,
                is_keyholder=True
            ),
            Employee(
                first_name="Jane",
                last_name="Smith",
                employee_group=EmployeeGroup.VL.value,
                contracted_hours=40,
                is_keyholder=True
            ),
            Employee(
                first_name="Bob",
                last_name="Johnson",
                employee_group=EmployeeGroup.TZ.value,
                contracted_hours=30
            )
        ]

        for employee in test_employees:
            db.session.add(employee)

        db.session.commit()
        print("Database initialized successfully!")

if __name__ == '__main__':
    init_db() 