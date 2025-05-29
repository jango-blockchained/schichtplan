#!/usr/bin/env python
"""
SQLite resource check and fix tool.
This script directly works with the SQLite database to check and fix resource data.
"""

import os
import sys
import json
import sqlite3
from datetime import date, datetime
import random

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
root_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
sys.path.insert(0, root_dir)


def check_table(cursor, table_name):
    """Check if a table exists and show its structure"""
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        if columns:
            print(f"\nColumns in {table_name}:")
            for col in columns:
                print(f"  {col[1]} ({col[2]})")
            return True
        return False
    except sqlite3.Error as e:
        print(f"Error checking table {table_name}: {e}")
        return False


def get_table_count(cursor, table_name):
    """Get count of records in a table"""
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cursor.fetchone()[0]
        print(f"Records in {table_name}: {count}")
        return count
    except sqlite3.Error as e:
        print(f"Error counting records in {table_name}: {e}")
        return 0


def sample_table_data(cursor, table_name, limit=3):
    """Get sample data from a table"""
    try:
        cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
        rows = cursor.fetchall()
        if rows:
            print(f"\nSample data from {table_name}:")
            # Get column names
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [col[1] for col in cursor.fetchall()]

            for row in rows:
                print("  " + "-" * 40)
                for i, col in enumerate(columns):
                    print(f"  {col}: {row[i]}")
        return rows
    except sqlite3.Error as e:
        print(f"Error sampling data from {table_name}: {e}")
        return []


def create_test_employees(conn, cursor):
    """Create test employees"""
    try:
        # Check existing employees
        count = get_table_count(cursor, "employees")
        if count > 0:
            print("Employees already exist, skipping creation.")
            return False

        # Check if table exists and get structure
        table_exists = check_table(cursor, "employees")
        if not table_exists:
            print("Employees table doesn't exist. Cannot create test employees.")
            return False

        # Get column info to adapt to the actual structure
        cursor.execute("PRAGMA table_info(employees)")
        columns = {col[1]: col[2] for col in cursor.fetchall()}

        # Create test employees
        print("\nCreating test employees...")

        for i in range(1, 6):
            # Prepare a basic data dictionary
            emp_data = {
                "name": f"Test Employee {i}",
                "email": f"employee{i}@example.com",
                "is_active": 1,
                "is_keyholder": 1 if i == 1 else 0,  # First employee is keyholder
                "contracted_hours": random.choice([20, 30, 40]),
                "employee_group": "Staff",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            # Filter out columns that don't exist in the table
            valid_data = {k: v for k, v in emp_data.items() if k in columns}

            # Prepare SQL statement dynamically based on available columns
            col_names = ", ".join(valid_data.keys())
            placeholders = ", ".join(["?" for _ in valid_data])
            values = tuple(valid_data.values())

            cursor.execute(
                f"INSERT INTO employees ({col_names}) VALUES ({placeholders})", values
            )

        conn.commit()
        print("✅ Created test employees")
        return True
    except sqlite3.Error as e:
        conn.rollback()
        print(f"❌ Error creating test employees: {e}")
        return False


def create_test_shifts(conn, cursor):
    """Create test shift templates"""
    try:
        # Check existing shifts
        count = get_table_count(cursor, "shifts")
        if count > 0:
            print("Shift templates already exist, skipping creation.")
            return False

        # Check if table exists and get structure
        table_exists = check_table(cursor, "shifts")
        if not table_exists:
            print("Shifts table doesn't exist. Cannot create test shifts.")
            return False

        # Get column info to adapt to the actual structure
        cursor.execute("PRAGMA table_info(shifts)")
        columns = {col[1]: col[2] for col in cursor.fetchall()}

        # Create test shifts
        print("\nCreating test shift templates...")

        shifts = [
            # Early shifts
            {
                "name": "Morning A",
                "start_time": "09:00",
                "end_time": "14:00",
                "shift_type": "EARLY",
                "active_days": "0,1,2,3,4,5,6",
            },
            {
                "name": "Morning B",
                "start_time": "10:00",
                "end_time": "15:00",
                "shift_type": "EARLY",
                "active_days": "0,1,2,3,4,5,6",
            },
            # Middle shifts
            {
                "name": "Midday A",
                "start_time": "11:00",
                "end_time": "16:00",
                "shift_type": "MIDDLE",
                "active_days": "0,1,2,3,4,5,6",
            },
            {
                "name": "Midday B",
                "start_time": "12:00",
                "end_time": "17:00",
                "shift_type": "MIDDLE",
                "active_days": "0,1,2,3,4,5,6",
            },
            # Late shifts
            {
                "name": "Evening A",
                "start_time": "15:00",
                "end_time": "20:00",
                "shift_type": "LATE",
                "active_days": "0,1,2,3,4,5,6",
            },
            {
                "name": "Evening B",
                "start_time": "16:00",
                "end_time": "21:00",
                "shift_type": "LATE",
                "active_days": "0,1,2,3,4,5,6",
            },
        ]

        created = 0
        for shift in shifts:
            shift_data = {
                **shift,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            # Filter out columns that don't exist in the table
            valid_data = {k: v for k, v in shift_data.items() if k in columns}

            # Prepare SQL statement dynamically
            col_names = ", ".join(valid_data.keys())
            placeholders = ", ".join(["?" for _ in valid_data])
            values = tuple(valid_data.values())

            cursor.execute(
                f"INSERT INTO shifts ({col_names}) VALUES ({placeholders})", values
            )
            created += 1

        conn.commit()
        print(f"✅ Created {created} test shift templates")
        return True
    except sqlite3.Error as e:
        conn.rollback()
        print(f"❌ Error creating test shift templates: {e}")
        return False


def create_test_coverage(conn, cursor):
    """Create test coverage records"""
    try:
        # Check existing coverage
        count = get_table_count(cursor, "coverage")
        if count > 0:
            print("Coverage records already exist, skipping creation.")
            return False

        # Check if table exists and get structure
        table_exists = check_table(cursor, "coverage")
        if not table_exists:
            print("Coverage table doesn't exist. Cannot create test coverage.")
            return False

        # Get column info to adapt to the actual structure
        cursor.execute("PRAGMA table_info(coverage)")
        columns = {col[1]: col[2] for col in cursor.fetchall()}

        # Create test coverage
        print("\nCreating test coverage records...")

        # Create coverage for each day of the week
        created = 0
        for day in range(7):  # 0=Monday, 6=Sunday in Python's convention
            # Adjust to 0=Sunday, 1=Monday if needed based on the application's convention
            day_index = day + 1  # Convert to 1=Monday, 7=Sunday
            if day_index == 7:  # If Sunday became 7, make it 0
                day_index = 0

            # Create three coverage blocks per day
            blocks = [
                {
                    "start_time": "09:00",
                    "end_time": "13:00",
                    "min_employees": 1,
                    "max_employees": 2,
                },
                {
                    "start_time": "13:00",
                    "end_time": "17:00",
                    "min_employees": 1,
                    "max_employees": 2,
                },
                {
                    "start_time": "17:00",
                    "end_time": "21:00",
                    "min_employees": 1,
                    "max_employees": 2,
                },
            ]

            for block in blocks:
                coverage_data = {
                    "day_index": day_index,
                    **block,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                }

                # Filter out columns that don't exist in the table
                valid_data = {k: v for k, v in coverage_data.items() if k in columns}

                # Prepare SQL statement dynamically
                col_names = ", ".join(valid_data.keys())
                placeholders = ", ".join(["?" for _ in valid_data])
                values = tuple(valid_data.values())

                cursor.execute(
                    f"INSERT INTO coverage ({col_names}) VALUES ({placeholders})",
                    values,
                )
                created += 1

        conn.commit()
        print(f"✅ Created {created} test coverage records")
        return True
    except sqlite3.Error as e:
        conn.rollback()
        print(f"❌ Error creating test coverage records: {e}")
        return False


def update_shift_active_days(conn, cursor):
    """Update active_days in shift templates to ensure all weekdays are included"""
    try:
        # Check if we have shifts
        count = get_table_count(cursor, "shifts")
        if count == 0:
            print("No shifts found to update.")
            return False

        # Get all shifts
        cursor.execute("SELECT id, active_days FROM shifts")
        shifts = cursor.fetchall()

        updated = 0
        for shift_id, active_days in shifts:
            # Check if active_days is NULL, empty, or needs fixing
            if active_days is None or active_days.strip() == "":
                # Set to all days of week
                new_active_days = "0,1,2,3,4,5,6"
                cursor.execute(
                    "UPDATE shifts SET active_days = ? WHERE id = ?",
                    (new_active_days, shift_id),
                )
                updated += 1
                print(f"  Updated shift {shift_id} active_days to: {new_active_days}")

        if updated > 0:
            conn.commit()
            print(f"✅ Updated active_days for {updated} shifts")
        else:
            print("No shifts needed updating.")

        return updated > 0
    except sqlite3.Error as e:
        conn.rollback()
        print(f"❌ Error updating shift active_days: {e}")
        return False


def verify_resources_for_scheduler(cursor, test_date):
    """Verify that resources will work with the scheduler"""
    print("\n5. VERIFYING SCHEDULER COMPATIBILITY")
    print("-" * 40)

    # Check shift active_days for test date
    weekday = test_date.weekday()
    print(f"Testing for date: {test_date} (weekday {weekday})")

    # For shifts, ensure active_days includes this weekday
    applicable_shifts = []
    cursor.execute("SELECT id, shift_type, active_days FROM shifts")
    shifts = cursor.fetchall()

    for shift_id, shift_type, active_days in shifts:
        if active_days:
            try:
                # Try parsing as JSON first
                try:
                    days_list = json.loads(active_days)
                except json.JSONDecodeError:
                    # Try comma-separated format
                    days_list = [
                        int(day.strip())
                        for day in active_days.split(",")
                        if day.strip()
                    ]

                if weekday in days_list:
                    applicable_shifts.append(shift_id)
                    print(
                        f"  ✅ Shift {shift_id} (Type: {shift_type}) is applicable for weekday {weekday}"
                    )
                else:
                    print(
                        f"  ❌ Shift {shift_id} (Type: {shift_type}) is NOT applicable for weekday {weekday}"
                    )
            except Exception as e:
                print(f"  ⚠️ Error checking shift {shift_id}: {e}")

    print(f"Applicable shifts for {test_date}: {len(applicable_shifts)}/{len(shifts)}")

    # For coverage, ensure we have records for this weekday
    applicable_coverage = []
    day_index = weekday + 1  # Convert to 1=Monday, 7=Sunday
    if day_index == 7:  # If Sunday became 7, make it 0
        day_index = 0

    cursor.execute(
        "SELECT id, day_index, start_time, end_time FROM coverage WHERE day_index = ?",
        (day_index,),
    )
    coverage = cursor.fetchall()

    print(
        f"Coverage records for weekday {weekday} (day_index {day_index}): {len(coverage)}"
    )
    for cov_id, day_index, start_time, end_time in coverage:
        print(
            f"  Coverage {cov_id}: day_index={day_index}, time {start_time}-{end_time}"
        )

    # Check if we have active employees
    cursor.execute("SELECT COUNT(*) FROM employees WHERE is_active = 1")
    active_employees = cursor.fetchone()[0]
    print(f"Active employees: {active_employees}")

    # Final assessment
    issues = []
    if len(applicable_shifts) == 0:
        issues.append("No applicable shifts for the test date")
    if len(coverage) == 0:
        issues.append("No coverage records for the test date")
    if active_employees == 0:
        issues.append("No active employees")

    if issues:
        print("\nIssues detected:")
        for issue in issues:
            print(f"  - {issue}")
        return False
    else:
        print("\n✅ All resources appear to be correctly configured for scheduler use")
        return True


def main():
    """Main function for checking and fixing resource data"""
    print("=" * 80)
    print("SQLITE RESOURCE CHECK AND FIXED TOOL")
    print("=" * 80)
    print("This tool directly checks and fixes resource data for the scheduler.\n")

    # Find the database file
    db_path = os.path.join(root_dir, "src/instance/app.db")
    if not os.path.exists(db_path):
        print(f"❌ Database file not found at {db_path}")
        return

    print(f"Database found at: {db_path}")

    # Connect to the database
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row  # This enables column access by name
        cursor = conn.cursor()
        print("Connected to database")
    except sqlite3.Error as e:
        print(f"❌ Error connecting to database: {e}")
        return

    try:
        # Check the database structure
        print("\n1. CHECKING DATABASE STRUCTURE")
        print("-" * 40)

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"Tables in database: {', '.join([t[0] for t in tables])}")

        # Check essential tables
        essential_tables = ["employees", "shifts", "coverage"]
        missing_tables = [
            t for t in essential_tables if t not in [table[0] for table in tables]
        ]

        if missing_tables:
            print(f"❌ Missing essential tables: {', '.join(missing_tables)}")
            return
        else:
            print("✅ All essential tables exist")

        # Check the data in each table
        print("\n2. CHECKING TABLE DATA")
        print("-" * 40)

        employees_count = get_table_count(cursor, "employees")
        shifts_count = get_table_count(cursor, "shifts")
        coverage_count = get_table_count(cursor, "coverage")

        # Sample data from each table
        if employees_count > 0:
            sample_table_data(cursor, "employees")
        if shifts_count > 0:
            sample_table_data(cursor, "shifts")
        if coverage_count > 0:
            sample_table_data(cursor, "coverage")

        # Determine if we need to create test data
        print("\n3. DETERMINING IF TEST DATA IS NEEDED")
        print("-" * 40)

        needs_employees = employees_count == 0
        needs_shifts = shifts_count == 0
        needs_coverage = coverage_count == 0

        if needs_employees or needs_shifts or needs_coverage:
            print("Some test data is needed:")
            if needs_employees:
                print("  - Employees: Missing")
            if needs_shifts:
                print("  - Shift templates: Missing")
            if needs_coverage:
                print("  - Coverage records: Missing")

            print("\n4. CREATING TEST DATA")
            print("-" * 40)

            if needs_employees:
                create_test_employees(conn, cursor)
            if needs_shifts:
                create_test_shifts(conn, cursor)
            if needs_coverage:
                create_test_coverage(conn, cursor)
        else:
            print("All essential data exists.")

            # Check if shift active_days needs fixing
            print("\n4. CHECKING FOR CONFIGURATION ISSUES")
            print("-" * 40)

            print("Checking shift active_days...")
            update_shift_active_days(conn, cursor)

        # Test date for verification
        test_date = date(2025, 5, 10)  # A Saturday
        verify_resources_for_scheduler(cursor, test_date)

        print("\nResource check and fix completed.")

    except Exception as e:
        print(f"❌ Error during resource check and fix: {str(e)}")
        import traceback

        traceback.print_exc()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
