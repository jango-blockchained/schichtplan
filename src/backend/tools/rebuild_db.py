import os
import sys
from pathlib import Path

# Add the parent directory to the Python path
current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent
project_root = src_dir.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

# Import the app and models
from src.backend.app import create_app
from src.backend.models import db, Settings


def rebuild_database():
    """Rebuilds the database from scratch"""

    # Create app and get database path
    app = create_app()
    db_file = current_dir / "schichtplan.db"

    # Remove existing database file
    if db_file.exists():
        print(f"Removing existing database at {db_file}")
        os.remove(db_file)

    # Ensure instance directory exists
    current_dir.mkdir(exist_ok=True)

    with app.app_context():
        print("Creating database tables...")
        db.create_all()

        print("Initializing default settings...")
        settings = Settings()
        db.session.add(settings)

        try:
            db.session.commit()
            print("Database rebuilt successfully!")
        except Exception as e:
            db.session.rollback()
            print(f"Error during database rebuild: {str(e)}")
            raise


if __name__ == "__main__":
    rebuild_database()
