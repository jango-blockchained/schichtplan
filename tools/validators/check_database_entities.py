from src.backend.app import create_app
from src.backend.models import db, Employee, ShiftTemplate, Coverage, EmployeeAvailability, Absence, Settings, User, ScheduleVersionMeta

app = create_app()

with app.app_context():
    # Count main entities
    print('Active Employees:', db.session.query(Employee).filter_by(is_active=True).count())
    print('Total Employees:', db.session.query(Employee).count())
    print('Shift Templates:', db.session.query(ShiftTemplate).count())
    print('Coverage Requirements:', db.session.query(Coverage).count())
    print('Employee Availabilities:', db.session.query(EmployeeAvailability).count())
    print('Absences:', db.session.query(Absence).count())
    print('Users:', db.session.query(User).count())
    print('Settings:', db.session.query(Settings).count())
    print('Schedule Version Metadata:', db.session.query(ScheduleVersionMeta).count())
    
    # Get sample employees
    employees = db.session.query(Employee).limit(3).all()
    if employees:
        print("\nSample Employees:")
        for employee in employees:
            print(f"  {employee.first_name} {employee.last_name} (ID: {employee.id}, Group: {employee.employee_group}, Hours: {employee.contracted_hours})")
    
    # Get sample shifts
    shifts = db.session.query(ShiftTemplate).limit(3).all()
    if shifts:
        print("\nSample Shifts:")
        for shift in shifts:
            print(f"  ID: {shift.id}, Type: {shift.shift_type}, Time: {shift.start_time}-{shift.end_time}, Active Days: {shift.active_days}")
    
    # Get sample coverage
    coverage = db.session.query(Coverage).limit(3).all()
    if coverage:
        print("\nSample Coverage:")
        for c in coverage:
            print(f"  Day: {c.day_index}, Time: {c.start_time}-{c.end_time}, Min Staff: {c.min_employees}, Requires Keyholder: {c.requires_keyholder}") 