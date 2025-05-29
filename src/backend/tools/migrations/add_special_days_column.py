#!/usr/bin/env python
"""
Add Special Days Column Migration

Description:
    Adds the 'special_days' column to the settings table.
    This is needed because we updated the Settings model but didn't create
    a proper Alembic migration. This script can run independently from Alembic.

Usage:
    python src/backend/tools/migrations/add_special_days_column.py [--dry-run]

Options:
    --dry-run   Show what would be changed without making changes

Author: Claude
Date: 2024-07-11
"""

import os
import sys
import sqlite3
import json
import argparse
from pathlib import Path

# Parse arguments
parser = argparse.ArgumentParser(
    description="Add special_days column to settings table"
)
parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Show what would be changed without making changes",
)
args = parser.parse_args()

# Standard path resolution
current_file = Path(__file__).resolve()
current_dir = current_file.parent
backend_dir = current_dir.parents[1]  # /src/backend
src_dir = backend_dir.parent  # /src
project_dir = src_dir.parent  # /

# Database path (as defined in app.py)
instance_dir = src_dir / "instance"
db_path = instance_dir / "app.db"


def main():
    print(f"Using database at: {db_path}")

    if not db_path.exists():
        print(f"Error: Database file doesn't exist at {db_path}")
        sys.exit(1)

    # Connect to the database
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # 1. Check if migration is needed
        print("Checking if special_days column already exists...")
        cursor.execute("PRAGMA table_info(settings)")
        columns = [col[1] for col in cursor.fetchall()]

        if "special_days" in columns:
            print("Column 'special_days' already exists in the settings table.")
            return

        # 2. Perform the migration
        print("Adding 'special_days' column to settings table...")
        if args.dry_run:
            print("DRY RUN - No changes will be made")
            print("Would add column 'special_days' to table 'settings'")
            print("Would convert existing special_hours data to special_days format")
        else:
            # Add the special_days column with default empty JSON object
            cursor.execute(
                "ALTER TABLE settings ADD COLUMN special_days TEXT DEFAULT '{}'"
            )

            # Convert any existing special_hours to special_days format
            cursor.execute("SELECT id, special_hours FROM settings")
            rows = cursor.fetchall()

            for row in rows:
                settings_id, special_hours_json = row

                if special_hours_json:
                    try:
                        special_hours = json.loads(special_hours_json)

                        # Convert to special_days format
                        special_days = {}
                        for date_str, details in special_hours.items():
                            special_days[date_str] = {
                                "description": f"Special day ({date_str})",
                                "is_closed": details.get("is_closed", False),
                            }

                            # Add custom_hours if not closed
                            if not details.get("is_closed", False):
                                special_days[date_str]["custom_hours"] = {
                                    "opening": details.get("opening", "09:00"),
                                    "closing": details.get("closing", "20:00"),
                                }

                        # Update the row with the new special_days data
                        cursor.execute(
                            "UPDATE settings SET special_days = ? WHERE id = ?",
                            (json.dumps(special_days), settings_id),
                        )

                        print(
                            f"Converted {len(special_days)} special hours to special days format"
                        )

                    except json.JSONDecodeError:
                        print(
                            f"Warning: Invalid JSON in special_hours for settings ID {settings_id}"
                        )

            conn.commit()
            print("Migration completed successfully!")

            # Verify the migration
            print("Verifying migration...")
            cursor.execute("PRAGMA table_info(settings)")
            columns = [col[1] for col in cursor.fetchall()]
            if "special_days" in columns:
                print("Verification successful: special_days column exists")
            else:
                print(
                    "WARNING: Verification failed! special_days column not found after migration"
                )

        conn.close()

    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
