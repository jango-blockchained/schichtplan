"""
API integration tests for keyholder endpoints

Tests cover:
- GET /api/v2/schedules/keyholder/paired-shift endpoint
- Keyholder validation in POST/PUT schedule operations
- Error responses and status codes
"""

from datetime import datetime

import pytest

from src.backend.models import db
from src.backend.models.employee import Employee
from src.backend.models.schedule import Schedule
from src.backend.models.settings import Settings


@pytest.fixture
def test_employee(app):
    """Create a test employee"""
    with app.app_context():
        employee = Employee(
            first_name="Test",
            last_name="Employee",
            email="test@example.com",
            phone="1234567890",
            employee_group="VZ",
            contracted_hours=40,
            is_keyholder=True,
            is_active=True,
        )
        db.session.add(employee)
        db.session.commit()
        yield employee
        db.session.delete(employee)
        db.session.commit()


@pytest.fixture
def test_settings(app):
    """Create test settings"""
    with app.app_context():
        settings = Settings.query.first()
        if not settings:
            settings = Settings(
                store_name="Test Store",
                store_opening="09:00",
                store_closing="20:00",
                keyholder_before_minutes=30,
                keyholder_after_minutes=30,
                opening_days={
                    "monday": True,
                    "tuesday": True,
                    "wednesday": True,
                    "thursday": True,
                    "friday": True,
                    "saturday": True,
                    "sunday": False,
                },
            )
            db.session.add(settings)
            db.session.commit()
        yield settings


class TestPairedShiftEndpoint:
    """Test GET /api/v2/schedules/keyholder/paired-shift endpoint"""

    def test_get_paired_shift_with_existing_pair(
        self, client, test_employee, test_settings
    ):
        """Test getting paired shift when it exists"""
        monday = datetime(2025, 11, 10)
        tuesday = datetime(2025, 11, 11)

        # Create closing shift on Monday
        schedule1 = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=monday,
            version=1,
            shift_start="13:00",
            shift_end="20:00",
            is_keyholder_shift=True,
        )
        # Create opening shift on Tuesday
        schedule2 = Schedule(
            employee_id=test_employee.id,
            shift_id=2,
            date=tuesday,
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        db.session.add_all([schedule1, schedule2])
        db.session.commit()

        # Request paired shift for closing shift
        response = client.post(
            "/api/v2/schedules/keyholder/paired-shift",
            json={
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "13:00",
                "shift_end": "20:00",
            },
        )

        assert response.status_code == 200
        data = response.get_json()

        assert data["schedule_id"] == schedule2.id
        assert data["date"] == "2025-11-11"
        assert data["shift_type"] == "opening"
        assert data["employee"]["first_name"] == "Test"
        assert data["employee"]["last_name"] == "Employee"
        assert data.get("missing") is None

    def test_get_paired_shift_missing(self, client, test_employee, test_settings):
        """Test getting paired shift when it doesn't exist"""
        monday = datetime(2025, 11, 10)

        # Create only closing shift (no paired opening)
        schedule = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=monday,
            version=1,
            shift_start="13:00",
            shift_end="20:00",
            is_keyholder_shift=True,
        )
        db.session.add(schedule)
        db.session.commit()

        # Request paired shift
        response = client.post(
            "/api/v2/schedules/keyholder/paired-shift",
            json={
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "13:00",
                "shift_end": "20:00",
            },
        )

        assert response.status_code == 200
        data = response.get_json()

        assert data["shift_type"] == "opening"
        assert data["date"] == "2025-11-11"
        assert data["missing"] is True
        assert data.get("schedule_id") is None

    def test_get_paired_shift_non_keyholder(self, client, test_settings):
        """Test paired shift request for non-keyholder shift"""
        response = client.post(
            "/api/v2/schedules/keyholder/paired-shift",
            json={
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "11:00",  # Not opening
                "shift_end": "19:00",  # Not closing
            },
        )

        # Should return 404 or null response
        assert response.status_code in [200, 404]

    def test_get_paired_shift_skip_sunday(self, client, test_employee, test_settings):
        """Test paired shift correctly skips closed Sunday"""
        saturday = datetime(2025, 11, 15)  # Saturday
        monday = datetime(2025, 11, 17)  # Monday

        # Create closing on Saturday
        schedule1 = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=saturday,
            version=1,
            shift_start="13:00",
            shift_end="20:00",
            is_keyholder_shift=True,
        )
        # Create opening on Monday (skipping Sunday)
        schedule2 = Schedule(
            employee_id=test_employee.id,
            shift_id=2,
            date=monday,
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        db.session.add_all([schedule1, schedule2])
        db.session.commit()

        # Request paired shift for Saturday closing
        response = client.post(
            "/api/v2/schedules/keyholder/paired-shift",
            json={
                "date": "2025-11-15",
                "version": 1,
                "shift_start": "13:00",
                "shift_end": "20:00",
            },
        )

        assert response.status_code == 200
        data = response.get_json()

        # Should find Monday's opening (skipping Sunday)
        assert data["date"] == "2025-11-17"
        assert data["missing"] is None

    def test_get_paired_shift_invalid_data(self, client):
        """Test paired shift request with invalid data"""
        response = client.post(
            "/api/v2/schedules/keyholder/paired-shift",
            json={
                "date": "invalid-date",
                "version": 1,
                "shift_start": "09:00",
                "shift_end": "17:00",
            },
        )

        assert response.status_code in [400, 422]

    def test_get_paired_shift_missing_params(self, client):
        """Test paired shift request with missing parameters"""
        response = client.post(
            "/api/v2/schedules/keyholder/paired-shift",
            json={
                "date": "2025-11-10",
                # Missing version, shift_start, shift_end
            },
        )

        assert response.status_code in [400, 422]


class TestScheduleCreationValidation:
    """Test keyholder validation during schedule creation"""

    def test_create_first_keyholder_success(self, client, test_employee, test_settings):
        """Test creating first keyholder shift succeeds"""
        response = client.post(
            "/api/v2/schedules",
            json={
                "employee_id": test_employee.id,
                "shift_id": 1,
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "09:00",
                "shift_end": "17:00",
                "is_keyholder_shift": True,
            },
        )

        assert response.status_code == 201
        data = response.get_json()
        assert data["is_keyholder_shift"] is True

    def test_create_duplicate_keyholder_rejected(
        self, client, test_employee, test_settings
    ):
        """Test creating duplicate keyholder shift is rejected"""
        # Create first keyholder
        schedule = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        db.session.add(schedule)
        db.session.commit()

        # Try to create second keyholder
        response = client.post(
            "/api/v2/schedules",
            json={
                "employee_id": test_employee.id,
                "shift_id": 2,
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "09:00",
                "shift_end": "17:00",
                "is_keyholder_shift": True,
            },
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "already a keyholder" in data.get("error", "").lower()

    def test_create_middle_shift_keyholder_rejected(
        self, client, test_employee, test_settings
    ):
        """Test creating keyholder on non-opening/closing shift rejected"""
        response = client.post(
            "/api/v2/schedules",
            json={
                "employee_id": test_employee.id,
                "shift_id": 1,
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "11:00",  # Not opening
                "shift_end": "19:00",  # Not closing
                "is_keyholder_shift": True,
            },
        )

        assert response.status_code == 400
        data = response.get_json()
        assert (
            "opening" in data.get("error", "").lower()
            or "closing" in data.get("error", "").lower()
        )


class TestScheduleUpdateValidation:
    """Test keyholder validation during schedule updates"""

    def test_update_to_keyholder_success(self, client, test_employee, test_settings):
        """Test updating non-keyholder shift to keyholder succeeds"""
        # Create non-keyholder shift
        schedule = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=False,
        )
        db.session.add(schedule)
        db.session.commit()

        # Update to keyholder
        response = client.put(
            f"/api/v2/schedules/{schedule.id}",
            json={
                "is_keyholder_shift": True,
            },
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["is_keyholder_shift"] is True

    def test_update_keyholder_to_non_keyholder(
        self, client, test_employee, test_settings
    ):
        """Test updating keyholder shift to non-keyholder succeeds"""
        # Create keyholder shift
        schedule = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        db.session.add(schedule)
        db.session.commit()

        # Update to non-keyholder
        response = client.put(
            f"/api/v2/schedules/{schedule.id}",
            json={
                "is_keyholder_shift": False,
            },
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data["is_keyholder_shift"] is False

    def test_update_creates_duplicate_keyholder_rejected(
        self, client, test_employee, test_settings
    ):
        """Test update that would create duplicate keyholder is rejected"""
        # Create first keyholder
        schedule1 = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        # Create second non-keyholder
        schedule2 = Schedule(
            employee_id=test_employee.id,
            shift_id=2,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=False,
        )
        db.session.add_all([schedule1, schedule2])
        db.session.commit()

        # Try to update second shift to keyholder (would create duplicate)
        response = client.put(
            f"/api/v2/schedules/{schedule2.id}",
            json={
                "is_keyholder_shift": True,
            },
        )

        assert response.status_code == 400
        data = response.get_json()
        assert "already a keyholder" in data.get("message", "").lower()

    def test_update_same_schedule_allowed(self, client, test_employee, test_settings):
        """Test updating keyholder schedule doesn't conflict with itself"""
        # Create keyholder shift
        schedule = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        db.session.add(schedule)
        db.session.commit()

        # Update other fields without changing keyholder flag
        response = client.put(
            f"/api/v2/schedules/{schedule.id}",
            json={
                "shift_start": "08:30",  # Change time
                "is_keyholder_shift": True,  # Keep keyholder status
            },
        )

        assert response.status_code == 200


class TestKeyholderEdgeCases:
    """Test edge cases in keyholder API operations"""

    def test_version_isolation(self, client, test_employee, test_settings):
        """Test keyholders in different versions don't conflict"""
        # Create keyholder in version 1
        schedule1 = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        db.session.add(schedule1)
        db.session.commit()

        # Create keyholder in version 2 (should succeed)
        response = client.post(
            "/api/v2/schedules",
            json={
                "employee_id": test_employee.id,
                "shift_id": 2,
                "date": "2025-11-10",
                "version": 2,  # Different version
                "shift_start": "09:00",
                "shift_end": "17:00",
                "is_keyholder_shift": True,
            },
        )

        assert response.status_code == 201

    def test_opening_and_closing_same_day(self, client, test_employee, test_settings):
        """Test creating both opening and closing keyholder same day"""
        # Create opening keyholder
        response1 = client.post(
            "/api/v2/schedules",
            json={
                "employee_id": test_employee.id,
                "shift_id": 1,
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "09:00",
                "shift_end": "17:00",
                "is_keyholder_shift": True,
            },
        )
        assert response1.status_code == 201

        # Create closing keyholder (should succeed)
        response2 = client.post(
            "/api/v2/schedules",
            json={
                "employee_id": test_employee.id,
                "shift_id": 2,
                "date": "2025-11-10",
                "version": 1,
                "shift_start": "13:00",
                "shift_end": "20:00",
                "is_keyholder_shift": True,
            },
        )
        assert response2.status_code == 201

    def test_delete_keyholder_shift(self, client, test_employee, test_settings):
        """Test deleting keyholder shift"""
        # Create keyholder shift
        schedule = Schedule(
            employee_id=test_employee.id,
            shift_id=1,
            date=datetime(2025, 11, 10),
            version=1,
            shift_start="09:00",
            shift_end="17:00",
            is_keyholder_shift=True,
        )
        db.session.add(schedule)
        db.session.commit()

        # Delete shift
        response = client.delete(f"/api/v2/schedules/{schedule.id}")
        assert response.status_code == 204

        # Verify deleted
        deleted = Schedule.query.get(schedule.id)
        assert deleted is None
