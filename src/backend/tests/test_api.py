import pytest
from models import Employee, EmployeeGroup, Shift, ShiftType, StoreConfig
from datetime import datetime, date, time

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
        'employee_group': 'VL',
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
        employee_group=EmployeeGroup.VL,
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

def test_create_shift(client, session):
    """Test shift creation via API"""
    data = {
        'shift_type': 'Frühschicht',
        'start_time': '09:00',
        'end_time': '17:00',
        'min_employees': 2,
        'max_employees': 5
    }
    
    response = client.post('/api/shifts/', json=data)
    assert response.status_code == 201
    assert 'id' in response.json

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

def test_generate_schedule(client, session):
    """Test schedule generation"""
    # Create test data
    employee = Employee(
        first_name="Test",
        last_name="User",
        employee_group=EmployeeGroup.VL,
        contracted_hours=40,
        is_keyholder=True
    )
    session.add(employee)
    
    shift = Shift(
        shift_type=ShiftType.EARLY,
        start_time=time(9, 0),
        end_time=time(17, 0),
        min_employees=1,
        max_employees=3
    )
    session.add(shift)
    
    config = StoreConfig.get_default_config()
    session.add(config)
    
    session.commit()
    
    # Generate schedule
    data = {
        'start_date': date.today().strftime('%Y-%m-%d'),
        'end_date': date.today().strftime('%Y-%m-%d')
    }
    
    response = client.post('/api/schedules/generate', json=data)
    assert response.status_code == 201
    assert 'total_shifts' in response.json

def test_get_schedule(client, session):
    """Test getting generated schedule"""
    # First generate a schedule
    test_generate_schedule(client, session)
    
    # Get the schedule
    response = client.get('/api/schedules/')
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_export_schedule(client, session):
    """Test schedule export to PDF"""
    # First generate a schedule
    test_generate_schedule(client, session)
    
    # Export the schedule
    data = {
        'start_date': date.today().strftime('%Y-%m-%d'),
        'end_date': date.today().strftime('%Y-%m-%d')
    }
    
    response = client.post('/api/schedules/export', json=data)
    assert response.status_code == 200
    assert response.mimetype == 'application/pdf' 