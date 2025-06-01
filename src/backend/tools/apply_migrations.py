import sys
from pathlib import Path

# Add the parent directory to the Python path
current_dir = Path(__file__).resolve().parent
src_dir = current_dir.parent
project_root = src_dir.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from flask_migrate import upgrade
from src.backend.app import create_app


def apply_migrations():
    """Apply all migrations to the database"""
    app = create_app()
    with app.app_context():
        print("Applying migrations...")
        upgrade()
        print("Migrations applied successfully!")


if __name__ == "__main__":
    apply_migrations()
