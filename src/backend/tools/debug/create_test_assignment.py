#!/usr/bin/env python
"""
Script to directly insert test assignments into the database.
This bypasses the scheduler logic to verify that the system can handle
assignments properly when created manually.
"""

import os
import sqlite3
from datetime import date, datetime, timedelta


def main():
    """Insert test assignments directly into the database"""
    print("=" * 80)
    print("TEST ASSIGNMENT CREATOR TOOL")
    print("=" * 80)
    print("This tool directly inserts test assignments into the database.\n")

    # Find the database file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "../../../.."))
    db_path = os.path.join(project_root, "src/instance/app.db")

    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}")
        return

    print(f"Database found at: {db_path}")

    # Connect to the database
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        print("Successfully connected to the database\n")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    # Get all employees
    try:
        cursor.execute("SELECT id FROM employees WHERE is_active = 1 LIMIT 5")
        employees = [row["id"] for row in cursor.fetchall()]
        print(f"Found {len(employees)} active employees")

        if not employees:
            print("No active employees found. Cannot create test assignments.")
            return
    except Exception as e:
        print(f"Error getting employees: {e}")
        return

    # Get all shifts
    try:
        cursor.execute("SELECT id FROM shifts LIMIT 8")
        shifts = [row["id"] for row in cursor.fetchall()]
        print(f"Found {len(shifts)} shifts")

        if not shifts:
            print("No shifts found. Cannot create test assignments.")
            return
    except Exception as e:
        print(f"Error getting shifts: {e}")
        return

    # Create test dates
    today = date.today()
    test_dates = [
        today + timedelta(days=i) for i in range(1, 4)
    ]  # Tomorrow, day after, and day after that

    # First, delete any existing schedules for the test dates to avoid duplication
    try:
        for test_date in test_dates:
            cursor.execute(
                "DELETE FROM schedules WHERE date = ?", (test_date.isoformat(),)
            )
        conn.commit()
        print("Deleted any existing schedules for test dates")
    except Exception as e:
        print(f"Error deleting existing schedules: {e}")
        conn.rollback()
        return

    # Create assignments - one employee per shift per day
    assignments_created = 0
    try:
        # Get the highest schedule ID for incrementing
        cursor.execute("SELECT MAX(id) as max_id FROM schedules")
        max_id = cursor.fetchone()["max_id"] or 0
        next_id = max_id + 1

        # Create test assignments
        for test_date in test_dates:
            for i, shift_id in enumerate(shifts):
                # Rotate through employees to distribute shifts evenly
                employee_id = employees[i % len(employees)]

                # Insert assignment
                cursor.execute(
                    """
                    INSERT INTO schedules (
                        id, employee_id, shift_id, date, 
                        status, created_at, updated_at, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        next_id,
                        employee_id,
                        shift_id,
                        test_date.isoformat(),
                        "PENDING",
                        datetime.now().isoformat(),
                        datetime.now().isoformat(),
                        1,
                    ),
                )

                print(
                    f"Created assignment: Employee {employee_id}, Shift {shift_id}, Date {test_date}"
                )
                assignments_created += 1
                next_id += 1

        # Commit the changes
        conn.commit()
        print(f"\nSuccessfully created {assignments_created} test assignments")

    except Exception as e:
        print(f"Error creating assignments: {e}")
        conn.rollback()
        return

    # Verify assignments were created
    try:
        for test_date in test_dates:
            cursor.execute(
                "SELECT COUNT(*) as count FROM schedules WHERE date = ?",
                (test_date.isoformat(),),
            )
            count = cursor.fetchone()["count"]
            print(f"Assignments for {test_date}: {count}")
    except Exception as e:
        print(f"Error verifying assignments: {e}")

    conn.close()
    print("\nAssignment creation complete.")
    print("You can now check if these assignments appear correctly in the application.")


if __name__ == "__main__":
    main()
