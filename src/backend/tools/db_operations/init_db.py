import os
from pathlib import Path
from src.backend.app import create_app

# Ensure instance directory exists
instance_dir = Path(__file__).parent / "instance"
instance_dir.mkdir(exist_ok=True)

# Remove existing database file if it exists
db_file = instance_dir / "app.db"
if db_file.exists():
    os.remove(db_file)

# Create the Flask app and initialize database
app = create_app()

print("Database initialized successfully")
