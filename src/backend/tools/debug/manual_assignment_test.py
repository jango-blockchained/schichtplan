#!/usr/bin/env python
"""
Manual assignment test.
This script directly creates test assignments in the database bypassing the scheduler.
"""

import os
import sys
import sqlite3
from datetime import date, datetime, timedelta

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, '../..'))
root_dir = os.path.abspath(os.path.join(backend_dir, '../..'))
sys.path.insert(0, root_dir)

def create_test_assignments(cursor, conn, date_to_use):
    """Create test assignments directly in the database"""
    print(f"Creating assignments for date: {date_to_use}")
    
    # First, check if employees and shifts exist
    cursor.execute("SELECT COUNT(*) FROM employees WHERE is_active = 1")
    employee_count = cursor.fetchone()[0]
    if employee_count == 0:
        print("No active employees found. Cannot create assignments.")
        return False
    
    cursor.execute("SELECT COUNT(*) FROM shifts")
    shift_count = cursor.fetchone()[0]
    if shift_count == 0:
        print("No shifts found. Cannot create assignments.")
        return False
    
    # Get all active employees
    cursor.execute("SELECT id FROM employees WHERE is_active = 1 LIMIT 10")
    employees = [row[0] for row in cursor.fetchall()]
    
    # Get all shifts
    cursor.execute("SELECT id FROM shifts")
    shifts = [row[0] for row in cursor.fetchall()]
    
    # Delete any existing assignments for this date (to avoid duplicates)
    print(f"Deleting existing assignments for {date_to_use}...")
    cursor.execute("DELETE FROM schedules WHERE date = ?", (date_to_use.isoformat(),))
    deleted_count = cursor.rowcount
    print(f"Deleted {deleted_count} existing assignments")
    
    # Create assignments - distribute employees across shifts
    assignments_created = 0
    
    # Get highest existing ID to avoid conflicts
    cursor.execute("SELECT COALESCE(MAX(id), 0) FROM schedules")
    max_id = cursor.fetchone()[0]
    next_id = max_id + 1
    
    # For each shift, assign 2-3 employees
    for i, shift_id in enumerate(shifts):
        # Calculate how many employees to assign to this shift (2-3)
        employees_to_assign = min(3, len(employees))
        
        # Get the employees for this shift (rotating through the list)
        shift_employees = employees[:employees_to_assign]
        
        # Rotate the employee list for the next shift
        employees = employees[employees_to_assign:] + employees[:employees_to_assign]
        
        for employee_id in shift_employees:
            try:
                cursor.execute(
                    """
                    INSERT INTO schedules (
                        id, employee_id, shift_id, date, status, created_at, updated_at, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        next_id,
                        employee_id,
                        shift_id,
                        date_to_use.isoformat(),
                        'PENDING',
                        datetime.now().isoformat(),
                        datetime.now().isoformat(),
                        1
                    )
                )
                next_id += 1
                assignments_created += 1
                print(f"Created assignment: Employee {employee_id} to Shift {shift_id}")
            except sqlite3.Error as e:
                print(f"Error creating assignment: {e}")
    
    # Commit the transaction
    if assignments_created > 0:
        conn.commit()
        print(f"\nSuccessfully created {assignments_created} test assignments")
        return True
    else:
        conn.rollback()
        print("No assignments were created")
        return False

def main():
    """Main function for manually creating test assignments"""
    print("=" * 80)
    print("MANUAL ASSIGNMENT TEST")
    print("=" * 80)
    print("This script creates test assignments directly in the database.\n")
    
    # Find and connect to the database
    db_path = os.path.join(root_dir, "src/instance/app.db")
    if not os.path.exists(db_path):
        print(f"❌ Database file not found at {db_path}")
        return
    
    print(f"Database found at: {db_path}\n")
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create assignments for today and tomorrow
        today = date.today()
        tomorrow = today + timedelta(days=1)
        
        # First create for today
        print("\nCreating assignments for TODAY:")
        success_today = create_test_assignments(cursor, conn, today)
        
        # Then create for tomorrow
        print("\nCreating assignments for TOMORROW:")
        success_tomorrow = create_test_assignments(cursor, conn, tomorrow)
        
        # Verify assignments were created
        if success_today or success_tomorrow:
            cursor.execute(
                "SELECT COUNT(*) FROM schedules WHERE date = ?", 
                (today.isoformat(),)
            )
            count_today = cursor.fetchone()[0]
            print(f"\nAssignments for {today}: {count_today}")
            
            cursor.execute(
                "SELECT COUNT(*) FROM schedules WHERE date = ?", 
                (tomorrow.isoformat(),)
            )
            count_tomorrow = cursor.fetchone()[0]
            print(f"\nAssignments for {tomorrow}: {count_tomorrow}")
            
            # Show assignment distribution
            cursor.execute(
                """
                SELECT shifts.shift_type, COUNT(*) as count
                FROM schedules 
                JOIN shifts ON schedules.shift_id = shifts.id
                WHERE schedules.date = ?
                GROUP BY shifts.shift_type
                """,
                (today.isoformat(),)
            )
            distribution_today = cursor.fetchall()
            if distribution_today:
                print("\nAssignment distribution by shift type for today:")
                for shift_type, count in distribution_today:
                    print(f"  {shift_type}: {count} assignments")
            
            cursor.execute(
                """
                SELECT shifts.shift_type, COUNT(*) as count
                FROM schedules 
                JOIN shifts ON schedules.shift_id = shifts.id
                WHERE schedules.date = ?
                GROUP BY shifts.shift_type
                """,
                (tomorrow.isoformat(),)
            )
            distribution_tomorrow = cursor.fetchall()
            if distribution_tomorrow:
                print("\nAssignment distribution by shift type for tomorrow:")
                for shift_type, count in distribution_tomorrow:
                    print(f"  {shift_type}: {count} assignments")
            
            print("\nAssignment creation successful!")
        
        # Close the database connection
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 