#!/usr/bin/env python
# update_ai_config.py - Update AI configuration using SQLite directly

import json
import sqlite3
from pathlib import Path

# Add the parent directory to the path so imports work
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent
project_path = backend_dir.parent.parent


def update_ai_config():
    """Update AI configuration in the SQLite database directly"""

    # API key to save
    api_key = "AIzaSyBHkmdaJzg4R249RunbNlbWo8HUjy425vM"

    # The configuration to save
    ai_config = {
        "api_key": api_key,
        "enabled": True,
        "model": "gemini-1.5-flash",  # Use the working model
        "temperature": 0.7,
    }

    # Find the SQLite database
    try:
        # Common database locations
        possible_db_paths = [
            project_path / "instance" / "app.db",
            project_path / "src" / "backend" / "instance" / "app.db",
            project_path / "src" / "instance" / "app.db",
            backend_dir / "instance" / "app.db",
        ]

        db_path = None
        for path in possible_db_paths:
            if path.exists():
                db_path = path
                break

        if not db_path:
            print(
                "Database not found in common locations. Please specify the path manually."
            )
            return

        print(f"Using database at: {db_path}")

        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if settings table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
        )
        if not cursor.fetchone():
            print("Settings table not found in the database.")
            return

        # Check if there's an existing settings row
        cursor.execute("SELECT id, ai_scheduling FROM settings LIMIT 1")
        row = cursor.fetchone()

        if row:
            settings_id = row[0]
            print(f"Found existing settings with ID: {settings_id}")

            # Convert the config to JSON string
            ai_config_json = json.dumps(ai_config)

            # Update the settings
            cursor.execute(
                "UPDATE settings SET ai_scheduling = ? WHERE id = ?",
                (ai_config_json, settings_id),
            )

            conn.commit()
            print("AI settings updated successfully")

            # Verify the update
            cursor.execute(
                "SELECT ai_scheduling FROM settings WHERE id = ?", (settings_id,)
            )
            updated_row = cursor.fetchone()
            if updated_row:
                try:
                    updated_config = json.loads(updated_row[0])
                    masked_key = (
                        api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
                        if len(api_key) > 8
                        else "****"
                    )
                    print("\nUpdated configuration:")
                    print(f"API Key: {masked_key}")
                    print(f"Model: {updated_config.get('model')}")
                    print(f"Enabled: {updated_config.get('enabled')}")
                except (json.JSONDecodeError, TypeError):
                    print("Could not parse the updated JSON.")

        else:
            print("No settings found in the database. Creating new settings.")
            # Convert the config to JSON string
            ai_config_json = json.dumps(ai_config)

            # Insert new settings
            cursor.execute(
                "INSERT INTO settings (ai_scheduling) VALUES (?)", (ai_config_json,)
            )
            conn.commit()
            print("New settings with AI configuration created successfully.")

        conn.close()

    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    update_ai_config()
