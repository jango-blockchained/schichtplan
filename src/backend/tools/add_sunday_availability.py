import sqlite3
from datetime import datetime


def add_sunday_availability():
    print("Adding Sunday availability for all employees...")

    # Connect to the database
    conn = sqlite3.connect("instance/app.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all employees
    cursor.execute("SELECT id FROM employees")
    employees = cursor.fetchall()
    print(f"Found {len(employees)} employees")

    # Get existing availability records for day 1 (Monday)
    # We'll use these as a template for day 0 (Sunday)
    cursor.execute("""
        SELECT employee_id, hour, is_available
        FROM employee_availabilities
        WHERE day_of_week = 1 AND is_available = 1
    """)
    monday_records = cursor.fetchall()

    # Group by employee_id and hour
    template_availability = {}
    for record in monday_records:
        employee_id = record["employee_id"]
        hour = record["hour"]

        if employee_id not in template_availability:
            template_availability[employee_id] = set()

        template_availability[employee_id].add(hour)

    # Current timestamp for created_at and updated_at
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Check if there are already availability records for Sunday
    cursor.execute("SELECT COUNT(*) FROM employee_availabilities WHERE day_of_week = 0")
    sunday_count = cursor.fetchone()[0]

    if sunday_count > 0:
        print(f"Found {sunday_count} existing Sunday availability records. Skipping...")
        return

    # Add availability records for day 0 (Sunday)
    inserted_count = 0

    for employee_id, hours in template_availability.items():
        for hour in hours:
            cursor.execute(
                """
                INSERT INTO employee_availabilities 
                (employee_id, day_of_week, hour, is_available, is_recurring, availability_type, created_at, updated_at)
                VALUES (?, 0, ?, 1, 1, 'regular', ?, ?)
            """,
                (employee_id, hour, now, now),
            )
            inserted_count += 1

    # Commit the changes
    conn.commit()
    print(
        f"Added {inserted_count} Sunday availability records for {len(template_availability)} employees"
    )

    # Close the connection
    conn.close()


if __name__ == "__main__":
    add_sunday_availability()
