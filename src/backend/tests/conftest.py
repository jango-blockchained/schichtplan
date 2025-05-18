import pytest
import os
import sys

# Add the parent directory to the Python path
# sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.backend.app import create_app
from src.backend.models import db as _db
from sqlalchemy.orm import scoped_session, sessionmaker
from src.backend.models.employee import Employee, EmployeeGroup, EmployeeAvailability, AvailabilityType
from datetime import date


@pytest.fixture(scope="session")
def app():
    """Create application for the tests."""
    _app = create_app()
    _app.config["TESTING"] = False
    _app.config["PROPAGATE_EXCEPTIONS"] = True
    _app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    # Other test config setup here
    return _app


@pytest.fixture(scope="session")
def db(app):
    """Create database for the tests."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.drop_all()


@pytest.fixture(scope="function")
def session(db, app):
    """Create a new database session for a test."""
    with app.app_context():
        connection = db.engine.connect()
        transaction = connection.begin()

        # Create a session factory bound to this connection
        session_factory = sessionmaker(bind=connection)
        session = scoped_session(session_factory)

        # Use this session instead of db.session
        db.session = session

        yield session

        session.remove()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create a test runner for the app's CLI commands."""
    return app.test_cli_runner()


@pytest.fixture
def new_employee(session):
    """Create and return a new Employee object for testing."""
    employee = Employee(
        first_name="Test",
        last_name="User",
        employee_group=EmployeeGroup.VZ,
        contracted_hours=40.0,
        is_keyholder=False,
        is_active=True,
        birthday=date(1990, 1, 1),
        email="testuser@example.com",
        phone="1234567890"
    )
    session.add(employee)
    session.commit()
    return employee


@pytest.fixture
def new_availability(session, new_employee):
    """Create and return a new EmployeeAvailability object for testing."""
    availability = EmployeeAvailability(
        employee_id=new_employee.id,
        day_of_week=0,  # Monday
        hour=8,
        is_available=True,
        availability_type=AvailabilityType.AVAILABLE
    )
    session.add(availability)
    session.commit()
    return availability
