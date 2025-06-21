#!/usr/bin/env python3
"""
Test script to verify MEP config can be saved/loaded via the API.
"""

import time

import requests

# API base URL
API_BASE = "http://localhost:5000/api"

# Test MEP config that matches our schema
test_mep_config = {
    "mep_config": {
        "preset": "mep_standard",
        "mepHeader": {
            "title": "Mitarbeiter-Einsatz-Planung (MEP)",
            "filiale": "Test Filiale",
            "monthYear": "Juni 2025",
            "weekFrom": "17.06.2025",
            "weekTo": "23.06.2025",
            "storageNote": "Aufbewahrung in der Filiale: 2 Jahre",
        },
        "pageSetup": {
            "size": "A4",
            "orientation": "landscape",
            "margins": {"top": 20, "right": 15, "bottom": 25, "left": 15},
        },
        "tableStructure": {
            "nameColumn": {"width": 80, "label": "Name, Vorname"},
            "positionColumn": {"width": 60, "label": "Funktion"},
            "dayColumns": {
                "monday": {
                    "width": 70,
                    "label": "Montag",
                    "subLabels": [
                        "Datum",
                        "Wer/tätig",
                        "Beginn",
                        "Pause",
                        "Ende",
                        "Summe/Tag",
                    ],
                }
            },
        },
        "mepFooter": {
            "breakRules": {
                "title": "Pausenzeiten:",
                "sixHourRule": "bis 6 Stunden: keine Pause",
                "overSixHourRule": "mehr als 6 Stunden: 60 Minuten",
            }
        },
    }
}


def test_api_connectivity():
    """Test if the API is accessible."""
    print("Testing API connectivity...")
    try:
        response = requests.get(f"{API_BASE}/settings", timeout=5)
        if response.status_code == 200:
            print("✓ API is accessible")
            return True
        else:
            print(f"✗ API returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Cannot connect to API: {e}")
        return False


def test_save_mep_config():
    """Test saving MEP config via API."""
    print("\nTesting MEP config save...")
    try:
        response = requests.put(
            f"{API_BASE}/settings/pdf_layout",
            json=test_mep_config,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.status_code == 200:
            print("✓ MEP config saved successfully")
            return response.json()
        else:
            print(f"✗ Save failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"✗ Save request failed: {e}")
        return None


def test_load_mep_config():
    """Test loading MEP config via API."""
    print("\nTesting MEP config load...")
    try:
        response = requests.get(f"{API_BASE}/settings/pdf_layout", timeout=10)

        if response.status_code == 200:
            data = response.json()
            if "mep_config" in data:
                print("✓ MEP config loaded successfully")
                return data
            else:
                print("✗ MEP config not found in response")
                return None
        else:
            print(f"✗ Load failed with status {response.status_code}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"✗ Load request failed: {e}")
        return None


def test_config_integrity(saved_data, loaded_data):
    """Test that saved and loaded configs match."""
    print("\nTesting config integrity...")
    try:
        saved_mep = saved_data.get("mep_config", {})
        loaded_mep = loaded_data.get("mep_config", {})

        # Check key fields
        if saved_mep.get("preset") == loaded_mep.get("preset"):
            print("✓ Preset field preserved")
        else:
            print("✗ Preset field mismatch")
            return False

        if saved_mep.get("mepHeader", {}).get("title") == loaded_mep.get(
            "mepHeader", {}
        ).get("title"):
            print("✓ Header title preserved")
        else:
            print("✗ Header title mismatch")
            return False

        print("✓ Config integrity verified")
        return True

    except Exception as e:
        print(f"✗ Config integrity check failed: {e}")
        return False


def main():
    """Run all API tests."""
    print("=== MEP API Integration Test ===\n")

    # Wait for backend to be ready
    print("Waiting for backend to start...")
    time.sleep(3)

    all_passed = True

    # Test API connectivity
    if not test_api_connectivity():
        print("\nAPI is not accessible. Make sure the Flask backend is running.")
        return 1

    # Test saving config
    saved_data = test_save_mep_config()
    if not saved_data:
        all_passed = False

    # Test loading config
    loaded_data = test_load_mep_config()
    if not loaded_data:
        all_passed = False

    # Test integrity
    if saved_data and loaded_data:
        if not test_config_integrity(saved_data, loaded_data):
            all_passed = False

    print("\n=== Test Results ===")
    if all_passed:
        print("✓ All API tests passed! MEP config integration works correctly.")
    else:
        print("✗ Some API tests failed. Check the backend logs.")

    return 0 if all_passed else 1


if __name__ == "__main__":
    exit(main())
