import sqlite3
from datetime import date, timedelta


def check_schedules():
    print("Checking schedules for assigned shifts...")

    # Connect to the database
    conn = sqlite3.connect("instance/app.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Calculate next week's dates
    today = date.today()
    next_monday = today + timedelta(days=(7 - today.weekday()))
    next_sunday = next_monday + timedelta(days=6)

    print(f"Checking schedules for: {next_monday} to {next_sunday}")

    # Get date range as strings for SQL query
    date_range = []
    current_date = next_monday
    while current_date <= next_sunday:
        date_range.append(current_date.isoformat())
        current_date += timedelta(days=1)

    # Query schedules with details about employees and shifts
    date_placeholders = ", ".join(["?"] * len(date_range))
    cursor.execute(
        f"""
        SELECT 
            s.date, 
            e.first_name, 
            e.last_name, 
            e.employee_group, 
            sh.start_time, 
            sh.end_time,
            sh.duration_hours
        FROM schedules s
        JOIN employees e ON s.employee_id = e.id
        LEFT JOIN shifts sh ON s.shift_id = sh.id
        WHERE s.date IN ({date_placeholders})
        ORDER BY s.date, sh.start_time, e.last_name
    """,
        date_range,
    )

    schedules = cursor.fetchall()

    # Group schedules by date
    schedules_by_date = {}
    for schedule in schedules:
        date_str = schedule["date"]
        if date_str not in schedules_by_date:
            schedules_by_date[date_str] = []
        schedules_by_date[date_str].append(schedule)

    # Print schedule details
    total_with_shifts = 0
    total_schedules = 0

    for date_str in sorted(schedules_by_date.keys()):
        day_schedules = schedules_by_date[date_str]
        with_shifts = sum(1 for s in day_schedules if s["start_time"] is not None)
        without_shifts = len(day_schedules) - with_shifts

        print(f"\nDate: {date_str}")
        print(f"  Total schedules: {len(day_schedules)}")
        print(f"  With shifts: {with_shifts}")
        print(f"  Without shifts: {without_shifts}")

        # Print details of schedules with shifts
        if with_shifts > 0:
            print("\n  Employees with shifts:")
            for schedule in day_schedules:
                if schedule["start_time"] is not None:
                    employee = f"{schedule['first_name']} {schedule['last_name']}"
                    shift = f"{schedule['start_time']}-{schedule['end_time']}"
                    duration = schedule["duration_hours"]
                    print(f"    - {employee}: {shift} ({duration}h)")

        total_with_shifts += with_shifts
        total_schedules += len(day_schedules)

    print(f"\nSummary for week {next_monday} to {next_sunday}:")
    print(f"  Total schedules: {total_schedules}")
    print(
        f"  Schedules with shifts: {total_with_shifts} ({total_with_shifts / total_schedules * 100:.1f}%)"
    )
    print(f"  Schedules without shifts: {total_schedules - total_with_shifts}")

    # Close the connection
    conn.close()


if __name__ == "__main__":
    check_schedules()
