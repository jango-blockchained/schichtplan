"""
Tests for Settings Management MCP Tools
"""

import pytest

from src.backend.models import Settings, db
from src.backend.services.mcp_tools.settings_management import SettingsManagementTools


@pytest.fixture
def settings_tools(app):
    """Create SettingsManagementTools instance with app context"""
    return SettingsManagementTools(app)


@pytest.fixture
def sample_settings(app):
    """Create sample settings in database"""
    with app.app_context():
        settings = Settings.get_or_create_default()
        yield settings


class TestSettingsManagementTools:
    """Test suite for Settings Management MCP Tools"""

    @pytest.mark.asyncio
    async def test_read_all_settings(self, app, settings_tools, sample_settings):
        """Test reading all settings"""
        with app.app_context():
            result = await settings_tools._read_all_settings()

            assert result["status"] == "success"
            assert result["operation"] == "read_all"
            assert "settings" in result
            assert "categories" in result
            assert len(result["categories"]) > 0

            # Verify all expected categories are present
            expected_categories = [
                "general",
                "scheduling",
                "display",
                "pdf_layout",
                "employee_groups",
                "availability_types",
                "actions",
                "ai_scheduling",
                "week_navigation",
            ]
            for category in expected_categories:
                assert category in result["categories"]

    @pytest.mark.asyncio
    async def test_read_specific_category(self, app, settings_tools, sample_settings):
        """Test reading a specific settings category"""
        with app.app_context():
            result = await settings_tools._read_settings("general")

            assert result["status"] == "success"
            assert result["operation"] == "read"
            assert result["category"] == "general"
            assert "settings" in result
            assert "store_name" in result["settings"]
            assert "timezone" in result["settings"]

    @pytest.mark.asyncio
    async def test_read_invalid_category(self, app, settings_tools, sample_settings):
        """Test reading an invalid settings category"""
        with app.app_context():
            result = await settings_tools._read_settings("invalid_category")

            assert "error" in result
            assert "valid_categories" in result

    @pytest.mark.asyncio
    async def test_update_general_settings(self, app, settings_tools, sample_settings):
        """Test updating general settings"""
        with app.app_context():
            update_data = {
                "store_name": "Test Store",
                "timezone": "Europe/London",
            }

            result = await settings_tools._update_settings(
                "general", update_data, dry_run=False
            )

            assert result["status"] == "success"
            assert result["operation"] == "update"
            assert result["category"] == "general"
            assert result["updated_settings"]["store_name"] == "Test Store"
            assert result["updated_settings"]["timezone"] == "Europe/London"

            # Verify settings were actually updated in database
            settings = Settings.get_or_create_default()
            assert settings.store_name == "Test Store"
            assert settings.timezone == "Europe/London"

    @pytest.mark.asyncio
    async def test_update_scheduling_settings(
        self, app, settings_tools, sample_settings
    ):
        """Test updating scheduling settings"""
        with app.app_context():
            update_data = {
                "max_daily_hours": 10.0,
                "max_weekly_hours": 45.0,
                "scheduling_algorithm": "optimized",
            }

            result = await settings_tools._update_settings(
                "scheduling", update_data, dry_run=False
            )

            assert result["status"] == "success"
            assert result["updated_settings"]["max_daily_hours"] == 10.0
            assert result["updated_settings"]["max_weekly_hours"] == 45.0
            assert result["updated_settings"]["scheduling_algorithm"] == "optimized"

    @pytest.mark.asyncio
    async def test_update_dry_run(self, app, settings_tools, sample_settings):
        """Test update with dry_run=True"""
        with app.app_context():
            original_name = sample_settings.store_name

            update_data = {"store_name": "New Name"}

            result = await settings_tools._update_settings(
                "general", update_data, dry_run=True
            )

            assert result["status"] == "success"
            assert result["dry_run"] is True

            # Verify settings were NOT updated in database
            settings = Settings.get_or_create_default()
            assert settings.store_name == original_name

    @pytest.mark.asyncio
    async def test_validation_numeric_range(self, app, settings_tools, sample_settings):
        """Test validation of numeric ranges"""
        with app.app_context():
            # Test invalid max_daily_hours (out of range)
            update_data = {"max_daily_hours": 30.0}  # Max is 24

            result = settings_tools._validate_settings_data(
                "scheduling", update_data
            )

            assert result is not None
            assert "error" in result
            assert "must be between" in result["error"]

    @pytest.mark.asyncio
    async def test_validation_scheduling_algorithm(
        self, app, settings_tools, sample_settings
    ):
        """Test validation of scheduling algorithm"""
        with app.app_context():
            update_data = {"scheduling_algorithm": "invalid_algorithm"}

            result = settings_tools._validate_settings_data(
                "scheduling", update_data
            )

            assert result is not None
            assert "error" in result
            assert "must be one of" in result["error"]

    @pytest.mark.asyncio
    async def test_validation_ai_provider(self, app, settings_tools, sample_settings):
        """Test validation of AI provider"""
        with app.app_context():
            update_data = {"provider": "invalid_provider"}

            result = settings_tools._validate_settings_data(
                "ai_scheduling", update_data
            )

            assert result is not None
            assert "error" in result

    @pytest.mark.asyncio
    async def test_validation_temperature(self, app, settings_tools, sample_settings):
        """Test validation of AI temperature"""
        with app.app_context():
            # Test invalid temperature (out of range)
            update_data = {"temperature": 3.0}  # Max is 2

            result = settings_tools._validate_settings_data(
                "ai_scheduling", update_data
            )

            assert result is not None
            assert "error" in result
            assert "temperature" in result["error"]

    @pytest.mark.asyncio
    async def test_validation_week_navigation(
        self, app, settings_tools, sample_settings
    ):
        """Test validation of week navigation settings"""
        with app.app_context():
            # Test invalid week_weekend_start
            update_data = {"week_weekend_start": "INVALID"}

            result = settings_tools._validate_settings_data(
                "week_navigation", update_data
            )

            assert result is not None
            assert "error" in result

    @pytest.mark.asyncio
    async def test_update_without_category(self, app, settings_tools, sample_settings):
        """Test update operation without category"""
        with app.app_context():
            result = await settings_tools._update_settings(
                None, {"some_data": "value"}, dry_run=False
            )

            assert "error" in result
            assert "category is required" in result["error"]

    @pytest.mark.asyncio
    async def test_update_without_data(self, app, settings_tools, sample_settings):
        """Test update operation without data"""
        with app.app_context():
            result = await settings_tools._update_settings(
                "general", None, dry_run=False
            )

            assert "error" in result
            assert "settings_data is required" in result["error"]

    @pytest.mark.asyncio
    async def test_get_tool_info(self, app, settings_tools):
        """Test get_tool_info method"""
        with app.app_context():
            info = settings_tools.get_tool_info()

            assert info["category"] == "settings_management"
            assert "tools" in info
            assert len(info["tools"]) == 1

            tool = info["tools"][0]
            assert tool["name"] == "manage_settings"
            assert "operations" in tool
            assert "categories" in tool
            assert "read" in tool["operations"]
            assert "update" in tool["operations"]
