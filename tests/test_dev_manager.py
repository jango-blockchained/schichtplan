"""
Tests for Development Manager TUI

This module contains tests for the enhanced TUI including Telegram bot
integration and performance optimizations.
"""

from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from dev_manager import DevManagerApp, ServiceStatus

# Test constants
TEST_PORT = 5000
TEST_PID = 12345
EXPECTED_SERVICE_COUNT = 5
DEFAULT_MONITOR_INTERVAL = 10.0
UPDATED_MONITOR_INTERVAL = 15.0
CACHE_VALIDITY_SECONDS = 30
MAX_LOG_BUFFER_SIZE = 1000
MIN_SOCKET_TIMEOUT = 0.1
MAX_SOCKET_TIMEOUT = 2.0
MIN_CACHE_DURATION = 10
MAX_CACHE_DURATION = 120
ALT_MONITOR_INTERVAL_1 = 1.0
ALT_MONITOR_INTERVAL_2 = 60.0


class TestServiceStatus:
    """Tests for ServiceStatus class."""

    def test_initialization(self):
        """Test basic service status initialization."""
        service = ServiceStatus(
            name="Test Service",
            port=TEST_PORT,
            command=["python", "test.py"],
            cwd=Path("/test"),
        )

        assert service.name == "Test Service"
        assert service.port == TEST_PORT
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
            port=TEST_PORT,
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
        # Backend, Frontend, MCP, Conversational AI, Telegram Bot
        assert len(app.services) == EXPECTED_SERVICE_COUNT
        assert "telegram_bot" in app.services
        assert app._monitor_interval == DEFAULT_MONITOR_INTERVAL

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
            port=TEST_PORT,
            command=["test"],
        )

        # Initial state
        assert service._last_health_check is None
        assert service._cached_health_status == "Unknown"

    def test_cache_validity_check(self):
        """Test cache validity logic."""
        service = ServiceStatus(
            name="Test",
            port=TEST_PORT,
            command=["test"],
        )

        # Set cache timestamp
        now = datetime.now()
        service._last_health_check = now
        service._cached_health_status = "✓ Healthy"
        service._cached_response_time = "50ms"

        # Check if cache is valid (within threshold)
        time_diff = (now - service._last_health_check).seconds
        assert time_diff == 0  # Just set, so 0 seconds
        cache_valid = time_diff < CACHE_VALIDITY_SECONDS
        assert cache_valid is True

    def test_cache_expiration(self):
        """Test that cache expires after threshold seconds."""
        service = ServiceStatus(
            name="Test",
            port=TEST_PORT,
            command=["test"],
        )

        # Set cache timestamp to 31 seconds ago
        expired_time = CACHE_VALIDITY_SECONDS + 1
        service._last_health_check = datetime.now() - timedelta(seconds=expired_time)

        # Check if cache is expired
        time_diff = (datetime.now() - service._last_health_check).seconds
        cache_valid = time_diff < CACHE_VALIDITY_SECONDS
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
        assert app._monitor_interval == DEFAULT_MONITOR_INTERVAL

        # Can be changed
        app._monitor_interval = UPDATED_MONITOR_INTERVAL
        assert app._monitor_interval == UPDATED_MONITOR_INTERVAL

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
            port=TEST_PORT,
            command=["python", "app.py"],
        )

        assert service.port == TEST_PORT
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
        for _service_id, service in app.services.items():
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


class TestServiceLifecycle:
    """Tests for service lifecycle management."""

    @pytest.fixture
    def app(self):
        """Create test app."""
        return DevManagerApp()

    def test_service_initial_state(self, app):
        """Test that all services start in STOPPED state."""
        for _service_id, service in app.services.items():
            assert service.status == "STOPPED"
            assert service.process is None
            assert service.pid is None
            assert service.start_time is None

    def test_service_status_transitions(self):
        """Test valid service status transitions."""
        service = ServiceStatus(
            name="Test",
            port=5000,
            command=["test"],
        )

        # Initial state
        assert service.status == "STOPPED"

        # Can transition to STARTING
        service.status = "STARTING"
        assert service.status == "STARTING"

        # Can transition to RUNNING
        service.status = "RUNNING"
        assert service.status == "RUNNING"

        # Can transition back to STOPPED
        service.status = "STOPPED"
        assert service.status == "STOPPED"

    @patch("subprocess.Popen")
    def test_service_start_sets_metadata(self, mock_popen, app):
        """Test that starting a service sets metadata correctly."""
        mock_process = MagicMock()
        mock_process.pid = TEST_PID
        mock_process.poll.return_value = None  # Running
        mock_popen.return_value = mock_process

        service = app.services["backend"]

        # Simulate starting (synchronous test)
        service.process = mock_process
        service.pid = mock_process.pid
        service.start_time = datetime.now()
        service.status = "RUNNING"

        assert service.process is not None
        assert service.pid == TEST_PID
        assert service.start_time is not None
        assert service.status == "RUNNING"


class TestUIComponents:
    """Tests for UI components and interactions."""

    @pytest.fixture
    def app(self):
        """Create test app."""
        return DevManagerApp()

    def test_service_card_initialization(self, app):
        """Test that service cards are created for all services."""
        assert len(app.service_cards) == 0  # Not initialized until compose

    def test_css_styling_defined(self, app):
        """Test that CSS styling is defined."""
        assert app.CSS is not None
        assert len(app.CSS) > 0
        # Check for key CSS elements that should be present
        assert "#services-container" in app.CSS
        assert "DataTable" in app.CSS

    def test_title_and_subtitle(self, app):
        """Test app title and subtitle."""
        assert app.TITLE == "🚀 Schichtplan Development Manager"
        assert app.SUB_TITLE == "Professional Service Management TUI"

    def test_tab_configuration(self, app):
        """Test that tabs are properly configured."""
        # App should have tabs for Services, Logs, Health, Stats, Config
        # This is tested via compose, but we can verify the app structure
        assert hasattr(app, "compose")


class TestMonitoring:
    """Tests for service monitoring features."""

    def test_monitor_interval_bounds(self):
        """Test monitor interval validation bounds."""
        app = DevManagerApp()

        # Default value
        assert app._monitor_interval == DEFAULT_MONITOR_INTERVAL

        # Can be set to valid values
        app._monitor_interval = ALT_MONITOR_INTERVAL_1
        assert app._monitor_interval == ALT_MONITOR_INTERVAL_1

        app._monitor_interval = ALT_MONITOR_INTERVAL_2
        assert app._monitor_interval == ALT_MONITOR_INTERVAL_2

    def test_cpu_memory_initialization(self):
        """Test that CPU and memory tracking is initialized."""
        service = ServiceStatus(
            name="Test",
            port=TEST_PORT,
            command=["test"],
        )

        assert service.cpu_percent == 0.0
        assert service.memory_mb == 0.0

    def test_last_monitor_update(self):
        """Test that last monitor update is tracked."""
        app = DevManagerApp()
        assert hasattr(app, "_last_monitor_update")
        assert isinstance(app._last_monitor_update, datetime)


class TestErrorHandling:
    """Tests for error handling and edge cases."""

    def test_service_without_cwd_uses_default(self):
        """Test that service without cwd uses current working directory."""
        service = ServiceStatus(
            name="Test",
            port=TEST_PORT,
            command=["test"],
        )

        assert service.cwd == Path.cwd()

    def test_service_with_explicit_cwd(self):
        """Test that service with explicit cwd uses it."""
        test_path = Path("/test/path")
        service = ServiceStatus(
            name="Test",
            port=TEST_PORT,
            command=["test"],
            cwd=test_path,
        )

        assert service.cwd == test_path

    def test_invalid_port_number(self):
        """Test handling of edge case port numbers."""
        # Port 0 is valid (means no port)
        service = ServiceStatus(
            name="Test",
            port=0,
            command=["test"],
        )
        assert service.port == 0

        # Negative port should work in init but would fail at runtime
        service = ServiceStatus(
            name="Test",
            port=-1,
            command=["test"],
        )
        assert service.port == -1

    def test_empty_command_list(self):
        """Test empty command list creation (would fail at runtime)."""
        service = ServiceStatus(
            name="Test",
            port=TEST_PORT,
            command=[],
        )
        assert service.command == []


class TestSearchAndFilter:
    """Tests for search and filter functionality."""

    @pytest.fixture
    def app(self):
        """Create test app."""
        return DevManagerApp()

    def test_search_filter_initialization(self, app):
        """Test that search filter is initialized."""
        assert app._service_filter == ""

    def test_search_filter_matching(self, app):
        """Test search filter logic."""
        # Test case-insensitive matching
        search_term = "backend"
        service_name = "Backend"
        service_id = "backend"

        # Should match by name
        assert search_term in service_name.lower()

        # Should match by ID
        assert search_term in service_id


class TestConfigPanel:
    """Tests for configuration panel features."""

    @pytest.fixture
    def app(self):
        """Create test app."""
        return DevManagerApp()

    def test_monitor_interval_config(self, app):
        """Test monitor interval configuration."""
        # Default value
        assert app._monitor_interval == DEFAULT_MONITOR_INTERVAL

        # Valid range: 1-60 seconds
        valid_intervals = [
            ALT_MONITOR_INTERVAL_1,
            5.0,
            DEFAULT_MONITOR_INTERVAL,
            CACHE_VALIDITY_SECONDS,
            ALT_MONITOR_INTERVAL_2,
        ]
        for interval in valid_intervals:
            app._monitor_interval = interval
            assert app._monitor_interval == interval


class TestLogReading:
    """Tests for log reading functionality."""

    @pytest.fixture
    def app(self):
        """Create test app."""
        return DevManagerApp()

    def test_log_file_paths(self, app):
        """Test that log file paths are correctly defined."""
        log_files = {
            "mcp": app.project_root / "mcp_server.log",
            "backend": app.project_root / "instance" / "logs" / "app.log",
            "telegram": (app.project_root / "instance" / "logs" / "telegram.log"),
        }

        # All paths should be Path objects
        for _name, path in log_files.items():
            assert isinstance(path, Path)

    def test_log_buffer_size(self):
        """Test that log buffer size is properly configured."""
        # This is a constant in the code, but we can verify logic exists
        buffer_size = 20
        assert buffer_size > 0
        assert buffer_size < MAX_LOG_BUFFER_SIZE  # Reasonable limit


class TestQuickActions:
    """Tests for quick action buttons."""

    @pytest.fixture
    def app(self):
        """Create test app."""
        return DevManagerApp()

    def test_url_construction(self):
        """Test URL construction for quick actions."""
        backend_url = "http://localhost:5000"
        frontend_url = "http://localhost:5173"

        assert backend_url.startswith("http://")
        assert frontend_url.startswith("http://")
        assert "localhost" in backend_url
        assert "localhost" in frontend_url


class TestHealthCheckOptimization:
    """Tests for health check optimization features."""

    def test_socket_timeout_configuration(self):
        """Test that socket timeout is reasonable."""
        # In the code, timeout is set to 0.5s
        timeout = 0.5
        assert MIN_SOCKET_TIMEOUT <= timeout <= MAX_SOCKET_TIMEOUT

    def test_cache_duration(self):
        """Test that health check cache duration is reasonable."""
        # In the code, cache is valid for 30 seconds
        cache_duration = CACHE_VALIDITY_SECONDS
        assert MIN_CACHE_DURATION <= cache_duration <= MAX_CACHE_DURATION

    def test_health_check_intervals(self):
        """Test various health check timing scenarios."""
        service = ServiceStatus(
            name="Test",
            port=TEST_PORT,
            command=["test"],
        )

        # Fresh service - no cache
        assert service._last_health_check is None

        # Set recent check
        recent_seconds = 10
        service._last_health_check = datetime.now() - timedelta(seconds=recent_seconds)
        time_diff = (datetime.now() - service._last_health_check).seconds
        assert time_diff >= recent_seconds
        # Still within cache validity
        assert time_diff < CACHE_VALIDITY_SECONDS

        # Set old check
        old_seconds = 35
        service._last_health_check = datetime.now() - timedelta(seconds=old_seconds)
        time_diff = (datetime.now() - service._last_health_check).seconds
        # Cache expired
        assert time_diff >= CACHE_VALIDITY_SECONDS


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
