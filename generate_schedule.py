#!/usr/bin/env python
"""
Script to generate a schedule using the API endpoint directly
"""

import os
import sys
import json
from datetime import datetime, timedelta

# Add project root to path
sys.path.insert(0, os.path.abspath('.'))

# Import the app
from src.backend.app import create_app
from src.backend.services.scheduler.generator import ScheduleGenerator
from src.backend.services.scheduler.resources import ScheduleResources

def main():
    # Get date range from command line
    if len(sys.argv) > 2:
        start_date_str = sys.argv[1]
        end_date_str = sys.argv[2]
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    else:
        # Use current week
        today = datetime.now().date()
        start_date = today - timedelta(days=today.weekday())  # Monday
        end_date = start_date + timedelta(days=6)  # Sunday
        print(f"Using current week: {start_date} to {end_date}")

    # Create Flask app and context
    app = create_app()
    with app.app_context():
        print(f"Generating schedule for {start_date} to {end_date}")
        
        # Create scheduler resources
        resources = ScheduleResources()
        resources.start_date = start_date
        resources.end_date = end_date
        resources.load()
        
        print(f"Loaded {len(resources.get_employees())} employees")
        print(f"Loaded {len(resources.get_shifts())} shifts")
        print(f"Loaded {len(resources.get_coverages())} coverages")
        
        # Create scheduler and generate schedule
        generator = ScheduleGenerator(resources=resources)
        result = generator.generate(start_date=start_date, end_date=end_date, version=1)
        
        # Print results
        print("\nSchedule generation result:")
        print(f"Success: {result.get('success', False)}")
        print(f"Total schedules: {len(result.get('schedules', []))}")
        print(f"Total errors: {len(result.get('errors', []))}")
        
        # Print the first few errors if any
        errors = result.get('errors', [])
        if errors:
            print("\nErrors:")
            for i, error in enumerate(errors[:5]):
                print(f"{i+1}. {error.get('message', 'Unknown error')}")
            if len(errors) > 5:
                print(f"... and {len(errors) - 5} more errors")
        
        # Save the result to a file
        with open('schedule_result.json', 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\nFull results saved to schedule_result.json")

if __name__ == "__main__":
    main() 