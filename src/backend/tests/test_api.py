import pytest
from models import Employee, EmployeeGroup, Shift, ShiftType, Settings, Schedule
from datetime import datetime, date, time, timedelta
from tests.conftest import client, app

def test_get_employees_empty(client, session):
    """Test getting employees when none exist"""
    response = client.get('/api/employees/')
    assert response.status_code == 200
    assert response.json == []

def test_create_employee(client, session):
    """Test employee creation via API"""
    data = {
        'first_name': 'Test',
        'last_name': 'User',
        'employee_group': 'VZ',
        'contracted_hours': 40,
        'is_keyholder': True
    }
    
    response = client.post('/api/employees/', json=data)
    assert response.status_code == 201
    assert 'employee_id' in response.json
    assert response.json['employee_id'] == 'TUS'

def test_get_employees(client, session):
    """Test getting all employees"""
    # Create test employee
    employee = Employee(
        first_name="Test",
        last_name="User",
        employee_group=EmployeeGroup.VZ,
        contracted_hours=40
    )
    session.add(employee)
    session.commit()
    
    response = client.get('/api/employees/')
    assert response.status_code == 200
    assert len(response.json) == 1
    assert response.json[0]['employee_id'] == 'TUS'

def test_get_shifts_empty(client, session):
    """Test getting shifts when none exist"""
    response = client.get('/api/shifts/')
    assert response.status_code == 200
    assert response.json == []

def test_create_shift(client):
    """Test creating a new shift"""
    data = {
        'start_time': '08:00',
        'end_time': '16:00',
        'min_employees': 2,
        'max_employees': 5,
        'requires_break': True
    }
    response = client.post('/api/shifts/', json=data)
    assert response.status_code == 201
    assert response.json['start_time'] == '08:00'
    assert response.json['end_time'] == '16:00'

def test_get_shifts(client, app):
    """Test getting all shifts"""
    with app.app_context():
        shift = Shift(
            start_time='08:00',
            end_time='16:00',
            min_employees=2,
            max_employees=5,
            requires_break=True
        )
        db.session.add(shift)
        db.session.commit()

    response = client.get('/api/shifts/')
    assert response.status_code == 200
    assert len(response.json) > 0
    assert response.json[0]['start_time'] == '08:00'

def test_update_shift(client, app):
    """Test updating a shift"""
    with app.app_context():
        shift = Shift(
            start_time='08:00',
            end_time='16:00',
            min_employees=2,
            max_employees=5,
            requires_break=True
        )
        db.session.add(shift)
        db.session.commit()
        shift_id = shift.id

    data = {
        'start_time': '09:00',
        'end_time': '17:00'
    }
    response = client.put(f'/api/shifts/{shift_id}', json=data)
    assert response.status_code == 200
    assert response.json['start_time'] == '09:00'
    assert response.json['end_time'] == '17:00'

def test_delete_shift(client, app):
    """Test deleting a shift"""
    with app.app_context():
        shift = Shift(
            start_time='08:00',
            end_time='16:00',
            min_employees=2,
            max_employees=5,
            requires_break=True
        )
        db.session.add(shift)
        db.session.commit()
        shift_id = shift.id

    response = client.delete(f'/api/shifts/{shift_id}')
    assert response.status_code == 204

    with app.app_context():
        assert Shift.query.get(shift_id) is None

def test_create_default_shifts(client, session):
    """Test creating default shifts"""
    response = client.post('/api/shifts/defaults')
    assert response.status_code == 201
    assert response.json['count'] > 0

def test_get_store_config(client, session):
    """Test getting store configuration"""
    response = client.get('/api/store/config')
    assert response.status_code == 200
    assert 'store_name' in response.json
    assert 'opening_time' in response.json
    assert 'closing_time' in response.json

def test_update_store_config(client, session):
    """Test updating store configuration"""
    data = {
        'store_name': 'Test Store',
        'opening_time': '08:00',
        'closing_time': '20:00',
        'min_employees_per_shift': 2,
        'max_employees_per_shift': 6,
        'break_duration_minutes': 45
    }
    
    response = client.put('/api/store/config', json=data)
    assert response.status_code == 200
    
    # Verify changes
    response = client.get('/api/store/config')
    assert response.json['store_name'] == 'Test Store'
    assert response.json['opening_time'] == '08:00'
    assert response.json['closing_time'] == '20:00'

def test_schedule_generation(client, app):
    """Test schedule generation"""
    # Create test data
    with app.app_context():
        # Create store config
        store_config = Settings(
            store_opening="08:00",
            store_closing="20:00",
            break_duration_minutes=60
        )
        db.session.add(store_config)
        
        # Create shifts
        opening_shift = Shift(
            start_time="08:00",
            end_time="16:00",
            min_employees=2,
            max_employees=3,
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5]  # Mon-Sat
        )
        
        middle_shift = Shift(
            start_time="10:00",
            end_time="18:00",
            min_employees=2,
            max_employees=4,
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5]  # Mon-Sat
        )
        
        closing_shift = Shift(
            start_time="12:00",
            end_time="20:00",
            min_employees=2,
            max_employees=3,
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5]  # Mon-Sat
        )
        
        db.session.add_all([opening_shift, middle_shift, closing_shift])
        
        # Create employees
        keyholder1 = Employee(
            name="Key Holder 1",
            group=EmployeeGroup.VZ,
            is_keyholder=True,
            max_hours_per_week=40
        )
        
        keyholder2 = Employee(
            name="Key Holder 2",
            group=EmployeeGroup.VZ,
            is_keyholder=True,
            max_hours_per_week=40
        )
        
        employee1 = Employee(
            name="Employee 1",
            group=EmployeeGroup.TZ,
            is_keyholder=False,
            max_hours_per_week=30
        )
        
        employee2 = Employee(
            name="Employee 2",
            group=EmployeeGroup.TZ,
            is_keyholder=False,
            max_hours_per_week=30
        )
        
        db.session.add_all([keyholder1, keyholder2, employee1, employee2])
        db.session.commit()
        
        # Test schedule generation
        response = client.post('/api/schedules/generate', json={
            'start_date': '2024-01-01',  # Monday
            'end_date': '2024-01-07'     # Sunday
        })
        
        assert response.status_code == 200
        schedules = response.json['schedules']
        
        # Verify schedules
        for schedule in schedules:
            shift = next(s for s in [opening_shift, middle_shift, closing_shift] 
                        if s.id == schedule['shift_id'])
            employee = next(e for e in [keyholder1, keyholder2, employee1, employee2] 
                          if e.id == schedule['employee_id'])
            
            # Check opening/closing shift assignments
            if shift.start_time <= "09:00":  # Opening shift
                assert employee.is_keyholder
            elif shift.end_time >= "18:00":  # Closing shift
                assert employee.is_keyholder
                
            # Check break assignments for long shifts
            if shift.requires_break:
                assert 'break_start' in schedule
                assert 'break_end' in schedule
                
            # Check shift hours against store hours
            assert shift.start_time >= store_config.store_opening
            assert shift.end_time <= store_config.store_closing

def test_get_schedule(client, session):
    """Test getting generated schedule"""
    # First generate a schedule
    test_schedule_generation(client, session)
    
    # Get the schedule
    response = client.get('/api/schedules/')
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_export_schedule(client, session):
    """Test schedule export to PDF"""
    # First generate a schedule
    test_schedule_generation(client, session)
    
    # Export the schedule
    data = {
        'start_date': date.today().strftime('%Y-%m-%d'),
        'end_date': date.today().strftime('%Y-%m-%d')
    }
    
    response = client.post('/api/schedules/export', json=data)
    assert response.status_code == 200
    assert response.mimetype == 'application/pdf'

def test_schedule_respects_weekly_limits(client, session):
    """Test that schedule generation respects weekly hour limits"""
    # Create a VZ employee
    vl_employee = Employee(
        first_name="VZ",
        last_name="User",
        employee_group=EmployeeGroup.VZ,
        contracted_hours=40,
        is_keyholder=True
    )
    session.add(vl_employee)
    
    # Create shifts that would exceed 48 hours if all assigned
    shifts = []
    for i in range(6):  # 6 x 9-hour shifts = 54 hours
        shift = Shift(
            shift_type=ShiftType.EARLY,
            start_time=time(9, 0),
            end_time=time(18, 0),  # 9 hours
            min_employees=1,
            max_employees=1
        )
        shifts.append(shift)
        session.add(shift)
    
    config = Settings.get_default_config()
    session.add(config)
    
    session.commit()
    
    # Try to generate schedule for one week
    start_date = date.today()
    end_date = start_date + timedelta(days=5)  # Monday to Saturday
    
    data = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d')
    }
    
    response = client.post('/api/schedules/generate', json=data)
    assert response.status_code == 201
    
    # Check that the generated schedules don't exceed 48 hours
    schedules = Schedule.query.filter(
        Schedule.employee_id == vl_employee.id,
        Schedule.date >= start_date,
        Schedule.date <= end_date
    ).all()
    
    total_hours = sum(s.shift.duration_hours for s in schedules)
    assert total_hours <= 48, f"Weekly hours ({total_hours}) exceed limit of 48 for VZ employee"

def test_keyholder_requirements(client, session):
    """Test that early/late shifts require a keyholder"""
    # Create a regular employee (non-keyholder)
    regular_employee = Employee(
        first_name="Regular",
        last_name="Employee",
        employee_group=EmployeeGroup.VZ,
        contracted_hours=40,
        is_keyholder=False
    )
    session.add(regular_employee)
    
    # Create an early shift
    early_shift = Shift(
        shift_type=ShiftType.EARLY,
        start_time=time(6, 0),
        end_time=time(14, 0),
        min_employees=1,
        max_employees=2
    )
    session.add(early_shift)
    
    config = Settings.get_default_config()
    session.add(config)
    
    session.commit()
    
    # Try to generate schedule with no keyholder
    start_date = date.today()
    data = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': start_date.strftime('%Y-%m-%d')
    }
    
    response = client.post('/api/schedules/generate', json=data)
    assert response.status_code == 400
    assert "keyholder requirement" in response.json['error']
    
    # Add a keyholder
    keyholder = Employee(
        first_name="Key",
        last_name="Holder",
        employee_group=EmployeeGroup.TL,
        contracted_hours=40,
        is_keyholder=True
    )
    session.add(keyholder)
    session.commit()
    
    # Try again with keyholder
    response = client.post('/api/schedules/generate', json=data)
    assert response.status_code == 201
    
    # Verify keyholder was assigned to early shift
    schedules = Schedule.query.filter(
        Schedule.date == start_date,
        Schedule.shift_id == early_shift.id
    ).all()
    
    assert any(s.employee_id == keyholder.id for s in schedules), "Keyholder should be assigned to early shift"

def test_late_early_shift_constraint(client, session):
    """Test that keyholders cannot work late shift followed by early shift"""
    # Create a keyholder
    keyholder = Employee(
        first_name="Key",
        last_name="Holder",
        employee_group=EmployeeGroup.TL,
        contracted_hours=40,
        is_keyholder=True
    )
    session.add(keyholder)
    
    # Create late and early shifts
    late_shift = Shift(
        shift_type=ShiftType.LATE,
        start_time=time(14, 0),
        end_time=time(22, 0),
        min_employees=1,
        max_employees=2
    )
    session.add(late_shift)
    
    early_shift = Shift(
        shift_type=ShiftType.EARLY,
        start_time=time(6, 0),
        end_time=time(14, 0),
        min_employees=1,
        max_employees=2
    )
    session.add(early_shift)
    
    config = Settings.get_default_config()
    session.add(config)
    
    session.commit()
    
    # Try to generate schedule for two consecutive days
    start_date = date.today()
    end_date = start_date + timedelta(days=1)
    data = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d')
    }
    
    response = client.post('/api/schedules/generate', json=data)
    assert response.status_code == 201
    
    # Verify keyholder is not assigned to late shift followed by early shift
    schedules = Schedule.query.filter(
        Schedule.employee_id == keyholder.id,
        Schedule.date.in_([start_date, end_date])
    ).join(Shift).order_by(Schedule.date).all()
    
    # If keyholder worked late shift on first day, they should not work early shift next day
    if any(s.shift.shift_type == ShiftType.LATE and s.date == start_date for s in schedules):
        assert not any(s.shift.shift_type == ShiftType.EARLY and s.date == end_date for s in schedules)

def test_break_time_requirements(client, session):
    """Test that break times are assigned according to German labor law"""
    # Create an employee
    employee = Employee(
        first_name="Test",
        last_name="User",
        employee_group=EmployeeGroup.VZ,
        contracted_hours=40,
        is_keyholder=True
    )
    session.add(employee)
    
    # Create shifts with different durations
    short_shift = Shift(  # 6 hours - no break required
        shift_type=ShiftType.EARLY,
        start_time=time(9, 0),
        end_time=time(15, 0),
        min_employees=1,
        max_employees=2
    )
    session.add(short_shift)
    
    medium_shift = Shift(  # 8 hours - 30 minute break required
        shift_type=ShiftType.MIDDLE,
        start_time=time(10, 0),
        end_time=time(18, 0),
        min_employees=1,
        max_employees=2
    )
    session.add(medium_shift)
    
    long_shift = Shift(  # 10 hours - 45 minute break required
        shift_type=ShiftType.LATE,
        start_time=time(12, 0),
        end_time=time(22, 0),
        min_employees=1,
        max_employees=2
    )
    session.add(long_shift)
    
    config = Settings.get_default_config()
    session.add(config)
    
    session.commit()
    
    # Generate schedule for one day
    start_date = date.today()
    data = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': start_date.strftime('%Y-%m-%d')
    }
    
    response = client.post('/api/schedules/generate', json=data)
    assert response.status_code == 201
    
    # Check break assignments
    schedules = Schedule.query.filter(
        Schedule.date == start_date
    ).join(Shift).order_by(Shift.start_time).all()
    
    for schedule in schedules:
        shift = schedule.shift
        
        if shift.duration_hours <= 6:
            # No break required for shifts <= 6 hours
            assert schedule.break_start is None
            assert schedule.break_end is None
            
        elif shift.duration_hours <= 9:
            # 30 minute break required for shifts 6-9 hours
            assert schedule.break_start is not None
            assert schedule.break_end is not None
            
            # Break should be between 2-6 hours after shift start
            break_start = datetime.strptime(schedule.break_start, '%H:%M')
            shift_start = datetime.strptime(shift.start_time, '%H:%M')
            hours_before_break = (break_start - shift_start).total_seconds() / 3600
            assert 2 <= hours_before_break <= 6
            
            # Break should be 30 minutes
            break_start = datetime.strptime(schedule.break_start, '%H:%M')
            break_end = datetime.strptime(schedule.break_end, '%H:%M')
            break_duration = (break_end - break_start).total_seconds() / 60
            assert break_duration == 30
            
        else:
            # 45 minute break required for shifts > 9 hours
            assert schedule.break_start is not None
            assert schedule.break_end is not None
            assert schedule.notes is not None and "Second break" in schedule.notes
            
            # First break should be 30 minutes
            break_start = datetime.strptime(schedule.break_start, '%H:%M')
            break_end = datetime.strptime(schedule.break_end, '%H:%M')
            break_duration = (break_end - break_start).total_seconds() / 60
            assert break_duration == 30
            
            # Second break should be 15 minutes
            second_break = schedule.notes.split(": ")[1]
            start, end = second_break.split("-")
            second_break_start = datetime.strptime(start, '%H:%M')
            second_break_end = datetime.strptime(end, '%H:%M')
            second_break_duration = (second_break_end - second_break_start).total_seconds() / 60
            assert second_break_duration == 15

def test_schedule_shift(client, app):
    """Test scheduling a shift"""
    with app.app_context():
        employee = Employee(
            first_name="Test",
            last_name="User",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True
        )
        shift = Shift(
            start_time='08:00',
            end_time='16:00',
            min_employees=2,
            max_employees=5,
            requires_break=True
        )
        db.session.add(employee)
        db.session.add(shift)
        db.session.commit()

        data = {
            'employee_id': employee.id,
            'shift_id': shift.id,
            'date': '2024-03-01'
        }
        response = client.post('/api/schedules/', json=data)
        assert response.status_code == 201
        assert response.json['employee']['id'] == employee.id
        assert response.json['shift']['id'] == shift.id

def test_update_schedule(client, app):
    """Test updating a schedule"""
    with app.app_context():
        employee = Employee(
            first_name="Test",
            last_name="User",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40.0,
            is_keyholder=True
        )
        shift = Shift(
            start_time='08:00',
            end_time='16:00',
            min_employees=2,
            max_employees=5,
            requires_break=True
        )
        schedule = Schedule(
            employee=employee,
            shift=shift,
            date=datetime.strptime('2024-03-01', '%Y-%m-%d').date()
        )
        db.session.add(employee)
        db.session.add(shift)
        db.session.add(schedule)
        db.session.commit()

        data = {
            'break_start': '12:00',
            'break_end': '12:30'
        }
        response = client.put(f'/api/schedules/{schedule.id}', json=data)
        assert response.status_code == 200
        assert response.json['break_start'] == '12:00'
        assert response.json['break_end'] == '12:30' 