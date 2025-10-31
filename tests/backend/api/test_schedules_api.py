import json
from datetime import date, datetime, timedelta
from http import HTTPStatus

import pytest

from src.backend.models import Schedule, ScheduleVersionMeta, db
from src.backend.models.schedule import ScheduleStatus


@pytest.fixture
def new_version_meta(session):
    """Fixture to create a new ScheduleVersionMeta for testing."""
    version_meta = ScheduleVersionMeta(
        version=1,
        created_at=datetime.utcnow(),
        status=ScheduleStatus.DRAFT,
        date_range_start=date.today(),
        date_range_end=date.today() + timedelta(days=6),
        notes="Test Version",
    )
    session.add(version_meta)
    session.commit()
    return version_meta


def test_get_schedules(client, session, new_version_meta):
    """Test GET /api/schedules endpoint."""
    today = date.today()
    start_date = today - timedelta(days=today.weekday())
    end_date = start_date + timedelta(days=6)

    response = client.get(
        f"/api/v2/schedules?start_date={start_date.isoformat()}&end_date={end_date.isoformat()}"
    )
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert isinstance(data["schedules"], list)
    assert isinstance(data["versions"], list)
    assert "current_version" in data
    assert "versions" in data  # API returns 'versions' not 'version_meta'


def test_get_schedule(client, session, new_version_meta):
    """Test GET /api/schedules/<schedule_id> endpoint."""
    # Create a test schedule first
    schedule = Schedule(
        employee_id=1,
        shift_id=1,
        date=date.today(),
        version=new_version_meta.version,
    )
    db.session.add(schedule)
    db.session.commit()

    response = client.get(f"/api/v2/schedules/{schedule.id}")
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data["id"] == schedule.id


def test_get_schedule_not_found(client, session):
    """Test GET /api/schedules/<schedule_id> with non-existent ID."""
    response = client.get("/api/v2/schedules/999")  # Assuming 999 does not exist
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_create_schedule(client, session, new_version_meta):
    """Test creating a schedule via PUT /api/schedules/0."""
    schedule_data = {
        "employee_id": 1,
        "shift_id": 1,
        "date": date.today().isoformat(),
        "version": new_version_meta.version,
        "notes": "New Schedule",
        "availability_type": "AVAILABLE",
    }
    response = client.put("/api/v2/schedules/0", json=schedule_data)
    assert (
        response.status_code == HTTPStatus.OK
    )  # Or HTTPStatus.CREATED depending on implementation
    data = json.loads(response.data)
    assert data["employee_id"] == 1
    # API returns datetime with time, so check it starts with the date
    assert data["date"].startswith(date.today().isoformat())
    assert "id" in data

    # Verify in database
    created_schedule = db.session.get(Schedule, data["id"])
    assert created_schedule is not None
    assert created_schedule.version == new_version_meta.version


def test_update_schedule(client, session, new_version_meta):
    """Test updating an existing schedule via PUT /api/schedules/<schedule_id>."""
    # Create a test schedule first
    schedule = Schedule(
        employee_id=1,
        shift_id=1,
        date=date.today(),
        version=new_version_meta.version,
    )
    db.session.add(schedule)
    db.session.commit()

    update_data = {"shift_id": 2, "notes": "Updated Notes"}
    response = client.put(f"/api/v2/schedules/{schedule.id}", json=update_data)
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data["shift_id"] == 2
    assert data["notes"] == "Updated Notes"

    # Verify in database
    updated_schedule = db.session.get(Schedule, schedule.id)
    assert updated_schedule is not None
    assert updated_schedule.shift_id == 2
    assert updated_schedule.notes == "Updated Notes"


def test_delete_schedule(client, session, new_version_meta):
    """Test DELETE /api/schedules/<schedule_id> endpoint."""
    # Create a test schedule first
    schedule = Schedule(
        employee_id=1,
        shift_id=1,
        date=date.today(),
        version=new_version_meta.version,
    )
    db.session.add(schedule)
    db.session.commit()
    schedule_id = schedule.id

    response = client.delete(f"/api/v2/schedules/{schedule_id}")
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Verify in database
    deleted_schedule = db.session.get(Schedule, schedule_id)
    assert deleted_schedule is None


# Note: Tests for /api/schedules/generate, /api/schedules/versions, /api/schedules/version/* endpoints still need to be added.
