import pytest
import json
from http import HTTPStatus
from src.backend.app import create_app
from src.backend.models import db, ShiftTemplate
from datetime import time


@pytest.fixture
def app():
    """Create and configure a Flask app for testing."""
    app = create_app()
    app.config["TESTING"] = True

    # Use in-memory SQLite for testing
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    with app.app_context():
        db.create_all()

    yield app

    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def setup_db(app):
    """Fixture to set up and tear down the database for each test function."""
    with app.app_context():
        db.create_all()
        yield db
        db.drop_all()


@pytest.fixture
def new_shift(setup_db):
    """Fixture to create a new shift template for testing."""
    shift = ShiftTemplate(
        start_time="08:00",
        end_time="16:00",
        requires_break=True,
        active_days=[0, 1, 2, 3, 4],  # Mon-Fri
        shift_type_id="EARLY",
    )
    db.session.add(shift)
    db.session.commit()
    return shift


def test_get_shifts(client, setup_db, new_shift):
    """Test GET /shifts endpoint."""
    response = client.get("/shifts")
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    # Basic check for presence of the created shift
    assert any(s["id"] == new_shift.id for s in data)


def test_get_single_shift(client, setup_db, new_shift):
    """Test GET /shifts/<shift_id> endpoint."""
    response = client.get(f"/shifts/{new_shift.id}")
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data["id"] == new_shift.id
    assert data["start_time"] == "08:00"


def test_get_single_shift_not_found(client, setup_db):
    """Test GET /shifts/<shift_id> with non-existent ID."""
    response = client.get("/shifts/999")  # Assuming 999 does not exist
    assert response.status_code == HTTPStatus.NOT_FOUND


def test_create_shift(client, setup_db):
    """Test POST /shifts endpoint."""
    shift_data = {
        "start_time": "10:00",
        "end_time": "18:00",
        "requires_break": False,
        "active_days": [1, 2, 3, 4],  # Tue-Fri
        "shift_type_id": "MIDDLE",
    }
    response = client.post("/shifts", json=shift_data)
    assert response.status_code == HTTPStatus.CREATED
    data = json.loads(response.data)
    assert data["start_time"] == "10:00"
    assert data["shift_type_id"] == "MIDDLE"
    assert "id" in data

    # Verify in database
    created_shift = db.session.get(ShiftTemplate, data["id"])
    assert created_shift is not None
    assert created_shift.start_time == time(10, 0)
    assert created_shift.active_days == [1, 2, 3, 4]


def test_update_shift(client, setup_db, new_shift):
    """Test PUT /shifts/<shift_id> endpoint."""
    update_data = {
        "end_time": "17:00",
        "requires_break": False,
        "active_days": [0, 1, 2, 3, 4, 5, 6],  # Every day
    }
    response = client.put(f"/shifts/{new_shift.id}", json=update_data)
    assert response.status_code == HTTPStatus.OK
    data = json.loads(response.data)
    assert data["end_time"] == "17:00"
    assert data["requires_break"] is False

    # Verify in database
    updated_shift = db.session.get(ShiftTemplate, new_shift.id)
    assert updated_shift is not None
    assert updated_shift.end_time == time(17, 0)
    assert updated_shift.requires_break is False
    assert updated_shift.active_days == [0, 1, 2, 3, 4, 5, 6]


def test_delete_shift(client, setup_db, new_shift):
    """Test DELETE /shifts/<shift_id> endpoint."""
    shift_id = new_shift.id
    response = client.delete(f"/shifts/{shift_id}")
    assert response.status_code == HTTPStatus.NO_CONTENT

    # Verify in database
    deleted_shift = db.session.get(ShiftTemplate, shift_id)
    assert deleted_shift is None


# Note: Additional tests for invalid input, edge cases, etc., should be added for full coverage.
