#!/usr/bin/env python
"""
Demonstration script for using the scheduler service.
This script shows how to properly use the scheduler service with Flask app context.
"""
import sys
import os
import json
from datetime import datetime, date, timedelta

# Add the parent directories to the path so we can import our modules
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, '..', '..'))
project_dir = os.path.abspath(os.path.join(backend_dir, '..', '..'))

# Add paths if not already in sys.path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

def run_scheduler_demo():
    """Run a demonstration of the scheduler service"""
    
    print("Importing scheduler service...")
    try:
        # Import the scheduler service
        from src.backend.services.scheduler_service import (
            generate_schedule, 
            get_schedule_data, 
            load_resources
        )
        print("Scheduler service imported successfully\n")
    except ImportError as e:
        print(f"Error importing scheduler service: {e}")
        return
        
    print("--- DEMONSTRATING SCHEDULER SERVICE ---")
    
    # Define date range for demo (future dates to avoid conflicts)
    start_date = date.today() + timedelta(days=365)  # One year from now
    end_date = start_date + timedelta(days=6)
    print(f"Date range: {start_date} to {end_date}\n")
    
    # 1. Load resources
    print("1. LOADING RESOURCES")
    print("-----------------------")
    resources_result = load_resources(start_date, end_date)
    
    print(f"Resources loaded: {resources_result['success']}")
    print(f"Employees found: {resources_result.get('employee_count', 0)}")
    print(f"Shifts found: {resources_result.get('shift_count', 0)}")
    if not resources_result['success']:
        print(f"Error: {resources_result.get('error', 'Unknown error')}\n")
    else:
        print("Resources loaded successfully\n")
    
    # 2. Generate schedule
    print("2. GENERATING SCHEDULE")
    print("-----------------------")
    generate_result = generate_schedule(
        start_date=start_date,
        end_date=end_date,
        version=1,
        session_id="demo-run"
    )
    
    if generate_result['success']:
        print(f"Schedule generated successfully!")
        result_data = generate_result.get('result', {})
        entries = result_data.get('entries', [])
        print(f"Generated {len(entries)} schedule entries")
        
        # Show first few entries if any
        if entries:
            print("Sample entries:")
            for idx, entry in enumerate(entries[:3]):
                print(f"  Entry {idx+1}: {entry}")
        
        # Show warnings if any
        warnings = result_data.get('warnings', [])
        if warnings:
            print(f"\n{len(warnings)} warnings:")
            for warning in warnings[:3]:
                print(f"  - {warning}")
    else:
        print(f"Schedule generation failed: {generate_result.get('error', 'Unknown error')}")
    
    # 3. Get schedule data from database
    print("\n3. GETTING SCHEDULE DATA")
    print("-----------------------")
    today = date.today()
    data_result = get_schedule_data(today, today + timedelta(days=30))
    
    if data_result['success']:
        entries = data_result.get('entries', [])
        print(f"Schedule entries in database: {len(entries)}")
        
        # Show first few entries
        for idx, entry in enumerate(entries[:4]):
            employee_name = entry.get('employee_name', 'Unknown')
            entry_date = entry.get('date', 'Unknown date')
            shift = entry.get('shift', 'Unknown shift')
            print(f"  Entry {idx+1}: {employee_name} on {entry_date} with shift {shift}")
    else:
        print(f"Error retrieving schedule data: {data_result.get('error', 'Unknown error')}")
    
    print("\n--- COMPLETED DEMONSTRATION ---")
    print("The scheduler service ensures all operations run with proper app context")
    print("This resolves the SQLAlchemy issues by properly registering the Flask app.")


if __name__ == "__main__":
    run_scheduler_demo() 