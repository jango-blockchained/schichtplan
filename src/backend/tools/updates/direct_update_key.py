#!/usr/bin/env python
"""Script to directly update the Gemini API key in the SQLite database without Flask-SQLAlchemy"""

import json
import sqlite3
from pathlib import Path

# Get the project root directory
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
project_root = backend_dir.parent.parent

# Path to the SQLite database
DB_PATH = project_root / "instance" / "app.db"


def update_gemini_api_key_directly():
    """Update Gemini API key in the database settings by directly accessing SQLite"""
    print(f"Looking for SQLite database at: {DB_PATH}")

    if not DB_PATH.exists():
        print(f"Error: Database file not found at {DB_PATH}")
        print(
            "Please make sure the application has been run at least once to initialize the database."
        )
        return

    # Get the API key from input
    api_key = input("Enter your Gemini API key: ").strip()
    if not api_key:
        print("No API key provided. Exiting.")
        return

    try:
        # Connect to the SQLite database
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()

        # Check if the settings table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
        )
        if not cursor.fetchone():
            print("Creating settings table...")
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                value TEXT
            )
            """)

        # Check if ai_scheduling key exists
        cursor.execute("SELECT value FROM settings WHERE key=?", ("ai_scheduling",))
        result = cursor.fetchone()

        ai_settings = {}
        if result:
            # Parse existing JSON if available
            try:
                ai_settings = json.loads(result[0])
                if not isinstance(ai_settings, dict):
                    ai_settings = {}
            except json.JSONDecodeError:
                print(
                    "Warning: Existing ai_scheduling value is not valid JSON. Resetting."
                )
                ai_settings = {}

        # Update the API key
        ai_settings["api_key"] = api_key
        ai_settings["enabled"] = True

        # Serialize settings back to JSON
        ai_settings_json = json.dumps(ai_settings)

        # Update or insert the settings
        if result:
            cursor.execute(
                "UPDATE settings SET value=? WHERE key=?",
                (ai_settings_json, "ai_scheduling"),
            )
        else:
            cursor.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)",
                ("ai_scheduling", ai_settings_json),
            )

        # Commit changes
        conn.commit()

        # Verify the update
        cursor.execute("SELECT value FROM settings WHERE key=?", ("ai_scheduling",))
        verification = cursor.fetchone()

        if verification:
            print("\nDatabase updated successfully.")
            # Print masked API key for security
            masked_key = (
                api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
                if len(api_key) > 8
                else "****"
            )
            print(f"API Key: {masked_key}")
            print(f"Settings value: {verification[0]}")
            print("\nPlease restart the backend server for changes to take effect.")
            print("The KI generation feature should work after restarting.")
        else:
            print("Error: Failed to verify the update.")

    except sqlite3.Error as e:
        print(f"SQLite error: {e}")

    finally:
        # Close the database connection
        if "conn" in locals():
            conn.close()


if __name__ == "__main__":
    update_gemini_api_key_directly()
