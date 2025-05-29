import pytest
from src.backend.services.scheduler.resources import ScheduleResources
from src.backend.models import (
    db,
    Employee,
)  # Import db and Employee for potential future use in tests
from flask import current_app  # Import current_app here


def test_resource_loading_within_app_context(
    app, session
):  # Accept app and session fixtures
    """Test that ScheduleResources can load data within a Flask app context and basic session query works."""

    with app.app_context():  # Use the app fixture's context
        print(f"Current app within context: {current_app}")  # Print current_app
        print(
            f"Debug: db instance ID in test within app context: {id(db)}"
        )  # Debug print

        # Test a simple query using the session fixture
        try:
            employee_count = session.query(Employee).count()
            print(
                f"Debug: Successfully queried employee count using session fixture: {employee_count}"
            )
        except Exception as e:
            pytest.fail(f"Simple query using session fixture failed: {e}")

        resources = ScheduleResources()
        try:
            resources.load()
            # If load() completes without raising an exception, it means the DB access within it worked
            assert resources.is_loaded() is True
            print(
                "Resource loading test passed: Resources loaded successfully within app context."
            )
        except Exception as e:
            pytest.fail(f"Resource loading failed within app context: {e}")


# Note: This is a basic test. More comprehensive tests would involve
# populating a test database with mock data and asserting that the
# loaded resources have the expected data.
