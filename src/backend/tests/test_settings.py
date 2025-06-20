import pytest
from flask import Flask

from src.backend.app import create_app  # Assuming create_app is in src.backend.app
from src.backend.models import Settings, db

# Sample data for testing
DEFAULT_SETTINGS_DICT_EXPECTATION = {
    "general": {
        "store_name": "TEDi Filiale #6729",
        "store_address": "Hauptstraße 1, 12345 Musterstadt",
        "store_phone": "01234/567890",
        "store_email": "info@meinladen.de",
        "timezone": "Europe/Berlin",
        "language": "de",
        "date_format": "DD.MM.YYYY",
        "time_format": "HH:mm",
        "store_opening": "09:00",
        "store_closing": "20:00",
        "keyholder_before_minutes": 5,
        "keyholder_after_minutes": 10,
        "opening_days": {
            "monday": True,
            "tuesday": True,
            "wednesday": True,
            "thursday": True,
            "friday": True,
            "saturday": True,
            "sunday": False,
        },
        "special_days": {},
    },
    "scheduling": {
        "scheduling_resource_type": "coverage",
        "default_shift_duration": 6.0,
        "min_break_duration": 5,
        "max_daily_hours": 12.0,
        "max_weekly_hours": 50.0,
        "min_rest_between_shifts": 11.0,
        "scheduling_period_weeks": 4,
        "auto_schedule_preferences": True,
        "enable_diagnostics": False,
        "generation_requirements": {
            "enforce_minimum_coverage": True,
            "enforce_contracted_hours": True,
            "enforce_keyholder_coverage": True,
            "enforce_rest_periods": True,
            "enforce_early_late_rules": True,
            "enforce_employee_group_rules": True,
            "enforce_break_rules": True,
            "enforce_max_hours": True,
            "enforce_consecutive_days": True,
            "enforce_weekend_distribution": True,
            "enforce_shift_distribution": True,
            "enforce_availability": True,
            "enforce_qualifications": True,
            "enforce_opening_hours": True,
        },
        "scheduling_algorithm": "standard",
        "max_generation_attempts": 100,
    },
    "display": {
        "theme": "light",
        "primary_color": "#3B82F6",
        "secondary_color": "#1F2937",
        "accent_color": "#10B981",
        "background_color": "#F9FAFB",
        "surface_color": "#FFFFFF",
        "text_color": "#1F2937",
        "dark_theme": {
            "primary_color": "#60A5FA",
            "secondary_color": "#F3F4F6",
            "accent_color": "#34D399",
            "background_color": "#1F2937",
            "surface_color": "#374151",
            "text_color": "#F9FAFB",
        },
        "show_sunday": False,
        "show_weekdays": True,
        "start_of_week": 1,
        "calendar_start_day": "monday",
        "calendar_default_view": "week",
        "email_notifications": False,
        "schedule_published_notify": False,
        "shift_changes_notify": False,
        "time_off_requests_notify": False,
    },
    "pdf_layout": {
        "page_size": "A4",
        "orientation": "landscape",
        "margins": {"top": 15.0, "right": 15.0, "bottom": 15.0, "left": 15.0},
        "table_style": {
            "header_bg_color": "#E5E7EB",
            "border_color": "#D1D5DB",
            "text_color": "#1F2937",
            "header_text_color": "#111827",
        },
        "fonts": {"family": "Arial", "size": 9.0, "header_size": 11.0},
        "content": {
            "show_employee_id": False,
            "show_position": True,
            "show_breaks": True,
            "show_total_hours": True,
        },
    },
    "employee_groups": {
        "employee_types": [
            {
                "id": "VZ",
                "name": "Vollzeit",
                "min_hours": 35,
                "max_hours": 40,
                "type": "employee_type",
            },
            {
                "id": "TZ",
                "name": "Teilzeit",
                "min_hours": 15,
                "max_hours": 34,
                "type": "employee_type",
            },
            {
                "id": "GFB",
                "name": "Geringfügig Beschäftigt",
                "min_hours": 0,
                "max_hours": 14,
                "type": "employee_type",
            },
            {
                "id": "TL",
                "name": "Teamleiter",
                "min_hours": 35,
                "max_hours": 40,
                "type": "employee_type",
            },
        ],
        "shift_types": [
            {
                "id": "EARLY",
                "name": "Früh",
                "color": "#10B981",
                "type": "shift_type",
                "auto_assign_only": False,
            },
            {
                "id": "MIDDLE",
                "name": "Mittel",
                "color": "#3B82F6",
                "type": "shift_type",
                "auto_assign_only": False,
            },
            {
                "id": "LATE",
                "name": "Spät",
                "color": "#F59E0B",
                "type": "shift_type",
                "auto_assign_only": False,
            },
            {
                "id": "NO_WORK",
                "name": "Kein Dienst",
                "color": "#9E9E9E",
                "type": "shift_type",
                "auto_assign_only": True,
            },
            {
                "id": "UNAVAILABLE",
                "name": "Nicht verfügbar",
                "color": "#ef4444",
                "type": "shift_type",
                "auto_assign_only": True,
            },
        ],
        "absence_types": [
            {"id": "URL", "name": "Urlaub", "color": "#FF9800", "type": "absence_type"},
            {
                "id": "KRANK",
                "name": "Krank",
                "color": "#F44336",
                "type": "absence_type",
            },
            {
                "id": "SLG",
                "name": "Schulung",
                "color": "#4CAF50",
                "type": "absence_type",
            },
        ],
    },
    "availability_types": {
        "types": [
            {
                "id": "AVAILABLE",
                "name": "Verfügbar",
                "description": "Mitarbeiter ist verfügbar",
                "color": "#22c55e",
                "priority": 2,
                "is_available": True,
                "type": "availability_type",
            },
            {
                "id": "FIXED",
                "name": "Fix",
                "description": "Feste Arbeitszeiten",
                "color": "#3b82f6",
                "priority": 1,
                "is_available": True,
                "type": "availability_type",
            },
            {
                "id": "PREFERRED",
                "name": "Bevorzugt",
                "description": "Bevorzugte Arbeitszeiten",
                "color": "#f59e0b",
                "priority": 3,
                "is_available": True,
                "type": "availability_type",
            },
            {
                "id": "UNAVAILABLE",
                "name": "Nicht verfügbar",
                "description": "Mitarbeiter ist nicht verfügbar",
                "color": "#ef4444",
                "priority": 4,
                "is_available": False,
                "type": "availability_type",
            },
        ]
    },
    "actions": {"demo_data": {"selected_module": "", "last_execution": None}},
    "ai_scheduling": {"enabled": False, "api_key": ""},
}


@pytest.fixture(scope="module")
def app():
    app = create_app("testing")  # Use a testing configuration
    with app.app_context():
        db.create_all()
        # Ensure default settings are created if not present
        Settings.get_or_create_default()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture(scope="module")
def client(app: Flask):
    return app.test_client()


def test_get_default_settings_to_dict(app: Flask):
    """Test that the default settings are correctly serialized by to_dict."""
    with app.app_context():
        settings = Settings.get_or_create_default()
        settings_dict = settings.to_dict()

        # Normalize availability_types for comparison if necessary
        # The default in model has 'type' field, ensure test data matches or normalize here
        if (
            "availability_types" in settings_dict
            and "types" in settings_dict["availability_types"]
        ):
            for at_type in settings_dict["availability_types"]["types"]:
                if "type" not in at_type:  # Add if missing for comparison
                    at_type["type"] = "availability_type"

        # Compare each category
        for category, expected_values in DEFAULT_SETTINGS_DICT_EXPECTATION.items():
            assert category in settings_dict, (
                f"Category {category} missing in settings_dict"
            )
            # Deep comparison for nested dicts, careful with list order if not guaranteed
            if isinstance(expected_values, dict):
                for key, expected_value in expected_values.items():
                    assert key in settings_dict[category], (
                        f"Key {key} missing in settings_dict[{category}]"
                    )
                    if isinstance(expected_value, list):
                        # Sort lists of dicts by 'id' if present, for stable comparison
                        if all(
                            isinstance(item, dict) and "id" in item
                            for item in expected_value
                        ):
                            expected_sorted = sorted(
                                expected_value, key=lambda x: x["id"]
                            )
                            actual_sorted = sorted(
                                settings_dict[category][key], key=lambda x: x["id"]
                            )
                            assert actual_sorted == expected_sorted, (
                                f"Mismatch in {category}.{key}"
                            )
                        else:
                            assert settings_dict[category][key] == expected_value, (
                                f"Mismatch in {category}.{key}"
                            )
                    else:
                        assert settings_dict[category][key] == expected_value, (
                            f"Mismatch in {category}.{key}"
                        )
            else:
                assert settings_dict[category] == expected_values, (
                    f"Mismatch in {category}"
                )


def test_update_settings_from_dict(app: Flask):
    """Test updating settings using update_from_dict method."""
    with app.app_context():
        # Start with default settings
        Settings.get_or_create_default()

        update_data = {
            "general": {
                "store_name": "Updated Store Name",
                "language": "en",
                "opening_days": {"monday": False, "tuesday": True},  # Partial update
                "special_days": {"2025-12-25": {"name": "Xmas", "is_closed": True}},
            },
            "scheduling": {
                "default_shift_duration": 7.5,
                "generation_requirements": {
                    "enforce_max_hours": False
                },  # Partial update
            },
            "display": {
                "theme": "dark",
                "dark_theme": {"primary_color": "#aabbcc"},  # Partial update
            },
            "pdf_layout": {
                "orientation": "portrait",
                "margins": {"top": 10.0},  # Partial update
            },
            "employee_groups": {
                "employee_types": [  # Full replacement
                    {
                        "id": "NEW_VZ",
                        "name": "New Vollzeit",
                        "min_hours": 30,
                        "max_hours": 38,
                        "type": "employee_type",
                    }
                ],
                "absence_types": [],  # Clear all
            },
            "availability_types": {  # Full replacement
                "types": [
                    {
                        "id": "WORK",
                        "name": "Working",
                        "color": "#00FF00",
                        "priority": 1,
                        "is_available": True,
                        "type": "availability_type",
                    }
                ]
            },
            "actions": {
                "demo_data": {
                    "selected_module": "employees",
                    "last_execution": "2025-01-01T10:00:00",
                }
            },
            "ai_scheduling": {"enabled": True, "api_key": "test_key_123"},
        }
        Settings.update_from_dict(update_data)

        updated_settings = Settings.query.first()
        updated_settings_dict = updated_settings.to_dict()

        # General assertions
        assert updated_settings_dict["general"]["store_name"] == "Updated Store Name"
        assert updated_settings_dict["general"]["language"] == "en"
        assert updated_settings_dict["general"]["opening_days"]["monday"] == False
        assert (
            updated_settings_dict["general"]["opening_days"]["tuesday"] == True
        )  # Check if others preserved
        assert "2025-12-25" in updated_settings_dict["general"]["special_days"]

        # Scheduling assertions
        assert updated_settings_dict["scheduling"]["default_shift_duration"] == 7.5
        assert (
            updated_settings_dict["scheduling"]["generation_requirements"][
                "enforce_max_hours"
            ]
            == False
        )
        assert (
            updated_settings_dict["scheduling"]["generation_requirements"][
                "enforce_minimum_coverage"
            ]
            == True
        )  # Check preserved

        # Display assertions
        assert updated_settings_dict["display"]["theme"] == "dark"
        assert (
            updated_settings_dict["display"]["dark_theme"]["primary_color"] == "#aabbcc"
        )

        # PDF Layout assertions
        assert updated_settings_dict["pdf_layout"]["orientation"] == "portrait"
        assert updated_settings_dict["pdf_layout"]["margins"]["top"] == 10.0

        # Employee Groups assertions
        assert len(updated_settings_dict["employee_groups"]["employee_types"]) == 1
        assert (
            updated_settings_dict["employee_groups"]["employee_types"][0]["id"]
            == "NEW_VZ"
        )
        assert len(updated_settings_dict["employee_groups"]["absence_types"]) == 0
        # Shift types should remain default as it wasn't in update_data["employee_groups"]
        assert len(updated_settings_dict["employee_groups"]["shift_types"]) > 0

        # Availability Types assertions
        assert len(updated_settings_dict["availability_types"]["types"]) == 1
        assert updated_settings_dict["availability_types"]["types"][0]["id"] == "WORK"

        # Actions assertions
        assert (
            updated_settings_dict["actions"]["demo_data"]["selected_module"]
            == "employees"
        )

        # AI Scheduling assertions
        assert updated_settings_dict["ai_scheduling"]["enabled"] == True
        assert updated_settings_dict["ai_scheduling"]["api_key"] == "test_key_123"


# --- API Tests ---


def test_get_settings_api(client):
    """Test GET /api/v2/settings/ endpoint."""
    # Reset settings to default before test
    from src.backend.models import Settings

    with client.application.app_context():
        Settings.query.delete()
        Settings.get_or_create_default()
    response = client.get("/api/v2/settings/")
    assert response.status_code == 200
    data = response.json
    # Basic check, compare with default settings dict (or parts of it)
    assert (
        data["general"]["store_name"]
        == DEFAULT_SETTINGS_DICT_EXPECTATION["general"]["store_name"]
    )
    assert len(data["employee_groups"]["employee_types"]) == len(
        DEFAULT_SETTINGS_DICT_EXPECTATION["employee_groups"]["employee_types"]
    )


def test_update_settings_api(client):
    """Test PUT /api/v2/settings/ endpoint."""
    update_payload = {
        "general": {"store_name": "API Updated Store"},
        "scheduling": {"max_weekly_hours": 38.0},
        "employee_groups": {
            "shift_types": [
                {
                    "id": "NIGHT",
                    "name": "Nacht",
                    "color": "#000000",
                    "type": "shift_type",
                    "auto_assign_only": False,
                }
            ]
        },
    }
    response = client.put("/api/v2/settings/", json=update_payload)
    assert response.status_code == 200
    data = response.json

    assert data["general"]["store_name"] == "API Updated Store"
    assert data["scheduling"]["max_weekly_hours"] == 38.0
    assert len(data["employee_groups"]["shift_types"]) == 1
    assert data["employee_groups"]["shift_types"][0]["id"] == "NIGHT"

    # Verify persistence by GETting again
    get_response = client.get("/api/v2/settings/")
    assert get_response.status_code == 200
    get_data = get_response.json
    assert get_data["general"]["store_name"] == "API Updated Store"
    assert get_data["scheduling"]["max_weekly_hours"] == 38.0
    assert get_data["employee_groups"]["shift_types"][0]["id"] == "NIGHT"


def test_update_settings_api_partial_employee_groups(client):
    """Test PUT /api/v2/settings/ with partial update to employee_groups."""
    # First, ensure we have some defaults
    client.get("/api/v2/settings/")  # This ensures defaults are loaded if db was empty

    initial_settings_response = client.get("/api/v2/settings/")
    initial_employee_types_count = len(
        initial_settings_response.json["employee_groups"]["employee_types"]
    )
    initial_absence_types_count = len(
        initial_settings_response.json["employee_groups"]["absence_types"]
    )

    update_payload = {
        "employee_groups": {
            "shift_types": [
                {
                    "id": "SPECIAL_SHIFT",
                    "name": "Sonderschicht",
                    "color": "#FF00FF",
                    "type": "shift_type",
                    "auto_assign_only": False,
                }
            ]
            # Note: employee_types and absence_types are NOT included in this update
        }
    }
    response = client.put("/api/v2/settings/", json=update_payload)
    assert response.status_code == 200
    data = response.json

    # Check that shift_types were updated
    assert len(data["employee_groups"]["shift_types"]) == 1
    assert data["employee_groups"]["shift_types"][0]["id"] == "SPECIAL_SHIFT"

    # Check that employee_types and absence_types were preserved from the previous state
    assert (
        len(data["employee_groups"]["employee_types"]) == initial_employee_types_count
    )
    assert len(data["employee_groups"]["absence_types"]) == initial_absence_types_count

    # Verify with another GET
    get_response = client.get("/api/v2/settings/")
    get_data = get_response.json
    assert len(get_data["employee_groups"]["shift_types"]) == 1
    assert get_data["employee_groups"]["shift_types"][0]["id"] == "SPECIAL_SHIFT"
    assert (
        len(get_data["employee_groups"]["employee_types"])
        == initial_employee_types_count
    )
    assert (
        len(get_data["employee_groups"]["absence_types"]) == initial_absence_types_count
    )


# Add more tests for edge cases, invalid inputs, specific field validations etc.
# For example:
# - Test updating only one field in a nested dict (e.g., general.timezone)
# - Test sending empty lists/dicts for fields like employee_types, special_days
# - Test invalid data types for fields
# - Test validation logic in update_from_dict (e.g., opening_days key conversion)
