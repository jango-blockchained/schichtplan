import pytest
from backend.app import create_app
from models import db as _db
from sqlalchemy.orm import scoped_session, sessionmaker


@pytest.fixture(scope="session")
def app():
    """Create application for the tests."""
    _app = create_app()
    _app.config["TESTING"] = True
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
