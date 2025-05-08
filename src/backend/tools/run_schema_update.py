"""
Script to update the database schema to handle longer availability type values.
"""

import os
import sys
import logging
import sqlite3

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Make sure we can import from the backend directory
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)


def update_schema():
    """Update the database schema to handle longer availability type values"""
    try:
        # Find the database file
        db_path = os.path.join(current_dir, "..", "instance", "app.db")

        if not os.path.exists(db_path):
            logger.error(f"Database file not found at {db_path}")
            return False

        logger.info(f"Using database at {db_path}")

        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if schedules.availability_type needs updating
        cursor.execute("PRAGMA table_info(schedules)")
        columns = cursor.fetchall()

        # Find the availability_type column and check its type
        availability_type_column = next(
            (col for col in columns if col[1] == "availability_type"), None
        )

        if availability_type_column and "VARCHAR(3)" in availability_type_column[2]:
            logger.info("Updating schedules.availability_type column type...")

            # SQLite doesn't support direct ALTER COLUMN TYPE, so we need to:
            # 1. Create a new table with the updated schema
            # 2. Copy data from the old table
            # 3. Drop the old table
            # 4. Rename the new table

            # Create temporary table with new schema
            cursor.execute("""
                CREATE TABLE schedules_new (
                    id INTEGER PRIMARY KEY,
                    employee_id INTEGER NOT NULL,
                    shift_id INTEGER,
                    date DATETIME NOT NULL,
                    version INTEGER NOT NULL DEFAULT 1,
                    break_start VARCHAR(5),
                    break_end VARCHAR(5),
                    notes TEXT,
                    shift_type VARCHAR(20),
                    availability_type VARCHAR(15),
                    status VARCHAR(20) NOT NULL,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    FOREIGN KEY (employee_id) REFERENCES employees (id),
                    FOREIGN KEY (shift_id) REFERENCES shifts (id)
                )
            """)

            # Copy data
            cursor.execute("""
                INSERT INTO schedules_new
                SELECT id, employee_id, shift_id, date, version, break_start, break_end,
                       notes, shift_type, availability_type, status, created_at, updated_at
                FROM schedules
            """)

            # Drop old table
            cursor.execute("DROP TABLE schedules")

            # Rename new table
            cursor.execute("ALTER TABLE schedules_new RENAME TO schedules")

            logger.info("Schema update for schedules.availability_type completed")
        else:
            logger.info(
                "schedules.availability_type already has the correct type or doesn't exist"
            )

        # Commit and close
        conn.commit()
        conn.close()

        logger.info("Schema update completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error updating schema: {str(e)}")
        return False


if __name__ == "__main__":
    logger.info("Starting schema update...")

    if update_schema():
        logger.info("Schema update completed successfully.")
    else:
        logger.error("Schema update failed.")
        sys.exit(1)
