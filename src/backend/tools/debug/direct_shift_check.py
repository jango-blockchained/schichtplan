#!/usr/bin/env python
"""
Direct database inspection script to diagnose shift and coverage configuration.
This bypasses the ORM to check the database directly.
"""

import os
import sys
import sqlite3
from datetime import date, datetime, timedelta
import json

def main():
    """Main function to check shift templates and coverage directly from the database"""
    print("=" * 80)
    print("DIRECT SHIFT DATABASE INSPECTION TOOL")
    print("=" * 80)
    print("This tool directly inspects the database to find configuration issues.\n")
    
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
    
    # Check shift templates
    print("1. CHECKING SHIFT TEMPLATES")
    print("-" * 40)
    try:
        cursor.execute("SELECT * FROM shifts")
        shifts = cursor.fetchall()
        print(f"Found {len(shifts)} shift templates")
        
        for shift in shifts:
            shift_id = shift['id']
            shift_type = shift['shift_type']
            start_time = shift['start_time']
            end_time = shift['end_time']
            active_days = shift['active_days'] if 'active_days' in shift.keys() else None
            
            print(f"Shift {shift_id} ({shift_type}): {start_time} - {end_time}")
            print(f"  Active days: {active_days}")
            
            if not active_days or active_days.strip() == '':
                print(f"  ⚠️ WARNING: Shift {shift_id} has no active_days configured!")
                
            # Try to parse active_days JSON if present
            if active_days and active_days.strip() != '':
                try:
                    days = json.loads(active_days)
                    print(f"  Parsed active days: {days}")
                except json.JSONDecodeError:
                    # If not JSON, try comma-separated values
                    try:
                        days = [int(day.strip()) for day in active_days.split(',')]
                        print(f"  Parsed active days: {days}")
                    except ValueError:
                        print(f"  ⚠️ WARNING: Could not parse active_days value: {active_days}")
    except Exception as e:
        print(f"Error reading shift templates: {e}")
    
    # Check coverage data
    print("\n2. CHECKING COVERAGE REQUIREMENTS")
    print("-" * 40)
    try:
        cursor.execute("SELECT * FROM coverage")
        coverage_records = cursor.fetchall()
        print(f"Found {len(coverage_records)} coverage records")
        
        for cov in coverage_records:
            cov_id = cov['id']
            day_index = cov['day_index'] if 'day_index' in cov.keys() else None
            shift_id = cov['shift_id'] if 'shift_id' in cov.keys() else None
            min_employees = cov['min_employees'] if 'min_employees' in cov.keys() else None
            start_time = cov['start_time'] if 'start_time' in cov.keys() else None
            end_time = cov['end_time'] if 'end_time' in cov.keys() else None
            
            print(f"Coverage {cov_id}: Day {day_index}, Time {start_time}-{end_time}, Min Employees {min_employees}")
            if shift_id:
                print(f"  Linked to shift: {shift_id}")
            
            # Check for potential issues
            if day_index is None or day_index < 0 or day_index > 6:
                print(f"  ⚠️ WARNING: Invalid day_index: {day_index}")
            
            if min_employees is None or min_employees <= 0:
                print(f"  ⚠️ WARNING: Invalid min_employees: {min_employees}")
    except Exception as e:
        print(f"Error reading coverage data: {e}")
    
    # Check employee data
    print("\n3. CHECKING EMPLOYEE DATA")
    print("-" * 40)
    try:
        cursor.execute("SELECT COUNT(*) FROM employees WHERE is_active = 1")
        active_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM employees WHERE is_keyholder = 1")
        keyholder_count = cursor.fetchone()[0]
        
        print(f"Active employees: {active_count}")
        print(f"Keyholders: {keyholder_count}")
        
        if keyholder_count == 0:
            print("  ⚠️ WARNING: No keyholders found in the system")
    except Exception as e:
        print(f"Error reading employee data: {e}")
    
    # Check availability data
    print("\n4. CHECKING AVAILABILITY DATA")
    print("-" * 40)
    try:
        cursor.execute("SELECT COUNT(*) FROM employee_availabilities")
        avail_count = cursor.fetchone()[0]
        print(f"Availability records: {avail_count}")
        
        # Get a sample of availability records
        cursor.execute("SELECT * FROM employee_availabilities LIMIT 5")
        sample_avail = cursor.fetchall()
        
        if sample_avail:
            print("Sample availability records:")
            for avail in sample_avail:
                avail_id = avail['id']
                employee_id = avail['employee_id'] if 'employee_id' in avail.keys() else None
                start_dt = avail['start_datetime'] if 'start_datetime' in avail.keys() else None
                end_dt = avail['end_datetime'] if 'end_datetime' in avail.keys() else None
                avail_type = avail['availability_type'] if 'availability_type' in avail.keys() else None
                
                print(f"  Availability {avail_id}: Employee {employee_id}, {start_dt} to {end_dt}, Type: {avail_type}")
    except Exception as e:
        print(f"Error reading availability data: {e}")
    
    # Check for any assigned shifts in the schedule
    print("\n5. CHECKING EXISTING SCHEDULE ENTRIES")
    print("-" * 40)
    try:
        cursor.execute("SELECT COUNT(*) FROM schedules")
        schedule_count = cursor.fetchone()[0]
        print(f"Schedule entries: {schedule_count}")
        
        # Check for recent entries
        today = date.today()
        one_month_ago = today - timedelta(days=30)
        cursor.execute("SELECT COUNT(*) FROM schedules WHERE date >= ?", (one_month_ago.isoformat(),))
        recent_count = cursor.fetchone()[0]
        print(f"Recent schedule entries (last 30 days): {recent_count}")
        
        # Get sample entries if available
        if schedule_count > 0:
            cursor.execute("SELECT * FROM schedules ORDER BY date DESC LIMIT 5")
            sample_entries = cursor.fetchall()
            
            print("Sample schedule entries:")
            for entry in sample_entries:
                entry_id = entry['id']
                employee_id = entry['employee_id'] if 'employee_id' in entry.keys() else None
                shift_id = entry['shift_id'] if 'shift_id' in entry.keys() else None
                entry_date = entry['date'] if 'date' in entry.keys() else None
                status = entry['status'] if 'status' in entry.keys() else None
                
                print(f"  Schedule {entry_id}: Employee {employee_id}, Shift {shift_id}, Date: {entry_date}, Status: {status}")
    except Exception as e:
        print(f"Error reading schedule data: {e}")
    
    conn.close()
    print("\nDatabase inspection complete.")

if __name__ == "__main__":
    main() 