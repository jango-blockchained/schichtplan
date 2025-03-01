import sqlite3
from datetime import date, timedelta, datetime


def generate_fresh_schedule():
    print("Generating a fresh schedule for next week...")

    # Connect to the database
    conn = sqlite3.connect("instance/app.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Calculate next week's dates
    today = date.today()
    next_monday = today + timedelta(days=(7 - today.weekday()))
    next_sunday = next_monday + timedelta(days=6)

    print(f"Generating schedule for: {next_monday} to {next_sunday}")

    # Get date range as strings for SQL query
    date_range = []
    current_date = next_monday
    while current_date <= next_sunday:
        date_range.append(current_date.isoformat())
        current_date += timedelta(days=1)

    # First, clear any existing schedules for next week
    date_placeholders = ", ".join(["?"] * len(date_range))
    cursor.execute(
        f"""
        DELETE FROM schedules
        WHERE date IN ({date_placeholders})
    """,
        date_range,
    )

    conn.commit()
    print("Cleared existing schedules for next week")

    # Create a timestamp for created_at and updated_at fields
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Get available shifts
    cursor.execute(
        "SELECT id, start_time, end_time, duration_hours FROM shifts WHERE start_time != '00:00'"
    )
    shifts = cursor.fetchall()

    if not shifts:
        print("No valid shifts found in the database!")
        return

    print(f"Found {len(shifts)} valid shifts:")
    for shift in shifts:
        print(
            f"  - Shift {shift['id']}: {shift['start_time']}-{shift['end_time']} ({shift['duration_hours']}h)"
        )

    # Get coverage requirements
    cursor.execute("SELECT * FROM coverage ORDER BY day_index, start_time")
    coverage_reqs = cursor.fetchall()

    print(f"\nFound {len(coverage_reqs)} coverage requirements:")
    for req in coverage_reqs:
        day_index = req["day_index"]
        start_time = req["start_time"]
        end_time = req["end_time"]
        min_employees = req["min_employees"]
        max_employees = req["max_employees"]
        print(
            f"  - Day {day_index}, Time {start_time}-{end_time}: {min_employees}-{max_employees} employees"
        )

    # Get the schema of the schedules table to know required fields
    cursor.execute("PRAGMA table_info(schedules)")
    table_info = cursor.fetchall()
    print("\nSchedules table columns:")
    for col in table_info:
        print(
            f"  - {col['name']} ({col['type']}), {'NOT NULL' if col['notnull'] else 'NULL'}"
        )

    # For each coverage requirement, assign available employees to shifts
    coverage_fulfilled = []
    total_assignments = 0

    # Set version for all schedules
    version = 1

    for req in coverage_reqs:
        day_index = req["day_index"]
        coverage_date = next_monday + timedelta(days=day_index if day_index <= 6 else 0)
        date_str = coverage_date.isoformat()
        start_time = req["start_time"]
        end_time = req["end_time"]
        min_employees = req["min_employees"]

        # Find employees available for this time slot
        cursor.execute(
            """
            SELECT DISTINCT e.id, e.first_name, e.last_name, e.employee_group
            FROM employees e
            JOIN employee_availabilities a ON e.id = a.employee_id
            WHERE a.day_of_week = ? AND a.is_available = 1 AND a.hour >= ? AND a.hour <= ?
            ORDER BY e.employee_group, e.id
        """,
            (day_index, int(start_time.split(":")[0]), int(end_time.split(":")[0]) - 1),
        )

        available_employees = cursor.fetchall()

        print(f"\nDay {day_index} ({date_str}), Time {start_time}-{end_time}:")
        print(f"  {len(available_employees)} employees available")

        # Find a matching shift for this coverage
        matching_shift = None
        for shift in shifts:
            if shift["start_time"] == start_time and shift["end_time"] == end_time:
                matching_shift = shift
                break
        else:
            # If no exact match, find a shift that covers most of the coverage time
            for shift in shifts:
                if (
                    (
                        shift["start_time"] <= start_time
                        and shift["end_time"] >= start_time
                    )
                    or (
                        shift["start_time"] <= end_time
                        and shift["end_time"] >= end_time
                    )
                    or (
                        shift["start_time"] >= start_time
                        and shift["end_time"] <= end_time
                    )
                ):
                    matching_shift = shift
                    break

        if not matching_shift:
            print("  No matching shift found for this coverage requirement")
            continue

        print(
            f"  Assigning shift {matching_shift['id']} ({matching_shift['start_time']}-{matching_shift['end_time']})"
        )

        # Assign minimum number of employees to this shift
        assigned_count = 0
        for employee in available_employees[:min_employees]:
            cursor.execute(
                """
                INSERT INTO schedules 
                (employee_id, date, shift_id, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (employee["id"], date_str, matching_shift["id"], version, now, now),
            )

            assigned_count += 1
            total_assignments += 1

            print(
                f"    - Assigned {employee['first_name']} {employee['last_name']} ({employee['employee_group']})"
            )

        coverage_fulfilled.append(
            {
                "date": date_str,
                "time": f"{start_time}-{end_time}",
                "required": min_employees,
                "assigned": assigned_count,
            }
        )

    # Commit all changes
    conn.commit()

    # Print summary
    print("\nSchedule generation complete!")
    print(f"Total assignments: {total_assignments}")
    print("\nCoverage fulfillment:")
    for cov in coverage_fulfilled:
        print(
            f"  - {cov['date']}, {cov['time']}: {cov['assigned']}/{cov['required']} employees assigned"
        )

    # Close the connection
    conn.close()


if __name__ == "__main__":
    generate_fresh_schedule()
