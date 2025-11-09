"""
Pytest configuration and fixtures for backend tests
"""

import pytest

from src.backend.app import create_app
from src.backend.models import db


@pytest.fixture
def app():
    """Create and configure a test Flask application"""
    app = create_app("testing")
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Create a test client"""
    return app.test_client()
