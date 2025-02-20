from app import create_app
from models import db, Employee, Settings, Shift, EmployeeAvailability
from models.employee import EmployeeGroup, AvailabilityType
from datetime import datetime, date

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

        # Create test shifts if not exists
        if not Shift.query.first():
            shifts = [
                Shift(start_time='07:00', end_time='15:00', min_employees=2, max_employees=3, requires_break=True),
                Shift(start_time='09:00', end_time='17:00', min_employees=2, max_employees=4, requires_break=True),
                Shift(start_time='14:00', end_time='22:00', min_employees=2, max_employees=3, requires_break=True)
            ]
            for shift in shifts:
                db.session.add(shift)
            db.session.commit()

        # Create test employees if not exists
        if not Employee.query.first():
            employees = [
                Employee(first_name='John', last_name='Doe', employee_group=EmployeeGroup.TL.value, contracted_hours=40.0, is_keyholder=True),
                Employee(first_name='Jane', last_name='Smith', employee_group=EmployeeGroup.VL.value, contracted_hours=38.0, is_keyholder=True),
                Employee(first_name='Bob', last_name='Johnson', employee_group=EmployeeGroup.TZ.value, contracted_hours=30.0, is_keyholder=False),
                Employee(first_name='Alice', last_name='Brown', employee_group=EmployeeGroup.TZ.value, contracted_hours=25.0, is_keyholder=False),
                Employee(first_name='Charlie', last_name='Wilson', employee_group=EmployeeGroup.GFB.value, contracted_hours=10.0, is_keyholder=False)
            ]
            for employee in employees:
                db.session.add(employee)
            db.session.commit()

            # Add availabilities for each employee
            for employee in employees:
                # Add regular availability for weekdays
                for day in range(0, 5):  # Monday to Friday
                    for hour in range(7, 22):  # 7:00 to 22:00
                        availability = EmployeeAvailability(
                            employee_id=employee.id,
                            day_of_week=day,
                            hour=hour,
                            is_available=True,
                            is_recurring=True,
                            availability_type=AvailabilityType.REGULAR
                        )
                        db.session.add(availability)

                # Add Saturday availability (shorter hours)
                if employee.employee_group in [EmployeeGroup.VL.value, EmployeeGroup.TZ.value, EmployeeGroup.TL.value]:  # Full-time and part-time employees
                    for hour in range(9, 18):  # 9:00 to 18:00
                        availability = EmployeeAvailability(
                            employee_id=employee.id,
                            day_of_week=5,  # Saturday
                            hour=hour,
                            is_available=True,
                            is_recurring=True,
                            availability_type=AvailabilityType.REGULAR
                        )
                        db.session.add(availability)

            db.session.commit()

        print("Database initialized successfully!")

if __name__ == '__main__':
    init_db() 