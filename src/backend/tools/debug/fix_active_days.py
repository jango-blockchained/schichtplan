#!/usr/bin/env python
"""
Simple script to directly fix shift_template active_days in the database.
This is a critical fix for the schedule generation process.
"""

import os
import sys
import json
import sqlite3
from datetime import date, timedelta

def main():
    """Fix the active_days for shift templates."""
    print("=================================================================")
    print("             SHIFT TEMPLATE ACTIVE_DAYS FIX TOOL                 ")
    print("=================================================================")
    
    # Find the database file
    # Default location is in the src/instance folder
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "../../../.."))
    instance_dir = os.path.join(project_root, "src/instance")
    
    db_path = os.path.join(instance_dir, "app.db")
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        alternative_path = input("Enter the path to the SQLite database file: ")
        if alternative_path and os.path.exists(alternative_path):
            db_path = alternative_path
        else:
            print("Invalid database path. Exiting.")
            return
    
    print(f"Using database at: {db_path}")
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all shift templates
        cursor.execute("SELECT * FROM shifts")
        shifts = cursor.fetchall()
        
        if not shifts:
            print("No shift templates found in the database.")
            return
        
        print(f"Found {len(shifts)} shift templates.")
        
        # Check shift templates for active_days
        shifts_missing_active_days = []
        shifts_with_invalid_active_days = []
        shifts_with_valid_active_days = []
        
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        for shift in shifts:
            shift_id = shift['id']
            active_days = shift['active_days']
            
            if active_days is None:
                shifts_missing_active_days.append(shift)
                print(f"Shift #{shift_id}: No active_days defined")
            else:
                try:
                    # Parse the JSON array
                    days_list = json.loads(active_days)
                    if not days_list or not isinstance(days_list, list):
                        print(f"Shift #{shift_id}: Empty or invalid active_days: {active_days}")
                        shifts_with_invalid_active_days.append(shift)
                    else:
                        days_text = ", ".join(day_names[day] for day in days_list if 0 <= day < 7)
                        print(f"Shift #{shift_id}: active on {days_list} ({days_text})")
                        shifts_with_valid_active_days.append(shift)
                except (json.JSONDecodeError, TypeError, ValueError):
                    print(f"Shift #{shift_id}: Invalid active_days format: {active_days}")
                    shifts_with_invalid_active_days.append(shift)
        
        # Get coverage to determine which days have requirements
        cursor.execute("SELECT DISTINCT day_index FROM coverage")
        coverage_days = [row[0] for row in cursor.fetchall()]
        
        days_with_coverage = [day for day in coverage_days if 0 <= day <= 6]
        if days_with_coverage:
            coverage_days_text = ", ".join(day_names[day] for day in days_with_coverage)
            print(f"\nDays with coverage requirements: {days_with_coverage} ({coverage_days_text})")
        else:
            print("\nNo coverage requirements found by day. Using all days of the week as default.")
            days_with_coverage = list(range(7))
        
        # Offer to fix the issues
        if shifts_missing_active_days or shifts_with_invalid_active_days:
            print(f"\nFOUND {len(shifts_missing_active_days)} SHIFTS WITH MISSING ACTIVE_DAYS")
            print(f"FOUND {len(shifts_with_invalid_active_days)} SHIFTS WITH INVALID ACTIVE_DAYS")
            
            fix_option = input("\nWould you like to fix these issues? (y/n): ")
            if fix_option.lower() == 'y':
                # Default to all days with coverage
                default_days = days_with_coverage
                
                print(f"Default active days will be set to: {default_days} ({', '.join(day_names[day] for day in default_days if 0 <= day < 7)})")
                use_default = input("Use these default active days for all shifts? (y/n): ")
                
                fixed_count = 0
                
                if use_default.lower() == 'y':
                    # Fix all shifts using default days
                    default_days_json = json.dumps(default_days)
                    
                    for shift in shifts_missing_active_days + shifts_with_invalid_active_days:
                        cursor.execute(
                            "UPDATE shifts SET active_days = ? WHERE id = ?",
                            (default_days_json, shift['id'])
                        )
                        fixed_count += 1
                else:
                    # Fix shifts individually
                    for shift in shifts_missing_active_days + shifts_with_invalid_active_days:
                        print(f"\nShift #{shift['id']}: {shift['start_time']}-{shift['end_time']}")
                        days_input = input(f"Enter active days (comma-separated 0-6, e.g. '0,1,2,3,4' for weekdays): ")
                        
                        try:
                            active_days = [int(d.strip()) for d in days_input.split(',') if d.strip()]
                            if all(0 <= day <= 6 for day in active_days):
                                active_days_json = json.dumps(active_days)
                                cursor.execute(
                                    "UPDATE shifts SET active_days = ? WHERE id = ?",
                                    (active_days_json, shift['id'])
                                )
                                fixed_count += 1
                            else:
                                print("Invalid input. Days must be between 0-6.")
                        except ValueError:
                            print("Invalid input. Please enter comma-separated integers.")
                
                if fixed_count > 0:
                    conn.commit()
                    print(f"\nSuccessfully fixed {fixed_count} shifts.")
                    
                    # Verify the fixes
                    cursor.execute("SELECT * FROM shifts")
                    updated_shifts = cursor.fetchall()
                    
                    active_shift_count = 0
                    for shift in updated_shifts:
                        active_days = shift['active_days']
                        if active_days:
                            try:
                                days_list = json.loads(active_days)
                                if days_list and isinstance(days_list, list):
                                    active_shift_count += 1
                            except:
                                pass
                    
                    print(f"After update: {active_shift_count} of {len(updated_shifts)} shifts have valid active_days.")
                else:
                    print("No shifts were fixed.")
            else:
                print("No changes made.")
        else:
            print("\nAll shifts already have valid active_days configuration.")
        
        # Close the database connection
        conn.close()
        
        print("\nScript completed. Try generating a schedule now to see if shifts are assigned.")
        print("If you're still having issues, check that the shift times align with coverage requirements.")
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 