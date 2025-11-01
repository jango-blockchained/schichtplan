import pytest
import json
from http import HTTPStatus
from src.backend.models import db, ShiftTemplate
from datetime import time


@pytest.fixture
def new_shift(session):
    """Fixture to create a new shift template for testing."""
    shift = ShiftTemplate(
        start_time="08:00",
        end_time="16:00",
        requires_break=True,
        active_days=[0, 1, 2, 3, 4],  # Mon-Fri
        shift_type_id="EARLY",
    )
    session.add(shift)
    session.commit()
    return shift


def test_get_shifts(client, session, new_shift):
    """Test GET /shifts endpoint."""
    response = client.get("/api/v2/shifts")
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    # Basic check for presence of the created shift
    assert any(s["id"] == new_shift.id for s in data)


def test_get_single_shift(client, session, new_shift):
    """Test GET /shifts/<shift_id> endpoint."""
    response = client.get(f"/api/v2/shifts/{new_shift.id}")
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data["id"] == new_shift.id
    assert data["start_time"] == "08:00"


def test_get_single_shift_not_found(client, session):
    """Test GET /shifts/<shift_id> with non-existent ID."""
    response = client.get("/api/v2/shifts/999")  # Assuming 999 does not exist
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_create_shift(client, session):
    """Test POST /shifts endpoint."""
    shift_data = {
        "start_time": "10:00",
        "end_time": "18:00",
        "requires_break": False,
        "active_days": [1, 2, 3, 4],  # Tue-Fri
        "shift_type_id": "MIDDLE",
    }
    response = client.post("/api/v2/shifts", json=shift_data)
    assert response.status_code == HTTPStatus.CREATED
    data = json.loads(response.data)
    assert data["start_time"] == "10:00"
    assert data["shift_type_id"] == "MIDDLE"
    assert "id" in data

    # Verify in database
    created_shift = db.session.get(ShiftTemplate, data["id"])
    assert created_shift is not None
    assert created_shift.start_time == "10:00"
    assert created_shift.active_days == [1, 2, 3, 4]


def test_update_shift(client, session, new_shift):
    """Test PUT /shifts/<shift_id> endpoint."""
    update_data = {
        "end_time": "17:00",
        "requires_break": False,
        "active_days": [0, 1, 2, 3, 4, 5, 6],  # Every day
    }
    response = client.put(f"/api/v2/shifts/{new_shift.id}", json=update_data)
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data["end_time"] == "17:00"
    assert data["requires_break"] is False

    # Verify in database
    updated_shift = db.session.get(ShiftTemplate, new_shift.id)
    assert updated_shift is not None
    assert updated_shift.end_time == "17:00"
    assert updated_shift.requires_break is False
    assert updated_shift.active_days == [0, 1, 2, 3, 4, 5, 6]


def test_delete_shift(client, session, new_shift):
    """Test DELETE /shifts/<shift_id> endpoint."""
    shift_id = new_shift.id
    response = client.delete(f"/api/v2/shifts/{shift_id}")
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Verify in database
    deleted_shift = db.session.get(ShiftTemplate, shift_id)
    assert deleted_shift is None


# Note: Additional tests for invalid input, edge cases, etc., should be added for full coverage.
