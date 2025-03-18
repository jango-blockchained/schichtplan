"""
Script to run the reverse migration from code values to full names.
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


# Simple direct database update without Flask app context
def reverse_enum_values():
    """Update database records to use full enum names instead of codes"""
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

        # Define the mapping from code to full enum name
        updates = [
            # Convert code values to full enum names
            (
                "UPDATE employee_availabilities SET availability_type = 'AVAILABLE' WHERE availability_type = 'AVL'",
                "AVL to AVAILABLE",
            ),
            (
                "UPDATE employee_availabilities SET availability_type = 'FIXED' WHERE availability_type = 'FIX'",
                "FIX to FIXED",
            ),
            (
                "UPDATE employee_availabilities SET availability_type = 'PREFERRED' WHERE availability_type = 'PRF'",
                "PRF to PREFERRED",
            ),
            (
                "UPDATE employee_availabilities SET availability_type = 'UNAVAILABLE' WHERE availability_type = 'UNV'",
                "UNV to UNAVAILABLE",
            ),
        ]

        total_updated = 0

        # Execute all updates
        for sql, description in updates:
            cursor.execute(sql)
            rows = cursor.rowcount
            total_updated += rows
            logger.info(f"Updated {rows} records: {description}")

        # Commit and close
        conn.commit()
        conn.close()

        logger.info(f"Successfully updated {total_updated} total records")
        return True
    except Exception as e:
        logger.error(f"Error updating database: {str(e)}")
        return False


if __name__ == "__main__":
    logger.info("Starting reverse database migration...")

    if reverse_enum_values():
        logger.info("Reverse migration completed successfully.")
    else:
        logger.error("Reverse migration failed.")
        sys.exit(1)
