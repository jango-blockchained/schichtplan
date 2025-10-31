#!/usr/bin/env python3
import os
import sys

# Add project root to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, project_root)

from src.backend.app import create_app
from src.backend.models import db
from src.backend.models.schedule import ScheduleVersionMeta

app = create_app()
with app.app_context():
    try:
        # Check if we can query ScheduleVersionMeta
        versions = ScheduleVersionMeta.query.all()
        print(f"Found {len(versions)} versions in database")

        # Check columns
        inspector = db.inspect(db.engine)
        columns = [
            col["name"] for col in inspector.get_columns("schedule_version_meta")
        ]
        print("Schedule Version Meta columns:", columns)

        if "week_version" in columns:
            print("✅ week_version column exists")
        else:
            print("❌ week_version column missing")

    except Exception as e:
        print(f"Error: {e}")
