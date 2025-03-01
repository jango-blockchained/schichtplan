import sqlite3
from datetime import date


def check_availability():
    print("Checking employee availability...")

    # Connect to the database
    conn = sqlite3.connect("instance/app.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all employees
    cursor.execute("SELECT * FROM employees")
    employees = cursor.fetchall()
    print(f"Found {len(employees)} employees")

    # Check specific date and time
    check_date = date(2025, 3, 2)  # Sunday
    check_start_hour = 15  # 15:00
    check_end_hour = 19  # 19:00 (inclusive, so covers until 20:00)

    print(
        f"\nChecking availability for {check_date} (Sunday), {check_start_hour}:00-{check_end_hour + 1}:00:"
    )

    # Get all availability records for the day of week (Sunday = 0)
    day_of_week = 0  # Sunday

    # Dictionary to track employee availability
    employee_availability = {}

    # Check each hour in the range
    for hour in range(check_start_hour, check_end_hour + 1):
        cursor.execute(
            """
            SELECT e.id, e.first_name, e.last_name, a.hour, a.is_available
            FROM employees e
            JOIN employee_availabilities a ON e.id = a.employee_id
            WHERE a.day_of_week = ? AND a.hour = ? AND a.is_available = 1
        """,
            (day_of_week, hour),
        )

        available_for_hour = cursor.fetchall()

        for record in available_for_hour:
            employee_id = record["id"]
            if employee_id not in employee_availability:
                employee_availability[employee_id] = set()

            employee_availability[employee_id].add(hour)

    # Check which employees are available for all hours in the range
    available_employees = []
    required_hours = set(range(check_start_hour, check_end_hour + 1))

    for employee in employees:
        employee_id = employee["id"]
        first_name = employee["first_name"]
        last_name = employee["last_name"]

        # Employee is available if they have availability for all required hours
        is_available = False
        if employee_id in employee_availability:
            if required_hours.issubset(employee_availability[employee_id]):
                is_available = True

        if is_available:
            available_employees.append(employee)
            print(
                f"  - {first_name} {last_name} is AVAILABLE (Group: {employee['employee_group']}, Hours: {employee['contracted_hours']})"
            )
        else:
            print(f"  - {first_name} {last_name} is NOT available")

    print(
        f"\nTotal: {len(available_employees)} of {len(employees)} employees available"
    )

    # Close the connection
    conn.close()


if __name__ == "__main__":
    check_availability()
