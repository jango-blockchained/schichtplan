from backend.app import create_app
from backend.models import db, Schedule
from backend.services.schedule_generator import ScheduleGenerator
from datetime import date, timedelta


def test_schedule_generation():
    app = create_app()
    with app.app_context():
        print("Testing schedule generation...")

        # Calculate next week's dates
        today = date.today()
        next_monday = today + timedelta(days=(7 - today.weekday()))
        next_sunday = next_monday + timedelta(days=6)

        print(f"Generating schedule for: {next_monday} to {next_sunday}")

        # Clear existing schedules for next week
        Schedule.query.filter(
            Schedule.date >= next_monday, Schedule.date <= next_sunday
        ).delete()
        db.session.commit()

        # Generate new schedule
        generator = ScheduleGenerator()
        schedules, errors = generator.generate_schedule(next_monday, next_sunday)

        # Print results
        print(f"\nGenerated {len(schedules)} schedules")
        if errors:
            print("\nErrors encountered:")
            for error in errors:
                print(f"- {error['message']} ({error.get('date', 'N/A')})")
        else:
            print("\nNo errors encountered")

        # Print schedule details
        print("\nSchedule details:")
        schedules_by_date = {}
        for schedule in schedules:
            date_str = schedule.date.strftime("%Y-%m-%d")
            if date_str not in schedules_by_date:
                schedules_by_date[date_str] = []
            schedules_by_date[date_str].append(schedule)

        for date_str in sorted(schedules_by_date.keys()):
            print(f"\nDate: {date_str}")
            day_schedules = schedules_by_date[date_str]
            for schedule in sorted(
                day_schedules, key=lambda s: s.shift.start_time if s.shift else "00:00"
            ):
                if schedule.shift and schedule.shift.start_time != "00:00":
                    print(
                        f"  - {schedule.employee.first_name} {schedule.employee.last_name}: "
                        f"{schedule.shift.start_time}-{schedule.shift.end_time}"
                    )


if __name__ == "__main__":
    test_schedule_generation()
