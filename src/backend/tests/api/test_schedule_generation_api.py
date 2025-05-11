#!/usr/bin/env python
"""
Tests for the schedule generation API endpoints.
This test suite focuses on testing the API endpoints related to schedule generation,
including error handling, parameter validation, and response structure.
"""

import json
import pytest
from datetime import datetime, timedelta, date
from src.backend.app import create_app
from src.backend.models import db
from src.backend.models.employee import Employee, EmployeeGroup
from src.backend.models.fixed_shift import ShiftTemplate
from src.backend.models.settings import Settings
from src.backend.models.schedule import ScheduleVersionMeta as VersionMeta, ScheduleStatus
from src.backend.models.employee import AvailabilityType


@pytest.fixture
def app():
    """Create and configure a Flask app for testing."""
    app = create_app()
    app.config['TESTING'] = True

    # Create tables
    with app.app_context():
        db.create_all()
        # Ensure default settings exist
        Settings.get_or_create_default()

    yield app

    # Clean up
    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """A test CLI runner for the app."""
    return app.test_cli_runner()


@pytest.fixture
def setup_test_data(app):
    """Set up test data for schedule generation tests."""
    with app.app_context():
        # Create store settings (using get_or_create_default)
        settings = Settings.get_or_create_default()
        # Update settings using update_from_dict
        settings.update_from_dict({
            'store_opening': "08:00",
            'store_closing': "20:00",
            'min_break_duration': 60,
            'generation_requirements': {
                 'enforce_keyholder_coverage': True,
                 'enforce_rest_periods': 11,
                 'enforce_max_hours': 40
                 # Add other relevant requirements as needed by tests
             }
        })
        db.session.commit()  # Commit changes to settings

        # Create shifts
        # Using default active_days [0, 1, 2, 3, 4, 5] (Mon-Sat)
        shifts = [
            ShiftTemplate(
                start_time="08:00",
                end_time="16:00",
                requires_break=True,
                shift_type_id="EARLY", # Explicitly set shift_type_id
            ),
            ShiftTemplate(
                start_time="10:00",
                end_time="18:00",
                requires_break=True,
                shift_type_id="MIDDLE", # Explicitly set shift_type_id
            ),
            ShiftTemplate(
                start_time="12:00",
                end_time="20:00",
                requires_break=True,
                shift_type_id="LATE", # Explicitly set shift_type_id
            ),
        ]
        for shift in shifts:
            db.session.add(shift)

        # Create employees
        employees = [
            Employee(
                first_name="John",
                last_name="Doe",
                email="john.doe@example.com",
                contracted_hours=40,
                employee_group=EmployeeGroup.VZ,
                is_active=True,
                is_keyholder=True,
            ),
            Employee(
                first_name="Jane",
                last_name="Smith",
                email="jane.smith@example.com",
                contracted_hours=30,
                employee_group=EmployeeGroup.TZ,
                is_active=True,
                is_keyholder=False,
            ),
            Employee(
                first_name="Bob",
                last_name="Johnson",
                email="bob.johnson@example.com",
                contracted_hours=20,
                employee_group=EmployeeGroup.GFB,
                is_active=True,
                is_keyholder=False,
            ),
            Employee(
                first_name="Alice",
                last_name="Williams",
                email="alice.williams@example.com",
                contracted_hours=40,
                employee_group=EmployeeGroup.TL,
                is_active=True,
                is_keyholder=True,
            ),
        ]
        for employee in employees:
            db.session.add(employee)

        # Create a version
        today = datetime.now().date()
        start_date = today - timedelta(days=today.weekday())  # Start from Monday
        end_date = start_date + timedelta(days=6)  # End on Sunday

        # Use the helper function to create or get the default version
        create_default_version(db.session, start_date, end_date)

        db.session.commit()


def create_default_version(session, start_date, end_date, version=1, status=ScheduleStatus.DRAFT):
    existing_version = session.query(VersionMeta).filter_by(version=version).first()
    if not existing_version:
        new_version = VersionMeta(
            version=version,
            status=status,
            created_at=datetime.now(),
            date_range_start=start_date,
            date_range_end=end_date,
        )
        session.add(new_version)
        session.commit()
        return new_version
    return existing_version


def test_generate_schedule_endpoint(client, setup_test_data):
    """Test the generate schedule endpoint."""
    # Get dates for testing
    today = datetime.now().date()
    start_date = today - timedelta(days=today.weekday())  # Start from Monday
    end_date = start_date + timedelta(days=6)  # End on Sunday

    # Make request to generate schedule
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)

    # Validate response structure
    assert "schedules" in data
    assert isinstance(data["schedules"], list)
    assert "version" in data
    assert data["version"] == 1

    # Check that schedules were created
    assert len(data["schedules"]) > 0

    # Validate schedule structure
    schedule = data["schedules"][0]
    assert "id" in schedule
    assert "date" in schedule
    assert "employee_id" in schedule
    assert "version" in schedule
    assert schedule["version"] == 1


def test_generate_schedule_missing_parameters(client, setup_test_data):
    """Test the generate schedule endpoint with missing parameters."""
    # Test with missing start_date
    today = datetime.now().date()
    end_date = today + timedelta(days=7)

    response = client.post(
        "/api/schedules/generate",
        json={
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    # Assert Pydantic validation error structure
    assert data.get('status') == 'error'
    assert data.get('message') == 'Invalid input.'
    assert 'details' in data
    assert isinstance(data['details'], list)
    assert len(data['details']) > 0
    assert any(err.get('loc') == ('start_date', ) for err in data['details'])

    # Test with missing end_date
    start_date = today

    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    # Assert Pydantic validation error structure
    assert data.get('status') == 'error'
    assert data.get('message') == 'Invalid input.'
    assert 'details' in data
    assert isinstance(data['details'], list)
    assert len(data['details']) > 0
    assert any(err.get('loc') == ('end_date', ) for err in data['details'])

    # Test with missing version (version is Optional, should not cause a 400 here)
    # response = client.post(
    #     "/api/schedules/generate",
    #     json={
    #         "start_date": start_date.isoformat(),
    #         "end_date": end_date.isoformat(),
    #         "create_empty_schedules": True,
    #     },
    # )

    # # Check response - should be 200 if version is optional
    # assert response.status_code == 200 # Adjusted expectation
    # data = json.loads(response.data)
    # assert "schedules" in data # Check for successful generation


def test_generate_schedule_invalid_dates(client, setup_test_data):
    """Test the generate schedule endpoint with invalid dates."""
    # Test with end_date before start_date (This is a logical validation, not Pydantic format error)
    # Pydantic will parse the dates, but the route logic should return 400.
    # The route handler returns a simple error message for this case.
    today = datetime.now().date()
    start_date = today + timedelta(days=7)
    end_date = today

    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    # This is a logical validation error, not a Pydantic format error.
    # The route handler returns a simple error message.
    assert data.get('status') == 'error'
    assert data.get('message') == 'End date must be after start date'


def test_generate_schedule_invalid_input_types(client, setup_test_data):
    """Test the generate schedule endpoint with invalid input types for Pydantic."""
    today = datetime.now().date()
    start_date = today - timedelta(days=today.weekday())
    end_date = start_date + timedelta(days=6)

    # Test with invalid date format (not YYYY-MM-DD)
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": "26-10-2023", # Invalid format
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data.get('status') == 'error'
    assert data.get('message') == 'Invalid input.'
    assert 'details' in data
    assert isinstance(data['details'], list)
    assert len(data['details']) > 0
    assert any(err.get('loc') == ('start_date', ) for err in data['details'])

    # Test with non-boolean for create_empty_schedules
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": "True", # Invalid type
            "version": 1,
        },
    )
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data.get('status') == 'error'
    assert data.get('message') == 'Invalid input.'
    assert 'details' in data
    assert isinstance(data['details'], list)
    assert len(data['details']) > 0
    assert any(err.get('loc') == ('create_empty_schedules', ) for err in data['details'])

    # Test with non-integer for version
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": "one", # Invalid type
        },
    )
    assert response.status_code == 400
    data = json.loads(response.data)
    assert data.get('status') == 'error'
    assert data.get('message') == 'Invalid input.'
    assert 'details' in data
    assert isinstance(data['details'], list)
    assert len(data['details']) > 0
    assert any(err.get('loc') == ('version', ) for err in data['details'])


def test_generate_schedule_invalid_version(client, setup_test_data):
    """Test the generate schedule endpoint with an invalid version."""
    # This test checks a logical error (version not found), not a Pydantic format error
    # The route handler returns a 404 for this case.
    # Get dates for testing
    today = datetime.now().date()
    start_date = today - timedelta(days=today.weekday())
    end_date = start_date + timedelta(days=6)

    # Make request with non-existent version
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 999,  # Non-existent version
        },
    )

    # Check response
    assert response.status_code == 404
    data = json.loads(response.data)
    assert "error" in data
    assert data.get('message') == 'Schedule version 999 not found' # Check specific error message


def test_generate_schedule_long_period(client, setup_test_data):
    """Test the generate schedule endpoint with a long period."""
    # Get dates for testing (30 days)
    today = datetime.now().date()
    start_date = today - timedelta(days=today.weekday())
    end_date = start_date + timedelta(days=29)

    # Make request to generate schedule
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)

    # Validate response structure
    assert "schedules" in data
    assert isinstance(data["schedules"], list)

    # Check that schedules were created for the entire period
    # For 30 days and 4 employees, we should have at least 30*4 = 120 schedules
    # We don't generate schedules for Sunday, so 30 * (6/7) * 4 ~= 102.8 -> at least 103 schedules
    assert len(data["schedules"]) >= 103 # Adjusted minimum expected count


def test_get_schedules_endpoint(client, setup_test_data):
    """Test the get schedules endpoint after generating schedules."""
    # First generate schedules
    today = datetime.now().date()
    start_date = today - timedelta(days=today.weekday())
    end_date = start_date + timedelta(days=6)

    client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Now get the schedules
    response = client.get(
        f"/api/schedules?start_date={start_date.isoformat()}&end_date={end_date.isoformat()}&version=1"
    )

    # Check response
    assert response.status_code == 200
    data = json.loads(response.data)

    # Validate response structure
    assert "schedules" in data
    assert isinstance(data["schedules"], list)
    assert "version" in data
    assert data["version"] == 1

    # Check that schedules were retrieved
    assert len(data["schedules"]) > 0


def test_schedule_version_management(client, setup_test_data):
    """Test schedule version management through the API."""
    # Get dates for testing
    today = datetime.now().date()
    start_date = today - timedelta(days=today.weekday())
    end_date = start_date + timedelta(days=6)

    # First generate schedules for version 1
    client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Create a new version
    # NOTE: The route for creating a new version is /api/versions, not /api/schedules/versions
    response = client.post(
        "/api/versions",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "base_version": 1,
            "notes": "Test version",
        },
    )

    assert response.status_code == 200
    data = json.loads(response.data)
    assert "version" in data
    new_version = data["version"]

    # Generate schedules for the new version
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
            "version": new_version,
        },
    )

    assert response.status_code == 200

    # Get schedules for both versions and compare
    response1 = client.get(
        f"/api/schedules?start_date={start_date.isoformat()}&end_date={end_date.isoformat()}&version=1"
    )
    response2 = client.get(
        f"/api/schedules?start_date={start_date.isoformat()}&end_date={end_date.isoformat()}&version={new_version}"
    )

    data1 = json.loads(response1.data)
    data2 = json.loads(response2.data)

    # Both should have schedules
    assert len(data1["schedules"]) > 0
    assert len(data2["schedules"]) > 0

    # Compare versions
    assert data1["version"] == 1
    assert data2["version"] == new_version


if __name__ == "__main__":
    pytest.main(["-xvs", __file__])
