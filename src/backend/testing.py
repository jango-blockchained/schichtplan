"""
Testing utilities and fixtures for the backend.
This module provides common testing utilities that are shared across test files.
"""

import os
from pathlib import Path

from src.backend.config import Config


class TestingConfig(Config):
    """Configuration for testing environment."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SECRET_KEY = 'test-secret-key'
    WTF_CSRF_ENABLED = False


def create_test_app():
    """Create a Flask app configured for testing."""
    from src.backend.app import create_app
    app = create_app(TestingConfig)
    return app


def setup_test_db(app):
    """Set up test database."""
    from src.backend.models import db
    with app.app_context():
        db.create_all()


def teardown_test_db(app):
    """Tear down test database."""
    from src.backend.models import db
    with app.app_context():
        db.drop_all()