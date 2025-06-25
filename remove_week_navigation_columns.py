#!/usr/bin/env python3
"""
Migration script to remove old week navigation columns from the settings table.

This script removes:
- enable_week_navigation
- week_navigation_default

And keeps:
- week_weekend_start
- week_month_boundary_mode
"""

import os
import sys

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text

from src.backend.app import create_app
from src.backend.models import db


def remove_week_navigation_columns():
    """Remove the old week navigation columns from the settings table."""
    app = create_app()

    with app.app_context():
        try:
            # Check if columns exist before trying to drop them
            inspector = db.inspect(db.engine)
            columns = [col["name"] for col in inspector.get_columns("settings")]

            columns_to_remove = ["enable_week_navigation", "week_navigation_default"]

            for column in columns_to_remove:
                if column in columns:
                    print(f"Removing column: {column}")
                    # SQLite doesn't support DROP COLUMN directly, so we need to check the database type
                    if db.engine.dialect.name == "sqlite":
                        print(
                            f"SQLite detected - column {column} will be ignored in code but kept in database"
                        )
                        print(
                            "Note: SQLite doesn't support dropping columns easily. The columns will remain in the database but won't be used."
                        )
                    else:
                        # For other databases (PostgreSQL, MySQL, etc.)
                        db.session.execute(
                            text(f"ALTER TABLE settings DROP COLUMN {column}")
                        )
                else:
                    print(f"Column {column} does not exist, skipping...")

            db.session.commit()
            print("Migration completed successfully!")

        except Exception as e:
            db.session.rollback()
            print(f"Error during migration: {str(e)}")
            raise


if __name__ == "__main__":
    remove_week_navigation_columns()
