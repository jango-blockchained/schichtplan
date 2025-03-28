#!/usr/bin/env python
"""
Tests for the schedule generation API endpoints.
This test suite focuses on testing the API endpoints related to schedule generation,
including error handling, parameter validation, and response structure.
"""

import json
import pytest
from datetime import datetime, timedelta
from app import create_app
from models import db
from models.employee import Employee, EmployeeGroup
from models.fixed_shift import ShiftTemplate
from models.settings import Settings
from models.version import VersionMeta


@pytest.fixture
def app():
    """Create and configure a Flask app for testing."""
    app = create_app(testing=True)

    # Create tables
    with app.app_context():
        db.create_all()

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
        # Create store settings
        settings = Settings(
            store_opening="08:00",
            store_closing="20:00",
            break_duration_minutes=60,
            require_keyholder=True,
            min_rest_hours=11,
            max_weekly_hours=40,
        )
        db.session.add(settings)

        # Create shifts
        shifts = [
            ShiftTemplate(
                start_time="08:00",
                end_time="16:00",
                min_employees=2,
                max_employees=3,
                duration_hours=8,
                requires_break=True,
                active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
            ),
            ShiftTemplate(
                start_time="10:00",
                end_time="18:00",
                min_employees=2,
                max_employees=4,
                duration_hours=8,
                requires_break=True,
                active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
            ),
            ShiftTemplate(
                start_time="12:00",
                end_time="20:00",
                min_employees=2,
                max_employees=3,
                duration_hours=8,
                requires_break=True,
                active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
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

        version = VersionMeta(
            version=1,
            status="DRAFT",
            created_at=datetime.now(),
            date_range={"start": start_date.isoformat(), "end": end_date.isoformat()},
        )
        db.session.add(version)

        db.session.commit()


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


def test_generate_schedule_invalid_dates(client, setup_test_data):
    """Test the generate schedule endpoint with invalid dates."""
    # Test with end_date before start_date
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
    assert "error" in data


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
    assert "error" in data

    # Test with missing end_date
    start_date = today

    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "create_empty_schedules": True,
            "version": 1,
        },
    )

    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "error" in data

    # Test with missing version
    response = client.post(
        "/api/schedules/generate",
        json={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "create_empty_schedules": True,
        },
    )

    # Check response
    assert response.status_code == 400
    data = json.loads(response.data)
    assert "error" in data


def test_generate_schedule_invalid_version(client, setup_test_data):
    """Test the generate schedule endpoint with an invalid version."""
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
    assert len(data["schedules"]) >= 120


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
