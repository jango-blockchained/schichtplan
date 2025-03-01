import sqlite3
from datetime import date, timedelta


def test_schedule_generation():
    print("Testing schedule generation with basic SQL...")

    # Connect to the database
    conn = sqlite3.connect("instance/app.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Calculate next week's dates
    today = date.today()
    next_monday = today + timedelta(days=(7 - today.weekday()))
    next_sunday = next_monday + timedelta(days=6)

    print(f"Checking coverage for: {next_monday} to {next_sunday}")

    # Check coverage requirements
    cursor.execute("SELECT * FROM coverage ORDER BY day_index, start_time")
    coverage_reqs = cursor.fetchall()

    print(f"Found {len(coverage_reqs)} coverage requirements:")
    for req in coverage_reqs:
        day_index = req["day_index"]
        start_time = req["start_time"]
        end_time = req["end_time"]
        min_employees = req["min_employees"]
        print(
            f"  - Day {day_index}, Time {start_time}-{end_time}: {min_employees} employees required"
        )

    # Check employees
    cursor.execute("SELECT * FROM employees")
    employees = cursor.fetchall()
    print(f"\nFound {len(employees)} employees")

    # Check if we have Sunday availability
    cursor.execute(
        "SELECT COUNT(*) FROM employee_availabilities WHERE day_of_week = 0 AND is_available = 1"
    )
    sunday_count = cursor.fetchone()[0]
    print(f"Sunday availability records: {sunday_count}")

    # Count availability by day
    cursor.execute("""
        SELECT day_of_week, COUNT(*) as count
        FROM employee_availabilities
        WHERE is_available = 1
        GROUP BY day_of_week
        ORDER BY day_of_week
    """)
    availability_by_day = cursor.fetchall()
    print("\nAvailability by day:")
    for day in availability_by_day:
        print(f"  - Day {day['day_of_week']}: {day['count']} records")

    # Check existing schedules for next week
    date_range = []
    current_date = next_monday
    while current_date <= next_sunday:
        date_range.append(current_date.isoformat())
        current_date += timedelta(days=1)

    date_placeholders = ", ".join(["?"] * len(date_range))
    cursor.execute(
        f"""
        SELECT s.date, COUNT(*) as count
        FROM schedules s
        WHERE s.date IN ({date_placeholders})
        GROUP BY s.date
        ORDER BY s.date
    """,
        date_range,
    )

    existing_schedules = cursor.fetchall()
    print("\nExisting schedules for next week:")
    if existing_schedules:
        for day in existing_schedules:
            print(f"  - {day['date']}: {day['count']} schedules")
    else:
        print("  - No existing schedules found")

    # Close the connection
    conn.close()


if __name__ == "__main__":
    test_schedule_generation()
