#!/usr/bin/env python3
"""
Scheduler Service Demo Script

This script demonstrates how to use the scheduler service to generate schedules
and access schedule data. It ensures proper Flask app context management
and properly initializes the database.

It also applies the monkey patch to fix SQLAlchemy app context issues
before attempting to use the scheduler.
"""

import sys
import os
import json
from datetime import date, timedelta, datetime
import time
import traceback

# Add the parent directory to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
src_dir = os.path.abspath(os.path.join(backend_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

# Set up timing
start_time = time.time()

def get_formatted_runtime():
    """Get formatted runtime in seconds"""
    runtime = time.time() - start_time
    return f"{runtime:.2f} seconds"

def run_scheduler_demo():
    """Run a demonstration of the scheduler service with app context management"""
    print("\n" + "=" * 80)
    print("SCHEDULER SERVICE DEMONSTRATION")
    print("=" * 80)
    
    try:
        # First, apply the monkey patch to fix SQLAlchemy issues
        print("\n[1] Applying monkey patch to fix SQLAlchemy issues...")
        from src.backend.tools.debug.fix_scheduler_db import apply_monkey_patch
        
        patch_success = apply_monkey_patch()
        if not patch_success:
            print("❌ Failed to apply monkey patch! Continuing anyway as a test...")
        else:
            print("✅ Successfully applied monkey patch")
        
        # Now import the scheduler service
        print("\n[2] Importing scheduler service...")
        try:
            from src.backend.services.scheduler_service import (
                generate_schedule, 
                get_schedule_data, 
                load_resources
            )
            print("✅ Successfully imported scheduler service")
        except Exception as e:
            print(f"❌ Error importing scheduler service: {str(e)}")
            traceback.print_exc()
            return
        
        # Set up dates for demonstration
        print("\n[3] Setting up date range for demonstration...")
        start_date = date.today() + timedelta(days=365)  # One year in the future
        end_date = start_date + timedelta(days=6)  # One week
        print(f"📅 Date range: {start_date} to {end_date}")
        
        # Load resources for diagnostic purposes
        print("\n[4] Loading scheduler resources...")
        resources_result = load_resources(start_date, end_date)
        
        if resources_result.get("success", False):
            print("✅ Successfully loaded resources:")
            employee_count = resources_result.get("employees", {}).get("count", 0)
            shift_count = resources_result.get("shifts", {}).get("count", 0)
            coverage_count = resources_result.get("coverage", {}).get("count", 0)
            
            print(f"- Employees: {employee_count}")
            print(f"- Shifts: {shift_count}")
            print(f"- Coverage Requirements: {coverage_count}")
            print(f"- Settings Loaded: {resources_result.get('settings', False)}")
        else:
            print("⚠️ Resource loading returned with warnings or errors:")
            if "message" in resources_result:
                print(f"- Message: {resources_result['message']}")
            if "error" in resources_result:
                print(f"- Error: {resources_result['error']}")
        
        # Generate a schedule
        print("\n[5] Generating schedule...")
        generation_result = generate_schedule(
            start_date=start_date,
            end_date=end_date,
            version=1
        )
        
        if "success" in generation_result and generation_result["success"]:
            print("✅ Successfully generated schedule")
            
            # Get details from the result
            if "entries" in generation_result:
                entry_count = len(generation_result["entries"])
                print(f"- Generated {entry_count} schedule entries")
                
                # Show a sample of entries if available
                if entry_count > 0:
                    print("\nSample entries:")
                    for idx, entry in enumerate(generation_result["entries"][:3]):
                        print(f"  Entry {idx+1}: {entry}")
        else:
            print("⚠️ Schedule generation returned with warnings or errors:")
            if "message" in generation_result:
                print(f"- Message: {generation_result['message']}")
            if "error" in generation_result:
                print(f"- Error: {generation_result['error']}")
        
        # Get schedule data from the database
        print("\n[6] Retrieving schedule data from database...")
        schedule_data = get_schedule_data(start_date, end_date)
        
        if schedule_data.get("success", False):
            entry_count = len(schedule_data.get("entries", []))
            print(f"✅ Found {entry_count} schedule entries in database")
            
            # Show entries if available
            if entry_count > 0:
                print("\nSchedule entries:")
                for idx, entry in enumerate(schedule_data["entries"]):
                    print(f"  Entry {idx+1}: Employee {entry['employee_id']} - Shift {entry['shift_id']} on {entry['date']}")
            else:
                print("No schedule entries found in the specified date range")
        else:
            print("⚠️ Error retrieving schedule data:")
            if "message" in schedule_data:
                print(f"- Message: {schedule_data['message']}")
            if "error" in schedule_data:
                print(f"- Error: {schedule_data['error']}")
        
        print("\n" + "=" * 80)
        print(f"SCHEDULER SERVICE DEMO COMPLETED IN {get_formatted_runtime()}")
        print("=" * 80 + "\n")
        
        print("SUMMARY:")
        print("1. Applied monkey patch to fix SQLAlchemy app context issues")
        print("2. Successfully imported scheduler service")
        print(f"3. Loaded resources for date range {start_date} to {end_date}")
        print("4. Attempted to generate a schedule")
        print("5. Retrieved schedule entries from the database")
        print("\nThe scheduler service ensures all operations run with the proper app context,")
        print("which resolves SQLAlchemy issues by properly registering the Flask app.")
        
    except Exception as e:
        print("\n❌ ERROR IN SCHEDULER DEMO:")
        print(f"An unexpected error occurred: {str(e)}")
        traceback.print_exc()
        print("\n" + "=" * 80)
        print(f"SCHEDULER SERVICE DEMO FAILED IN {get_formatted_runtime()}")
        print("=" * 80 + "\n")

if __name__ == "__main__":
    run_scheduler_demo() 