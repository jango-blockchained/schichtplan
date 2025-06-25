#!/usr/bin/env python3
"""
Migration script to add missing week_version column to schedule_version_meta table.
"""

import os
import sys

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text

from src.backend.app import create_app
from src.backend.models import db


def add_week_version_column():
    """Add the missing week_version column to the schedule_version_meta table."""
    app = create_app()

    with app.app_context():
        try:
            # Check if column exists
            inspector = db.inspect(db.engine)
            columns = [
                col["name"] for col in inspector.get_columns("schedule_version_meta")
            ]

            if "week_version" not in columns:
                print("Adding week_version column to schedule_version_meta table...")

                if db.engine.dialect.name == "sqlite":
                    # SQLite syntax
                    db.session.execute(
                        text(
                            "ALTER TABLE schedule_version_meta ADD COLUMN week_version VARCHAR(10) DEFAULT '1'"
                        )
                    )
                else:
                    # PostgreSQL/MySQL syntax
                    db.session.execute(
                        text(
                            "ALTER TABLE schedule_version_meta ADD COLUMN week_version VARCHAR(10) DEFAULT '1'"
                        )
                    )

                db.session.commit()
                print("✅ Successfully added week_version column")
            else:
                print("week_version column already exists")

            # Also check and add other missing columns if needed
            missing_columns = []
            expected_columns = {
                "week_identifier": "VARCHAR(20)",
                "month_boundary_mode": "VARCHAR(20) DEFAULT 'keep_intact'",
                "is_week_based": "BOOLEAN DEFAULT 0",
            }

            for col_name, col_def in expected_columns.items():
                if col_name not in columns:
                    missing_columns.append((col_name, col_def))

            if missing_columns:
                print(f"Adding {len(missing_columns)} missing columns...")
                for col_name, col_def in missing_columns:
                    print(f"Adding column: {col_name}")
                    if db.engine.dialect.name == "sqlite":
                        db.session.execute(
                            text(
                                f"ALTER TABLE schedule_version_meta ADD COLUMN {col_name} {col_def}"
                            )
                        )
                    else:
                        db.session.execute(
                            text(
                                f"ALTER TABLE schedule_version_meta ADD COLUMN {col_name} {col_def}"
                            )
                        )

                db.session.commit()
                print("✅ Successfully added all missing columns")

            print("Migration completed successfully!")

        except Exception as e:
            db.session.rollback()
            print(f"❌ Error during migration: {str(e)}")
            raise


if __name__ == "__main__":
    add_week_version_column()
