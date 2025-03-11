from src.backend.app import create_app
from src.backend.models import db
import os
from pathlib import Path


def reset_database():
    # Create app and get database path
    app = create_app()
    instance_dir = Path(__file__).parent.parent.parent.parent / "instance"
    db_file = instance_dir / "app.db"

    # Remove existing database file
    if db_file.exists():
        print(f"Removing existing database at {db_file}")
        os.remove(db_file)

    # Ensure instance directory exists
    instance_dir.mkdir(exist_ok=True)

    # Initialize database
    with app.app_context():
        print("Creating new database tables...")
        db.create_all()
        print("Database reset complete.")


if __name__ == "__main__":
    reset_database()
