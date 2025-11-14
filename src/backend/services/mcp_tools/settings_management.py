"""
Settings Management Tools for MCP Service

This module provides comprehensive settings management operations
through semantic, AI-friendly tools.
"""

import logging
from typing import Any

from fastmcp import Context

from src.backend.models import Settings, db


class SettingsManagementTools:
    """Tools for managing application settings."""

    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)

    def register_tools(self, mcp):
        """Register settings management tools with the MCP service."""

        @mcp.tool()
        async def manage_settings(
            ctx: Context,
            operation: str,
            category: str | None = None,
            settings_data: dict | None = None,
            dry_run: bool = False,
        ) -> dict[str, Any]:
            """Manage application settings across all categories.

            Args:
                operation: Operation type - "read", "update", "read_all"
                category: Settings category - "general", "scheduling", "display",
                         "pdf_layout", "employee_groups", "ai_scheduling", "week_navigation"
                settings_data: Settings data for update operations
                dry_run: If True, validate operations but don't commit changes

            Returns:
                Operation result with settings data and status information
            """
            try:
                with self.flask_app.app_context():
                    if operation == "read":
                        return await self._read_settings(category)
                    elif operation == "read_all":
                        return await self._read_all_settings()
                    elif operation == "update":
                        return await self._update_settings(
                            category, settings_data, dry_run
                        )
                    else:
                        return {
                            "error": f"Invalid operation: {operation}",
                            "valid_operations": ["read", "read_all", "update"],
                        }

            except Exception as e:
                self.logger.error(f"Error in manage_settings: {e}")
                return {
                    "error": str(e),
                    "operation": operation,
                    "category": category,
                }

    async def _read_settings(self, category: str | None) -> dict[str, Any]:
        """Read settings for a specific category or all settings."""
        settings = Settings.get_or_create_default()
        settings_dict = settings.to_dict()

        if category:
            if category not in settings_dict:
                return {
                    "error": f"Invalid category: {category}",
                    "valid_categories": list(settings_dict.keys()),
                }

            return {
                "status": "success",
                "operation": "read",
                "category": category,
                "settings": settings_dict[category],
            }

        return {
            "status": "success",
            "operation": "read",
            "settings": settings_dict,
        }

    async def _read_all_settings(self) -> dict[str, Any]:
        """Read all application settings."""
        settings = Settings.get_or_create_default()

        return {
            "status": "success",
            "operation": "read_all",
            "settings": settings.to_dict(),
            "categories": [
                "general",
                "scheduling",
                "display",
                "pdf_layout",
                "employee_groups",
                "availability_types",
                "actions",
                "ai_scheduling",
                "week_navigation",
            ],
        }

    async def _update_settings(
        self,
        category: str | None,
        settings_data: dict | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Update application settings."""
        if not settings_data:
            return {"error": "settings_data is required for update operation"}

        if not category:
            return {"error": "category is required for update operation"}

        valid_categories = [
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

        if category not in valid_categories:
            return {
                "error": f"Invalid category: {category}",
                "valid_categories": valid_categories,
            }

        try:
            settings = Settings.get_or_create_default()

            # Validate settings data structure based on category
            validation_error = self._validate_settings_data(category, settings_data)
            if validation_error:
                return validation_error

            if not dry_run:
                # Use the Settings.update_from_dict method for safe updates
                update_dict = {category: settings_data}
                Settings.update_from_dict(update_dict)
                settings = Settings.get_or_create_default()  # Refresh after update

            return {
                "status": "success",
                "operation": "update",
                "category": category,
                "updated_settings": settings.to_dict()[category],
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    def _validate_settings_data(
        self, category: str, settings_data: dict
    ) -> dict[str, Any] | None:
        """Validate settings data structure for a given category."""

        # Category-specific validation rules
        if category == "general":
            required_fields = ["store_name", "timezone"]
            for field in required_fields:
                if field in settings_data and not settings_data[field]:
                    return {
                        "error": f"Field '{field}' cannot be empty in general settings"
                    }

        elif category == "scheduling":
            # Validate numeric ranges
            numeric_validations = {
                "max_daily_hours": (1, 24),
                "max_weekly_hours": (1, 168),
                "min_rest_between_shifts": (0, 24),
                "scheduling_period_weeks": (1, 52),
            }

            for field, (min_val, max_val) in numeric_validations.items():
                if field in settings_data:
                    value = settings_data[field]
                    if not isinstance(value, (int, float)):
                        return {"error": f"Field '{field}' must be a number"}
                    if not (min_val <= value <= max_val):
                        return {
                            "error": f"Field '{field}' must be between {min_val} and {max_val}"
                        }

            # Validate scheduling_algorithm
            if "scheduling_algorithm" in settings_data:
                valid_algorithms = ["standard", "optimized"]
                if settings_data["scheduling_algorithm"] not in valid_algorithms:
                    return {
                        "error": f"scheduling_algorithm must be one of: {valid_algorithms}"
                    }

        elif category == "ai_scheduling":
            # Validate AI provider
            if "provider" in settings_data:
                valid_providers = ["gemini", "openai", "anthropic"]
                if settings_data["provider"] not in valid_providers:
                    return {"error": f"AI provider must be one of: {valid_providers}"}

            # Validate temperature range
            if "temperature" in settings_data:
                temp = settings_data["temperature"]
                if not isinstance(temp, (int, float)) or not (0 <= temp <= 2):
                    return {"error": "temperature must be a number between 0 and 2"}

        elif category == "week_navigation":
            # Validate week_weekend_start
            if "week_weekend_start" in settings_data:
                valid_starts = ["MONDAY", "SUNDAY"]
                if settings_data["week_weekend_start"] not in valid_starts:
                    return {
                        "error": f"week_weekend_start must be one of: {valid_starts}"
                    }

            # Validate week_month_boundary_mode
            if "week_month_boundary_mode" in settings_data:
                valid_modes = ["keep_intact", "split_by_month"]
                if settings_data["week_month_boundary_mode"] not in valid_modes:
                    return {
                        "error": f"week_month_boundary_mode must be one of: {valid_modes}"
                    }

        # No validation errors
        return None

    def get_tool_info(self) -> dict[str, Any]:
        """Return information about the tools provided by this class."""
        return {
            "category": "settings_management",
            "tools": [
                {
                    "name": "manage_settings",
                    "description": "Manage application settings across all categories",
                    "operations": ["read", "read_all", "update"],
                    "categories": [
                        "general",
                        "scheduling",
                        "display",
                        "pdf_layout",
                        "employee_groups",
                        "availability_types",
                        "actions",
                        "ai_scheduling",
                        "week_navigation",
                    ],
                }
            ],
        }
