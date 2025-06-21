import requests


# Test MEP config API
def test_mep_config_api():
    base_url = "http://localhost:5000"
    api_url = f"{base_url}/api/v2/settings/"

    # MEP config test data matching our SimplifiedPDFConfig structure
    mep_config = {
        "pdf_layout": {
            "header": {
                "title": "Mitarbeiter-Einsatz-Planung (MEP)",
                "store_field": {"label": "Filiale:", "value": "Muster-Filiale"},
                "period_fields": {
                    "month_year": {"label": "Monat/Jahr", "value": "Juni 2025"},
                    "week_from": {"label": "Woche vom:", "value": "17.06.2025"},
                    "week_to": {"label": "bis:", "value": "23.06.2025"},
                },
                "storage_note": {
                    "text": "Aufbewahrung in der Filiale: 2 Jahre",
                    "position": "right",
                },
            },
            "table": {
                "employee_columns": {
                    "name": {"label": "Name, Vorname", "width": 25},
                    "function": {"label": "Funktion", "width": 15},
                    "plan_week": {"label": "Plan/Woche", "width": 12},
                },
                "day_columns": {
                    "enabled_days": [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    ],
                    "day_labels": {
                        "monday": "Montag",
                        "tuesday": "Dienstag",
                        "wednesday": "Mittwoch",
                        "thursday": "Donnerstag",
                        "friday": "Freitag",
                        "saturday": "Samstag",
                        "sunday": "Sonntag",
                    },
                    "day_width": 10,
                },
                "summary_columns": {
                    "week_total": {"label": "Summe/Woche", "width": 12},
                    "month_total": {"label": "Summe/Monat", "width": 12},
                },
                "row_structure": {
                    "date_row": {"label": "Datum", "enabled": True},
                    "active_row": {"label": "Wer/tätig", "enabled": True},
                    "start_row": {"label": "Beginn", "enabled": True},
                    "break_row": {"label": "Pause", "enabled": True},
                    "end_row": {"label": "Ende", "enabled": True},
                    "total_row": {"label": "Summe/Tag", "enabled": True},
                },
            },
            "footer": {
                "break_rules": {
                    "enabled": True,
                    "text": "bis 6 Stunden : keine Pause\nmehr als 6 Stunden : 60 Minuten",
                },
                "absence_types": {
                    "enabled": True,
                    "title": "Abwesenheiten:",
                    "types": [
                        {"code": "F", "label": "Feiertag"},
                        {"code": "FZ", "label": "Freizeit"},
                        {"code": "K", "label": "Krankheit (AU-Bescheinigung)"},
                        {"code": "S", "label": "Schule (Führungsnachwuchskraft)"},
                        {"code": "U", "label": "Urlaub"},
                    ],
                },
                "instructions": {
                    "enabled": True,
                    "text": "Arbeitszeiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und der Tagesstunden eintragen. Am Ende der Woche: wöchentliche und monatliche Summe eintragen.",
                },
                "date_stamp": {"enabled": True, "text": "Stand: Oktober 2014"},
            },
            "styling": {
                "fonts": {
                    "header_font": "Helvetica-Bold",
                    "header_size": 11,
                    "table_font": "Helvetica",
                    "table_size": 7,
                    "footer_font": "Helvetica",
                    "footer_size": 6,
                },
                "colors": {
                    "header_bg": "#FFFFFF",
                    "header_text": "#000000",
                    "table_border": "#000000",
                    "table_bg": "#FFFFFF",
                    "table_text": "#000000",
                },
                "spacing": {"page_margin": 15, "section_spacing": 6, "row_height": 12},
                "table_style": {
                    "border_width": 0.5,
                    "grid_style": "solid",
                    "cell_padding": 2,
                },
            },
        }
    }

    try:
        print("Testing MEP config save to backend...")

        # First, get current settings to see structure
        print("\n1. Getting current settings...")
        get_response = requests.get(api_url)
        print(f"GET Status: {get_response.status_code}")
        if get_response.status_code == 200:
            current_settings = get_response.json()
            print(f"Current settings keys: {list(current_settings.keys())}")
            if "pdf_layout" in current_settings:
                print(
                    f"Current pdf_layout keys: {list(current_settings['pdf_layout'].keys())}"
                )

        # Save the MEP config
        print("\n2. Saving MEP config...")
        put_response = requests.put(api_url, json=mep_config)
        print(f"PUT Status: {put_response.status_code}")
        print(f"PUT Response: {put_response.text}")

        if put_response.status_code == 200:
            print("✓ MEP config saved successfully!")

            # Verify the save
            print("\n3. Verifying saved config...")
            verify_response = requests.get(api_url)
            if verify_response.status_code == 200:
                saved_settings = verify_response.json()
                if "pdf_layout" in saved_settings:
                    saved_pdf_layout = saved_settings["pdf_layout"]
                    print("✓ Config verified! Saved structure:")
                    print(
                        f"  - Header title: {saved_pdf_layout.get('header', {}).get('title', 'NOT FOUND')}"
                    )
                    print(
                        f"  - Store field: {saved_pdf_layout.get('header', {}).get('store_field', {}).get('label', 'NOT FOUND')}"
                    )
                    print(
                        f"  - Day columns: {list(saved_pdf_layout.get('table', {}).get('day_columns', {}).get('day_labels', {}).keys())}"
                    )
                    print(
                        f"  - Footer enabled: {saved_pdf_layout.get('footer', {}).get('break_rules', {}).get('enabled', False)}"
                    )
                else:
                    print("✗ pdf_layout not found in saved settings")
            else:
                print(f"✗ Failed to verify: {verify_response.status_code}")
        else:
            print(f"✗ Failed to save MEP config: {put_response.status_code}")
            print(f"Error: {put_response.text}")

    except requests.exceptions.ConnectionError:
        print("✗ Connection failed - is the Flask backend running on port 5000?")
        print("Run: ./src/backend/.venv/bin/python -m src.backend.run runserver")
    except Exception as e:
        print(f"✗ Test failed: {e}")


if __name__ == "__main__":
    test_mep_config_api()
