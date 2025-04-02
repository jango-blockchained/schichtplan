import pytest
import os
import sys

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from models import db as _db
from sqlalchemy.orm import scoped_session, sessionmaker


@pytest.fixture(scope="session")
def app():
    """Create application for the tests."""
    # Use an in-memory SQLite database for tests
    os.environ["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    os.environ["TESTING"] = "True"
    os.environ["FLASK_ENV"] = "testing"
    
    _app = create_app(testing=True)
    _app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "SERVER_NAME": "localhost:5000",
    })

    # Create application context
    with _app.app_context():
        yield _app


@pytest.fixture(scope="session")
def db(app):
    """Create database for the tests."""
    with app.app_context():
        # Drop all tables first in case there are any existing tables
        _db.drop_all()
        
        # Create all tables
        _db.create_all()
        
        # Create default test data if needed
        try:
            # Create a default settings object
            from models.settings import Settings
            settings = Settings()
            _db.session.add(settings)
            _db.session.commit()
        except Exception as e:
            print(f"Error creating default test data: {e}")
            _db.session.rollback()
        
        yield _db
        
        # Clean up after tests
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="function")
def session(db, app):
    """Create a new database session for a test."""
    with app.app_context():
        # Create a new connection and transaction
        connection = db.engine.connect()
        transaction = connection.begin()

        # Create a session factory bound to this connection
        session_factory = sessionmaker(bind=connection)
        session = scoped_session(session_factory)

        # Use this session instead of db.session
        old_session = db.session
        db.session = session

        try:
            yield session
        finally:
            # Rollback the transaction and restore the original session
            if transaction.is_active:
                transaction.rollback()
            
            # Restore the original session
            db.session = old_session

            # Close the session and connection
            session.remove()
            connection.close()


@pytest.fixture
def client(app):
    """Create a test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create a test runner for the app's CLI commands."""
    return app.test_cli_runner()
