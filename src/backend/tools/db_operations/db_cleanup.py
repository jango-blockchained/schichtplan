#!/usr/bin/env python3
"""
Simpler database cleanup script that works with Flask-SQLAlchemy.
"""

import os
import sys

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Create the Flask app and get the database
from src.backend.app import create_app

app = create_app()

# Use the app context
with app.app_context():
    from src.backend.models import db, Schedule

    print("\n===== DATABASE CLEANUP =====")

    # Find all schedule versions
    versions = db.session.query(db.distinct(Schedule.version)).all()
    versions = [v[0] for v in versions]

    if not versions:
        print("No schedules found in the database.")
        sys.exit(0)

    print(f"Found {len(versions)} schedule versions: {versions}")

    for version in versions:
        count = Schedule.query.filter_by(version=version).count()
        with_shifts = Schedule.query.filter(
            Schedule.version == version, Schedule.shift_id != None
        ).count()
        without_shifts = Schedule.query.filter(
            Schedule.version == version, Schedule.shift_id == None
        ).count()

        print(f"\nVersion {version}:")
        print(f"  Total schedules: {count}")
        print(f"  With shift assignments: {with_shifts}")
        print(f"  Without shift assignments: {without_shifts}")

    print("\nOptions:")
    print("1. Delete specific version")
    print("2. Delete all schedules")
    print("3. Cancel (do nothing)")

    choice = input("\nEnter your choice (1-3): ")

    if choice == "1":
        version_to_delete = input(f"Enter version to delete {versions}: ")
        try:
            version_to_delete = int(version_to_delete)
            if version_to_delete in versions:
                count = Schedule.query.filter_by(version=version_to_delete).count()
                print(f"Deleting {count} schedules from version {version_to_delete}...")
                Schedule.query.filter_by(version=version_to_delete).delete()
                db.session.commit()
                print(
                    f"Successfully deleted {count} schedules from version {version_to_delete}"
                )
            else:
                print(f"Version {version_to_delete} not found. No changes made.")
        except ValueError:
            print("Invalid version number. No changes made.")

    elif choice == "2":
        confirm = input(
            "Are you sure you want to delete ALL schedules? This cannot be undone! (yes/no): "
        )
        if confirm.lower() == "yes":
            total = Schedule.query.count()
            print(f"Deleting all {total} schedules...")
            Schedule.query.delete()
            db.session.commit()
            print(f"Successfully deleted all {total} schedules.")
        else:
            print("Operation cancelled. No changes made.")

    else:
        print("Operation cancelled. No changes made.")
