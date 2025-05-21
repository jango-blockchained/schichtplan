import pytest
import json
from http import HTTPStatus
from src.backend.models import Coverage

# Use global app and session fixtures from conftest.py


@pytest.fixture
def coverage_item(session):
    """Fixture to create a new coverage requirement for testing."""
    coverage = Coverage(
        day_index=0,  # Monday
        start_time="08:00",
        end_time="12:00",
        min_employees=2,
        max_employees=4,
        employee_types=["VZ", "TZ"],
        requires_keyholder=True,
        keyholder_before_minutes=15,
        keyholder_after_minutes=15
    )
    session.add(coverage)
    session.commit()
    return coverage


def test_get_all_coverage(client, coverage_item):
    """Test GET /api/coverage/ endpoint for all coverage."""
    response = client.get('/api/coverage/')
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    # Check if the structure is grouped by day and contains the item
    assert any(
        day_data['dayIndex'] == 0 for day_data in data
    )
    day_zero_coverage = next(
        day_data for day_data in data if day_data['dayIndex'] == 0
    )
    assert any(
        slot['startTime'] == "08:00" for slot in day_zero_coverage['timeSlots']
    )


def test_get_coverage_by_day(client, coverage_item):
    """Test GET /api/coverage/<day_index> endpoint."""
    response = client.get(f'/api/coverage/{coverage_item.day_index}')
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(c['id'] == coverage_item.id for c in data)


def test_get_coverage_by_day_not_found(client):
    """Test GET /api/coverage/<day_index> for a day with no coverage."""
    response = client.get(
        '/api/coverage/6'
    )  # Assuming day 6 (Sunday) has no coverage initially
    assert response.status_code == HTTPStatus.OK  # Should return empty list,
    # not 404
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_create_coverage(client, session):
    """Test POST /api/coverage/ endpoint."""
    coverage_data = {
        'day_index': 1,  # Tuesday
        'start_time': '13:00',
        'end_time': '17:00',
        'min_employees': 3,
        'max_employees': 5,
        'employee_types': ["VZ"],
        'requires_keyholder': False,
        'keyholder_before_minutes': None,
        'keyholder_after_minutes': None
    }
    response = client.post('/api/coverage/', json=coverage_data)
    assert response.status_code == HTTPStatus.CREATED
    data = json.loads(response.data)
    assert data['day_index'] == 1
    assert data['start_time'] == '13:00'
    assert 'id' in data

    # Verify in database
    created_coverage = session.get(Coverage, data['id'])
    assert created_coverage is not None
    assert created_coverage.min_employees == 3


def test_update_coverage(client, session, coverage_item):
    """Test PUT /api/coverage/<coverage_id> endpoint."""
    update_data = {
        'min_employees': 3,
        'requires_keyholder': False,
        'employee_types': ["VZ", "TL"]
    }
    response = client.put(
        f'/api/coverage/{coverage_item.id}', json=update_data
    )
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data['min_employees'] == 3
    assert data['requires_keyholder'] is False
    assert data['employee_types'] == ["VZ", "TL"]

    # Verify in database
    updated_coverage = session.get(Coverage, coverage_item.id)
    assert updated_coverage is not None
    assert updated_coverage.min_employees == 3


def test_delete_coverage(client, session, coverage_item):
    """Test DELETE /api/coverage/<coverage_id> endpoint."""
    coverage_id = coverage_item.id
    response = client.delete(f'/api/coverage/{coverage_id}')
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Verify in database
    deleted_coverage = session.get(Coverage, coverage_id)
    assert deleted_coverage is None


def test_bulk_update_coverage(client, session, coverage_item):
    """Test POST /api/coverage/bulk endpoint."""
    # Initial item exists. We will replace all coverage with new data.
    bulk_data = [
        {
            'dayIndex': 0,
            'timeSlots': [
                {
                    'startTime': '07:00',
                    'endTime': '10:00',
                    'minEmployees': 1,
                    'maxEmployees': 2,
                    'employeeTypes': ["TL"],
                    'requiresKeyholder': True,
                    'keyholderBeforeMinutes': 30,
                    'keyholderAfterMinutes': 0
                }
            ]
        },
        {
            'dayIndex': 1,
            'timeSlots': [
                {
                    'startTime': '09:00',
                    'endTime': '17:00',
                    'minEmployees': 2,
                    'maxEmployees': 3,
                    'employeeTypes': ["VZ"],
                    'requiresKeyholder': False,
                    'keyholderBeforeMinutes': None,
                    'keyholderAfterMinutes': None
                }
            ]
        }
    ]

    response = client.post('/api/coverage/bulk', json=bulk_data)
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data['message'] == 'Coverage requirements updated successfully'

    # Verify in database - only the new items should exist
    all_coverage = session.query(Coverage).all()
    assert len(all_coverage) == 2  # One slot for day 0, one for day 1

    # Check content of the new items (basic checks)
    day_0_item = next(c for c in all_coverage if c.day_index == 0)
    assert day_0_item.start_time == '07:00'
    assert day_0_item.min_employees == 1

    day_1_item = next(c for c in all_coverage if c.day_index == 1)
    assert day_1_item.start_time == '09:00'
    assert day_1_item.min_employees == 2

#  Note: Add tests for invalid input and edge cases for full coverage.
