from app import create_app
from models import db, Schedule, ScheduleStatus

app = create_app()

with app.app_context():
    print("ScheduleStatus enum values:", [status.value for status in ScheduleStatus])

    # Check for schedules with version 1
    version_1_schedules = Schedule.query.filter_by(version=1).limit(10).all()

    for schedule in version_1_schedules:
        status_value = (
            schedule.status.value
            if hasattr(schedule, "status") and schedule.status
            else "None"
        )
        print(
            f"Schedule ID: {schedule.id}, Status: {status_value}, Date: {schedule.date}"
        )

    # Check if there are schedules with status PENDING
    try:
        pending_schedules = (
            Schedule.query.filter(Schedule.status == "PENDING").limit(5).all()
        )
        print(f"Found {len(pending_schedules)} schedules with PENDING status")
    except Exception as e:
        print(f"Error querying PENDING status: {e}")

    # Count schedules by version and status
    from sqlalchemy import func

    version_status_counts = (
        db.session.query(Schedule.version, Schedule.status, func.count())
        .group_by(Schedule.version, Schedule.status)
        .all()
    )

    print("\nSchedule counts by version and status:")
    for version, status, count in version_status_counts:
        status_value = status.value if status else "None"
        print(f"Version: {version}, Status: {status_value}, Count: {count}")
