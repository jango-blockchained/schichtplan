#!/usr/bin/env python3
"""
Test script to verify MEP PDF config integration between frontend and backend.
"""

import sys

sys.path.append("/home/jango/Git/maike2/schichtplan")

import json

from src.backend.schemas.settings import (
    PDFLayoutSettingsSchema,
    SimplifiedPDFConfigSchema,
)

# Test MEP config that matches the frontend structure
test_mep_config = {
    "mep_config": {
        "preset": "mep_standard",
        "mepHeader": {
            "title": "Mitarbeiter-Einsatz-Planung (MEP)",
            "filiale": "Filiale Muster",
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
            "planWeekColumn": {"width": 50, "label": "Plan/Woche"},
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
                },
                "tuesday": {
                    "width": 70,
                    "label": "Dienstag",
                    "subLabels": [
                        "Datum",
                        "Wer/tätig",
                        "Beginn",
                        "Pause",
                        "Ende",
                        "Summe/Tag",
                    ],
                },
                "wednesday": {
                    "width": 70,
                    "label": "Mittwoch",
                    "subLabels": [
                        "Datum",
                        "Wer/tätig",
                        "Beginn",
                        "Pause",
                        "Ende",
                        "Summe/Tag",
                    ],
                },
                "thursday": {
                    "width": 70,
                    "label": "Donnerstag",
                    "subLabels": [
                        "Datum",
                        "Wer/tätig",
                        "Beginn",
                        "Pause",
                        "Ende",
                        "Summe/Tag",
                    ],
                },
                "friday": {
                    "width": 70,
                    "label": "Freitag",
                    "subLabels": [
                        "Datum",
                        "Wer/tätig",
                        "Beginn",
                        "Pause",
                        "Ende",
                        "Summe/Tag",
                    ],
                },
                "saturday": {
                    "width": 70,
                    "label": "Samstag",
                    "subLabels": [
                        "Datum",
                        "Wer/tätig",
                        "Beginn",
                        "Pause",
                        "Ende",
                        "Summe/Tag",
                    ],
                },
                "sunday": {
                    "width": 70,
                    "label": "Sonntag",
                    "subLabels": [
                        "Datum",
                        "Wer/tätig",
                        "Beginn",
                        "Pause",
                        "Ende",
                        "Summe/Tag",
                    ],
                },
            },
            "summaryWeekColumn": {"width": 50, "label": "Summe/Woche"},
            "summaryMonthColumn": {"width": 50, "label": "Summe/Monat"},
            "employeeRowStructure": {
                "beginRow": {"label": "Beginn", "height": 12},
                "pauseRow": {"label": "Pause", "height": 12},
                "endRow": {"label": "Ende", "height": 12},
                "summaryRow": {"label": "Summe/Tag", "height": 12},
            },
        },
        "mepFooter": {
            "breakRules": {
                "title": "Pausenzeiten:",
                "sixHourRule": "bis 6 Stunden: keine Pause",
                "overSixHourRule": "mehr als 6 Stunden: 60 Minuten",
            },
            "absenceTypes": {
                "title": "Abwesenheiten:",
                "holiday": "Feiertag",
                "illness": "Krankheit (AU-Bescheinigung)",
                "vacation": "Freizeit",
                "leave": "Urlaub",
            },
            "instructions": {
                "title": "Anwesenheiten:",
                "text": "Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen. Am Ende der Woche: wöchentliche und monatliche Summe eintragen.",
            },
            "dateStamp": {"text": "Stand: Oktober 2014", "position": "right"},
        },
        "styling": {
            "fontFamily": "Helvetica",
            "headerFontSize": 11,
            "tableFontSize": 7,
            "footerFontSize": 6,
            "colors": {
                "headerText": "#000000",
                "tableText": "#000000",
                "tableBorder": "#000000",
                "tableHeader": "#f0f0f0",
            },
            "spacing": {"headerSpacing": 6, "tableSpacing": 2, "footerSpacing": 4},
            "tableStyle": {"borderWidth": 1, "cellPadding": 2, "rowHeight": 12},
        },
    }
}


def test_schema_validation():
    """Test that the MEP config validates correctly with the Pydantic schema."""
    print("Testing MEP config schema validation...")

    try:
        # Test the full PDF layout schema
        validated_config = PDFLayoutSettingsSchema(**test_mep_config)
        print("✓ PDF Layout schema validation passed")

        # Test just the MEP config part
        mep_config_only = test_mep_config["mep_config"]
        SimplifiedPDFConfigSchema(**mep_config_only)
        print("✓ MEP config schema validation passed")

        # Convert to dict and print structure
        config_dict = validated_config.dict(exclude_none=True)
        print(f"✓ Config structure validated: {len(config_dict)} top-level keys")

        return True

    except Exception as e:
        print(f"✗ Schema validation failed: {e}")
        return False


def test_json_serialization():
    """Test that the config can be properly serialized/deserialized."""
    print("\nTesting JSON serialization...")

    try:
        # Test serialization
        json_str = json.dumps(test_mep_config, indent=2)
        print("✓ JSON serialization passed")

        # Test deserialization
        deserialized = json.loads(json_str)
        print("✓ JSON deserialization passed")

        # Test schema validation after round-trip
        PDFLayoutSettingsSchema(**deserialized)
        print("✓ Schema validation after JSON round-trip passed")

        return True

    except Exception as e:
        print(f"✗ JSON serialization test failed: {e}")
        return False


def main():
    """Run all tests."""
    print("=== MEP PDF Config Integration Test ===\n")

    all_passed = True

    # Test schema validation
    all_passed &= test_schema_validation()

    # Test JSON serialization
    all_passed &= test_json_serialization()

    print("\n=== Test Results ===")
    if all_passed:
        print(
            "✓ All tests passed! The MEP config structure is ready for frontend-backend integration."
        )
    else:
        print("✗ Some tests failed. Check the error messages above.")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
