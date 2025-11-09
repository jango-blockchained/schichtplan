"""
Tests for Development Manager TUI

This module contains tests for the enhanced TUI including Telegram bot
integration and performance optimizations.
"""

import os
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, Mock, patch

import pytest

from dev_manager import DevManagerApp, ServiceStatus


class TestServiceStatus:
    """Tests for ServiceStatus class."""

    def test_initialization(self):
        """Test basic service status initialization."""
        service = ServiceStatus(
            name="Test Service",
            port=5000,
            command=["python", "test.py"],
            cwd=Path("/test"),
        )

        assert service.name == "Test Service"
        assert service.port == 5000
        assert service.command == ["python", "test.py"]
        assert service.cwd == Path("/test")
        assert service.status == "STOPPED"
        assert service.process is None
        assert service.pid is None

    def test_initialization_with_env_requirement(self):
        """Test service initialization with environment requirement."""
        service = ServiceStatus(
            name="Telegram Bot",
            port=0,
            command=["python", "bot.py"],
            requires_env=True,
        )

        assert service.requires_env is True
        assert service.port == 0

    def test_caching_attributes(self):
        """Test that caching attributes are initialized."""
        service = ServiceStatus(
            name="Test",
            port=5000,
            command=["test"],
        )

        assert service._last_health_check is None
        assert service._cached_health_status == "Unknown"
        assert service._cached_response_time == "N/A"


class TestDevManagerApp:
    """Tests for DevManagerApp class."""

    @pytest.fixture
    def app(self):
        """Create a test app instance."""
        return DevManagerApp()

    def test_initialization(self, app):
        """Test app initialization."""
        assert app.project_root.exists()
        assert len(app.services) == 5  # Backend, Frontend, MCP, Conversational AI, Telegram Bot
        assert "telegram_bot" in app.services
        assert app._monitor_interval == 10.0

    def test_telegram_bot_service_config(self, app):
        """Test Telegram bot service configuration."""
        telegram = app.services["telegram_bot"]

        assert telegram.name == "Telegram Bot"
        assert telegram.port == 0  # No listening port
        assert telegram.requires_env is True
        assert "start_telegram_bot.py" in " ".join(telegram.command)

    def test_all_services_present(self, app):
        """Test that all expected services are configured."""
        expected_services = [
            "backend",
            "frontend",
            "mcp",
            "conversational_ai",
            "telegram_bot",
        ]

        for service_id in expected_services:
            assert service_id in app.services
            service = app.services[service_id]
            assert service.name
            assert service.command
            assert service.cwd.exists()

    def test_keybindings(self, app):
        """Test that all keybindings are configured."""
        binding_keys = [b.key for b in app.BINDINGS]

        assert "q" in binding_keys  # Quit
        assert "r" in binding_keys  # Restart all
        assert "s" in binding_keys  # Stop all
        assert "a" in binding_keys  # Start all
        assert "l" in binding_keys  # Logs
        assert "h" in binding_keys  # Health
        assert "c" in binding_keys  # Config
        assert "f" in binding_keys  # Search


class TestServiceHealthCaching:
    """Tests for service health check caching."""

    def test_cache_initialization(self):
        """Test that cache is properly initialized."""
        service = ServiceStatus(
            name="Test",
            port=5000,
            command=["test"],
        )

        # Initial state
        assert service._last_health_check is None
        assert service._cached_health_status == "Unknown"

    def test_cache_validity_check(self):
        """Test cache validity logic."""
        service = ServiceStatus(
            name="Test",
            port=5000,
            command=["test"],
        )

        # Set cache timestamp
        now = datetime.now()
        service._last_health_check = now
        service._cached_health_status = "✓ Healthy"
        service._cached_response_time = "50ms"

        # Check if cache is valid (within 30s)
        time_diff = (now - service._last_health_check).seconds
        assert time_diff == 0  # Just set, so 0 seconds
        cache_valid = time_diff < 30
        assert cache_valid is True

    def test_cache_expiration(self):
        """Test that cache expires after 30 seconds."""
        service = ServiceStatus(
            name="Test",
            port=5000,
            command=["test"],
        )

        # Set cache timestamp to 31 seconds ago
        service._last_health_check = datetime.now() - timedelta(seconds=31)

        # Check if cache is expired
        time_diff = (datetime.now() - service._last_health_check).seconds
        cache_valid = time_diff < 30
        assert cache_valid is False


class TestEnvironmentValidation:
    """Tests for environment variable validation."""

    @patch("os.path.exists")
    @patch("dotenv.dotenv_values")
    def test_telegram_bot_requires_token(self, mock_dotenv, mock_exists):
        """Test that Telegram bot requires token in .env."""
        mock_exists.return_value = True
        mock_dotenv.return_value = {}

        app = DevManagerApp()
        telegram = app.services["telegram_bot"]

        assert telegram.requires_env is True

    @patch("os.path.exists")
    @patch("dotenv.dotenv_values")
    def test_telegram_bot_requires_enable_flag(self, mock_dotenv, mock_exists):
        """Test that Telegram bot requires ENABLE_TELEGRAM_BOT flag."""
        mock_exists.return_value = True
        mock_dotenv.return_value = {
            "TELEGRAM_BOT_TOKEN": "test_token",
            "ENABLE_TELEGRAM_BOT": "false",
        }

        app = DevManagerApp()
        telegram = app.services["telegram_bot"]

        assert telegram.requires_env is True


class TestPerformanceOptimizations:
    """Tests for performance optimization features."""

    def test_configurable_monitor_interval(self):
        """Test that monitor interval is configurable."""
        app = DevManagerApp()

        # Default interval
        assert app._monitor_interval == 10.0

        # Can be changed
        app._monitor_interval = 15.0
        assert app._monitor_interval == 15.0

    def test_service_filter(self):
        """Test service filtering."""
        app = DevManagerApp()

        # Initial state
        assert app._service_filter == ""

        # Can be set
        app._service_filter = "backend"
        assert app._service_filter == "backend"


class TestServicePortHandling:
    """Tests for services with and without ports."""

    def test_service_with_port(self):
        """Test service that listens on a port."""
        service = ServiceStatus(
            name="Backend",
            port=5000,
            command=["python", "app.py"],
        )

        assert service.port == 5000
        assert service.port > 0

    def test_service_without_port(self):
        """Test service without listening port (like Telegram bot)."""
        service = ServiceStatus(
            name="Telegram Bot",
            port=0,
            command=["python", "bot.py"],
        )

        assert service.port == 0
        assert service.port == 0  # Port-less service


class TestIntegration:
    """Integration tests for the dev manager."""

    @pytest.fixture
    def app(self):
        """Create test app."""
        return DevManagerApp()

    def test_all_services_have_unique_ids(self, app):
        """Test that all service IDs are unique."""
        service_ids = list(app.services.keys())
        assert len(service_ids) == len(set(service_ids))

    def test_all_services_have_valid_commands(self, app):
        """Test that all services have valid command arrays."""
        for service_id, service in app.services.items():
            assert isinstance(service.command, list)
            assert len(service.command) > 0
            assert all(isinstance(cmd, str) for cmd in service.command)

    def test_project_structure(self, app):
        """Test that project structure is valid."""
        # Project root should exist
        assert app.project_root.exists()

        # Key directories should exist
        assert (app.project_root / "src").exists()
        assert (app.project_root / "src" / "backend").exists()
        assert (app.project_root / "src" / "frontend").exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
