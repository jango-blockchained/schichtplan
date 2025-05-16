import pytest
from http import HTTPStatus
from src.backend.models import EmployeeAvailability, db
from src.backend.models.employee import AvailabilityType
from datetime import datetime

def test_create_availability_valid(client, new_employee):
    """Test creating a valid availability record."""
    availability_data = {
        'employee_id': new_employee.id,
        'day_of_week': 0, # Monday
        'hour': 9,
        'is_available': True,
        'availability_type': 'AVAILABLE'
    }
    response = client.post('/api/availability/', json=availability_data)
    assert response.status_code == HTTPStatus.CREATED
    data = response.get_json()
    assert data['employee_id'] == new_employee.id
    assert data['day_of_week'] == 0
    assert data['hour'] == 9
    assert data['is_available'] is True
    assert data['availability_type'] == 'AVAILABLE'

    # Verify in database
    availability = EmployeeAvailability.query.filter_by(employee_id=new_employee.id, day_of_week=0, hour=9).first()
    assert availability is not None
    assert availability.is_available is True
    assert availability.availability_type == AvailabilityType.AVAILABLE

def test_create_availability_invalid_data(client, new_employee):
    """Test creating an availability record with invalid data (e.g., missing fields)."""
    availability_data = {
        'employee_id': new_employee.id,
        'day_of_week': 0, # Monday
        # hour is missing
        'is_available': True,
        'availability_type': 'AVAILABLE'
    }
    response = client.post('/api/availability/', json=availability_data)
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data

def test_update_availability_valid(client, new_employee, new_availability):
    """Test updating an existing availability record with valid data."""
    update_data = {
        'is_available': False,
        'availability_type': 'FIXED'
    }
    response = client.put(f'/api/availability/{new_availability.id}', json=update_data)
    assert response.status_code == HTTPStatus.OK
    data = response.get_json()
    assert data['is_available'] is False
    assert data['availability_type'] == 'FIXED'

    # Verify in database
    updated_availability = EmployeeAvailability.query.get(new_availability.id)
    assert updated_availability is not None # Ensure the availability was found
    assert updated_availability.is_available is False
    assert updated_availability.availability_type == AvailabilityType.FIXED

def test_update_availability_invalid_data(client, new_availability):
    """Test updating an availability record with invalid data."""
    update_data = {
        'employee_id': 'not an integer' # Invalid type
    }
    response = client.put(f'/api/availability/{new_availability.id}', json=update_data)
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data

def test_check_availability_available(client, new_employee, new_availability):
    """Test checking availability for an employee who is available."""
    # Assume new_availability marks employee as available for day_of_week=1, hour=10
    check_data = {
        'employee_id': new_employee.id,
        'date': '2024-10-29', # A Tuesday (weekday 1)
        'hour': 10
    }
    response = client.post('/api/availability/check', json=check_data)
    assert response.status_code == HTTPStatus.OK
    data = response.get_json()
    assert data['is_available'] is True

def test_check_availability_unavailable(client, new_employee):
    """Test checking availability for an employee who is unavailable."""
    # Create an unavailability record for a specific time
    unavailability = EmployeeAvailability(
        employee_id=new_employee.id,
        day_of_week=1, # Tuesday
        hour=11,
        is_available=False,
        availability_type=AvailabilityType.UNAVAILABLE # Or any type indicating unavailability
    )
    db.session.add(unavailability)
    db.session.commit()

    check_data = {
        'employee_id': new_employee.id,
        'date': '2024-10-29', # A Tuesday (weekday 1)
        'hour': 11
    }
    response = client.post('/api/availability/check', json=check_data)
    assert response.status_code == HTTPStatus.OK
    data = response.get_json()
    assert data['is_available'] is False
    assert 'reason' in data

def test_check_availability_invalid_data(client, new_employee):
    """Test checking availability with invalid input data."""
    check_data = {
        'employee_id': new_employee.id,
        'date': 'not a date',
        'hour': 10
    }
    response = client.post('/api/availability/check', json=check_data)
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data

def test_update_employee_availabilities_valid(client, new_employee, setup_db):
    """Test updating an employee's availabilities with valid data."""
    # Add some initial availabilities to be replaced
    initial_availabilities = [
        EmployeeAvailability(employee_id=new_employee.id, day_of_week=0, hour=8, is_available=True, availability_type=AvailabilityType.AVAILABLE),
        EmployeeAvailability(employee_id=new_employee.id, day_of_week=0, hour=9, is_available=False, availability_type=AvailabilityType.UNAVAILABLE)
    ]
    db.session.add_all(initial_availabilities)
    db.session.commit()

    update_data = [
        {
            'day_of_week': 0, # Monday
            'hour': 8,
            'is_available': False,
            'availability_type': 'FIXED'
        },
        {
            'day_of_week': 1, # Tuesday
            'hour': 10,
            'is_available': True,
            'availability_type': 'PREF'
        }
    ]

    response = client.put(f'/api/availability/employees/{new_employee.id}/availabilities', json=update_data)
    assert response.status_code == HTTPStatus.OK
    data = response.get_json()
    assert data['message'] == 'Availabilities updated successfully'

    # Verify in database
    updated_availabilities = EmployeeAvailability.query.filter_by(employee_id=new_employee.id).all()
    assert len(updated_availabilities) == 2

    # Check the updated records - order might not be guaranteed, so check by content
    updated_data_in_db = [{
        'day_of_week': a.day_of_week,
        'hour': a.hour,
        'is_available': a.is_available,
        'availability_type': a.availability_type.value
    } for a in updated_availabilities]

    # Sort both lists for reliable comparison
    updated_data_in_db.sort(key=lambda x: (x['day_of_week'], x['hour']))
    update_data_sorted = sorted(update_data, key=lambda x: (x['day_of_week'], x['hour']))
    assert updated_data_in_db == update_data_sorted

def test_update_employee_availabilities_invalid_data(client, new_employee):
    """Test updating an employee's availabilities with invalid data."""
    invalid_data = [
        {
            'day_of_week': 0,
            'hour': 8,
            'is_available': True,
            'availability_type': 'INVALID_TYPE' # Invalid enum value
        }
    ]
    response = client.put(f'/api/availability/employees/{new_employee.id}/availabilities', json=invalid_data)
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data

def test_get_employee_status_by_date_valid(client, new_employee, setup_db):
    """Test getting employee status by date with valid date parameter."""
    # Assuming there's data setup by setup_db or other fixtures
    valid_date = '2024-11-01' # Use a specific date for testing
    response = client.get(f'/api/availability/by_date?date={valid_date}')
    assert response.status_code == HTTPStatus.OK
    data = response.get_json()
    assert isinstance(data, list)
    # Add more assertions here to check the structure/content of the response if needed

def test_get_employee_status_by_date_invalid_date(client):
    """Test getting employee status by date with invalid date parameter."""
    invalid_date = 'not-a-date'
    response = client.get(f'/api/availability/by_date?date={invalid_date}')
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data

def test_get_employee_status_by_date_missing_date(client):
    """Test getting employee status by date with missing date parameter."""
    response = client.get('/api/availability/by_date')
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data
    assert 'date' in data['details'][0]['loc']

def test_get_shifts_for_employee_valid(client, new_employee, setup_db):
    """Test getting shifts for an employee on a date with valid parameters."""
    valid_date = '2024-11-01'
    response = client.get(f'/api/availability/shifts_for_employee?date={valid_date}&employee_id={new_employee.id}')
    assert response.status_code == HTTPStatus.OK
    data = response.get_json()
    assert isinstance(data, list)
    # Add more assertions here to check the structure/content of the response if needed

def test_get_shifts_for_employee_invalid_date(client, new_employee):
    """Test getting shifts for an employee on a date with invalid date parameter."""
    invalid_date = 'not-a-date'
    response = client.get(f'/api/availability/shifts_for_employee?date={invalid_date}&employee_id={new_employee.id}')
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data

def test_get_shifts_for_employee_invalid_employee_id(client):
    """Test getting shifts for an employee on a date with invalid employee_id parameter."""
    valid_date = '2024-11-01'
    invalid_employee_id = 'not-an-integer'
    response = client.get(f'/api/availability/shifts_for_employee?date={valid_date}&employee_id={invalid_employee_id}')
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data

def test_get_shifts_for_employee_missing_params(client):
    """Test getting shifts for an employee on a date with missing parameters."""
    # Missing date
    response = client.get(f'/api/availability/shifts_for_employee?employee_id=1')
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data
    assert 'date' in data['details'][0]['loc']

    # Missing employee_id
    response = client.get(f'/api/availability/shifts_for_employee?date=2024-11-01')
    assert response.status_code == HTTPStatus.BAD_REQUEST
    data = response.get_json()
    assert 'Invalid input' in data['message']
    assert 'details' in data
    assert 'employee_id' in data['details'][0]['loc']

# Fixtures (assuming these exist or will be created elsewhere)
# @pytest.fixture
# def new_employee():
#     # Code to create and return a new employee object
#     pass

# @pytest.fixture
# def new_availability(new_employee):
#     # Code to create and return a new availability object
#     pass

# @pytest.fixture(scope='module')
# def client():
#     # Code to setup Flask test client with app context
#     pass

# @pytest.fixture(scope='function')
# def setup_db():
#     # Code to setup and teardown database for each test
#     pass 