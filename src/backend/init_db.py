from models import db


def init_db():
    """Initialize the database, create tables if they don't exist."""

    # Import models to ensure tables are created

    # Create all tables
    db.create_all()

    # Initialize ScheduleVersionMeta table
    migrate_schedule_versions()

    print("Database initialized successfully.")


def migrate_schedule_versions():
    """Create ScheduleVersionMeta entries for existing schedules."""
    from datetime import datetime
    from models.schedule import Schedule, ScheduleVersionMeta
    from sqlalchemy import func

    # Get all unique versions
    versions = db.session.query(Schedule.version).distinct().all()

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
        status = (
            db.session.query(Schedule.status)
            .filter(Schedule.version == version)
            .first()
        )

        if not status:
            print(f"No status found for version {version}, skipping metadata creation")
            continue

        # Create metadata entry
        meta = ScheduleVersionMeta(
            version=version,
            created_at=datetime.utcnow(),
            status=status[0],
            date_range_start=min_date.date(),
            date_range_end=max_date.date(),
            notes=f"Auto-generated metadata for existing version {version}",
        )

        db.session.add(meta)

    db.session.commit()
    print(f"Migrated metadata for {len(versions)} versions")


if __name__ == "__main__":
    init_db()
