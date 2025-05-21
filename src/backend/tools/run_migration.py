"""
Script to run the PROMISE to PREFERRED enum migration within Flask application context.
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
def fix_enum_values():
    """Update database records to use correct enum values"""
    try:
        # Find the database file
        db_path = os.path.join(current_dir, "..", "..", "src", "instance", "app.db")

        if not os.path.exists(db_path):
            logger.error(f"Database file not found at {db_path}")
            return False

        logger.info(f"Using database at {db_path}")

        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Define the mapping from enum name to code
        # Based on AvailabilityType in models/employee.py
        updates = [
            # Fix old PROMISE values
            (
                "UPDATE employee_availabilities SET availability_type = 'PREFERRED' WHERE availability_type = 'PROMISE' OR availability_type = 'PRM'",
                "PROMISE/PRM to PREFERRED",
            ),
            # Fix any values using the full enum names instead of codes
            (
                "UPDATE employee_availabilities SET availability_type = 'AVAILABLE' WHERE availability_type = 'AVAILABLE'",
                "AVAILABLE to AVAILABLE",
            ),
            (
                "UPDATE employee_availabilities SET availability_type = 'FIXED' WHERE availability_type = 'FIXED'",
                "FIXED to FIXED",
            ),
            (
                "UPDATE employee_availabilities SET availability_type = 'PREFERRED' WHERE availability_type = 'PREFERRED'",
                "PREFERRED to PREFERRED",
            ),
            (
                "UPDATE employee_availabilities SET availability_type = 'UNAVAILABLE' WHERE availability_type = 'UNAVAILABLE'",
                "UNAVAILABLE to UNAVAILABLE",
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
    logger.info("Starting database migration directly...")

    if fix_enum_values():
        logger.info("Migration completed successfully.")
    else:
        logger.error("Migration failed.")
        sys.exit(1)
