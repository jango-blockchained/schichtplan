"""
Script to migrate PROMISE enum values to PREFERRED in the database.
This is a one-time fix to handle the renaming of the enum value.
"""

import os
import sys
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from models import db, EmployeeAvailability
    from models.employee import AvailabilityType
except ImportError:
    logger.error(
        "Failed to import required modules. Make sure you're running this from the correct directory."
    )
    sys.exit(1)


def fix_promise_enum_values():
    """
    Update database records where availability_type='PROMISE' to use 'PREFERRED' instead.
    """
    try:
        # Direct SQL update to avoid ORM issues with enum values
        logger.info("Starting database update...")

        # Get the connection
        connection = db.engine.connect()

        # Execute an update statement
        result = connection.execute(
            """
            UPDATE employee_availabilities 
            SET availability_type = 'PREFERRED' 
            WHERE availability_type = 'PROMISE' OR availability_type = 'PRM'
            """
        )

        # Commit the changes
        connection.execute("COMMIT")

        # Close the connection
        connection.close()

        logger.info(
            f"Successfully updated {result.rowcount} records from PROMISE to PREFERRED"
        )
        return True
    except Exception as e:
        logger.error(f"Error updating database: {str(e)}")
        return False


if __name__ == "__main__":
    # Ensure this is run within Flask context
    logger.info("Starting migration from PROMISE to PREFERRED enum values...")

    if fix_promise_enum_values():
        logger.info("Migration completed successfully.")
    else:
        logger.error("Migration failed.")
        sys.exit(1)
