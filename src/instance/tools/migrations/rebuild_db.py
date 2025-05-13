import os
from pathlib import Path
from src.backend.app import create_app
from src.backend.models import db, Settings


def rebuild_database():
    """Rebuilds the database from scratch"""

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
