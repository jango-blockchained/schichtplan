"""
Migration script to create ScheduleVersionMeta entries for all existing schedules.
This should be run once after deploying the new version.
"""

from flask import Flask
from models import db
from models.schedule import Schedule, ScheduleVersionMeta, ScheduleStatus
from sqlalchemy import func
from datetime import datetime


def create_app():
    """Create and configure a Flask app instance."""
    app = Flask(__name__)
    app.config.from_object("config.Config")
    db.init_app(app)
    return app


def migrate_schedule_versions(app):
    """Create ScheduleVersionMeta entries for existing schedules."""
    with app.app_context():
        print("Starting version metadata migration...")

        # First, ensure the table exists
        try:
            print("Making sure the table exists...")
            ScheduleVersionMeta.__table__.create(db.engine, checkfirst=True)
            print("Table verified.")
        except Exception as e:
            print(f"Error checking/creating table: {str(e)}")
            return

        # Get all unique versions
        versions = db.session.query(Schedule.version).distinct().all()
        print(f"Found {len(versions)} schedule versions to migrate")

        for (version,) in versions:
            # Check if this version already has metadata
            existing = ScheduleVersionMeta.query.filter_by(version=version).first()
            if existing:
                print(f"Version {version} metadata already exists")
                continue

            # Get date range for this version
            min_date = (
                db.session.query(func.min(Schedule.date))
                .filter(Schedule.version == version)
                .scalar()
            )
            max_date = (
                db.session.query(func.max(Schedule.date))
                .filter(Schedule.version == version)
                .scalar()
            )

            if not min_date or not max_date:
                print(
                    f"No schedules found for version {version}, skipping metadata creation"
                )
                continue

            # Get status from schedules (they should all have the same status)
            status_result = (
                db.session.query(Schedule.status)
                .filter(Schedule.version == version)
                .first()
            )

            if not status_result:
                print(
                    f"No status found for version {version}, using default DRAFT status"
                )
                status = ScheduleStatus.DRAFT
            else:
                status = status_result[0]

            print(
                f"Creating metadata for version {version}: date range {min_date.date()} to {max_date.date()}, status {status}"
            )

            # Create metadata entry
            meta = ScheduleVersionMeta(
                version=version,
                created_at=datetime.utcnow(),
                status=status,
                date_range_start=min_date.date(),
                date_range_end=max_date.date(),
                notes=f"Auto-generated metadata for existing version {version}",
            )

            db.session.add(meta)

        db.session.commit()
        print(f"Migration completed: Added metadata for {len(versions)} versions")


if __name__ == "__main__":
    app = create_app()
    migrate_schedule_versions(app)
