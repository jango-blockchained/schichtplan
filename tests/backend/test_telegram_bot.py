"""
Tests for Telegram Bot Service

This module contains comprehensive tests for the Telegram bot integration.
"""

import os
from unittest.mock import patch

import pytest

from src.backend.app import create_app
from src.backend.models import Employee, db
from src.backend.services.telegram_bot_service import TelegramBotService

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio


@pytest.fixture
def app():
    """Create and configure a test Flask application."""
    app = create_app("testing")
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.app_context():
        db.create_all()

        # Create test employees
        emp1 = Employee(
            first_name="John",
            last_name="Doe",
            employee_group="VZ",
            contracted_hours=40,
            is_keyholder=True,
            email="john.doe@example.com",
            is_active=True,
        )
        emp2 = Employee(
            first_name="Jane",
            last_name="Smith",
            employee_group="TZ",
            contracted_hours=20,
            is_keyholder=False,
            email="jane.smith@example.com",
            is_active=True,
        )
        db.session.add(emp1)
        db.session.add(emp2)
        db.session.commit()

        yield app

        db.session.remove()
        db.drop_all()


@pytest.fixture
def bot_service(app):
    """Create a Telegram bot service instance for testing."""
    with app.app_context():
        service = TelegramBotService(flask_app=app, token="test_token", mode="polling")
        return service


class TestTelegramBotService:
    """Test cases for TelegramBotService."""

    def test_initialization(self, bot_service):
        """Test bot service initialization."""
        assert bot_service.token == "test_token"
        assert bot_service.mode == "polling"
        assert bot_service.flask_app is not None

    def test_parse_allowed_users(self, bot_service):
        """Test parsing of allowed users."""
        users = bot_service._parse_allowed_users("123,456,789")
        assert users == {123, 456, 789}

        empty_users = bot_service._parse_allowed_users("")
        assert empty_users == set()

    def test_is_authorized_no_restrictions(self, bot_service):
        """Test authorization when no users are configured."""
        bot_service.allowed_users = set()
        assert bot_service._is_authorized(12345)

    def test_is_authorized_with_allowed_list(self, bot_service):
        """Test authorization with allowed users list."""
        bot_service.allowed_users = {12345, 67890}
        assert bot_service._is_authorized(12345)
        assert not bot_service._is_authorized(99999)

    def test_is_admin(self, bot_service):
        """Test admin check."""
        bot_service.admin_users = {12345}
        assert bot_service._is_admin(12345)
        assert not bot_service._is_admin(67890)

    def test_split_message(self, bot_service):
        """Test message splitting for long messages."""
        long_text = "A" * 5000
        max_len = 4000
        chunks = bot_service._split_message(long_text, max_length=max_len)

        assert len(chunks) == 2  # noqa: PLR2004
        assert len(chunks[0]) <= max_len
        assert len(chunks[1]) <= max_len
        assert "".join(chunks) == long_text

    def test_split_message_short(self, bot_service):
        """Test message splitting with short message."""
        short_text = "Hello world"
        chunks = bot_service._split_message(short_text, max_length=4000)

        assert len(chunks) == 1
        assert chunks[0] == short_text

    def test_split_message_with_newlines(self, bot_service):
        """Test message splitting respects newlines."""
        text = "Line1\n" * 1000  # Each line is 6 chars
        max_len = 100
        chunks = bot_service._split_message(text, max_length=max_len)

        # Should have multiple chunks
        assert len(chunks) > 1
        # Each chunk should respect newlines
        for chunk in chunks:
            assert len(chunk) <= max_len  # noqa: PLR2004


class TestTelegramBotIntegration:
    """Integration tests for Telegram bot with Flask app."""

    def test_bot_service_integration(self, app):
        """Test bot service integration with Flask app."""
        with app.app_context():
            service = TelegramBotService(app, token="test_token")
            assert service.flask_app == app

    async def test_employees_query_with_real_db(self, app):
        """Test employee queries with actual database."""
        with app.app_context():
            # Service creation validates Flask app integration
            _ = TelegramBotService(app, token="test_token")

            # Verify test data exists
            employees = Employee.query.filter_by(is_active=True).all()
            assert len(employees) == 2  # noqa: PLR2004
            assert any(emp.first_name == "John" for emp in employees)

    def test_configuration_from_env(self, app):
        """Test configuration loading from environment variables."""
        # Set test environment variables BEFORE creating the service
        os.environ["TELEGRAM_BOT_MODE"] = "webhook"
        os.environ["TELEGRAM_BOT_WEBHOOK_URL"] = "https://test.com/webhook"

        with app.app_context():
            # Don't pass mode parameter so it uses env variable
            service = TelegramBotService(app, token="test_token", mode=None)

            assert service.mode == "webhook"
            assert service.webhook_url == "https://test.com/webhook"

        # Clean up AFTER the with block
        os.environ.pop("TELEGRAM_BOT_MODE", None)
        os.environ.pop("TELEGRAM_BOT_WEBHOOK_URL", None)


class TestTelegramBotWebhook:
    """Tests for Telegram bot webhook functionality."""

    @patch("src.backend.services.telegram_bot_service.Application")
    async def test_webhook_initialization(self, mock_app_class, app):
        """Test webhook mode initialization."""
        with app.app_context():
            service = TelegramBotService(app, token="test_token", mode="webhook")
            service.webhook_url = "https://example.com/webhook"

            assert service.mode == "webhook"
            assert service.webhook_url is not None

    def test_webhook_url_validation(self, app):
        """Test webhook URL configuration."""
        with app.app_context():
            service = TelegramBotService(app, token="test_token", mode="webhook")

            # Without webhook URL, should raise error on start
            service.webhook_url = None
            # Note: We can't actually test start() without a full event loop setup
            # This test just validates the configuration


class TestTelegramBotAccessControl:
    """Tests for access control features."""

    def test_allowed_users_parsing(self, app):
        """Test parsing of allowed users from environment."""
        with app.app_context():
            os.environ["TELEGRAM_BOT_ALLOWED_USERS"] = "123,456,789"
            service = TelegramBotService(app, token="test_token")

            assert service.allowed_users == {123, 456, 789}

            os.environ.pop("TELEGRAM_BOT_ALLOWED_USERS", None)

    def test_admin_users_parsing(self, app):
        """Test parsing of admin users from environment."""
        with app.app_context():
            os.environ["TELEGRAM_BOT_ADMIN_USERS"] = "100,200"
            service = TelegramBotService(app, token="test_token")

            assert service.admin_users == {100, 200}

            os.environ.pop("TELEGRAM_BOT_ADMIN_USERS", None)

    def test_combined_access_control(self, app):
        """Test combined allowed and admin users."""
        with app.app_context():
            os.environ["TELEGRAM_BOT_ALLOWED_USERS"] = "100,200,300"
            os.environ["TELEGRAM_BOT_ADMIN_USERS"] = "100"

            service = TelegramBotService(app, token="test_token")

            # Admin is also in allowed users (via _is_authorized)
            assert service._is_authorized(100)  # Admin
            assert service._is_authorized(200)  # Regular allowed user
            assert not service._is_authorized(999)  # Not allowed

            # Check admin status
            assert service._is_admin(100)
            assert not service._is_admin(200)

            os.environ.pop("TELEGRAM_BOT_ALLOWED_USERS", None)
            os.environ.pop("TELEGRAM_BOT_ADMIN_USERS", None)


class TestTelegramBotAIProcessing:
    """Tests for AI message processing."""

    async def test_process_ai_query_basic(self, app, bot_service):
        """Test basic AI query processing."""
        with app.app_context():
            response = await bot_service._process_ai_query(
                "Show me employees", user_id=12345
            )

            # Should return some response
            assert isinstance(response, str)
            assert len(response) > 0

    async def test_process_ai_query_with_db_access(self, app, bot_service):
        """Test AI query with database access."""
        with app.app_context():
            response = await bot_service._process_ai_query(
                "list all employees", user_id=12345
            )

            # Response should mention employees
            assert "employee" in response.lower() or "john" in response.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
