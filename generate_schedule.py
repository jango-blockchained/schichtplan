#!/usr/bin/env python
"""
Script to generate a schedule using the API endpoint with proper day index mapping.
"""

import os
import sys
import json
from datetime import datetime, timedelta, date

# Set Flask environment variables
os.environ['FLASK_APP'] = 'src.backend.run'
os.environ['FLASK_ENV'] = 'development'

# Import Flask and models
from flask import Flask
from src.backend.app import create_app
from src.backend.models import Employee, ShiftTemplate, Coverage, db

def main():
    """Main function to generate schedules."""
    # Create Flask app and check database access
    print("Creating Flask application...")
    app = create_app()
    
    with app.app_context():
        print("Examining database contents...")
        # Query coverage information
        coverages = Coverage.query.all()
        print(f"Found {len(coverages)} coverage requirements")
        
        day_index_counts = {}
        for c in coverages:
            day_index = c.day_index
            if day_index not in day_index_counts:
                day_index_counts[day_index] = 0
            day_index_counts[day_index] += 1
        
        print("\nCoverage distribution by day index:")
        for day_idx, count in sorted(day_index_counts.items()):
            weekday_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day_idx if day_idx < 7 else 0]
            print(f"Day index {day_idx} ({weekday_name}): {count} coverage blocks")
        
        # Query shift templates
        templates = ShiftTemplate.query.all()
        print(f"\nFound {len(templates)} shift templates")
        
        # Check active days in shift templates
        print("\nShift templates active days:")
        for i, t in enumerate(templates):
            active_days_str = ", ".join([day for day, active in t.active_days.items() if active])
            print(f"Template {t.id}: {t.shift_type} ({t.start_time}-{t.end_time}) - Active on days: {active_days_str}")
        
        # Calculate current dates for this year (not 2025)
        today = datetime.now().date()
        # Get the Monday of this week
        current_monday = today - timedelta(days=today.weekday())
        # End date is Sunday
        current_sunday = current_monday + timedelta(days=6)
        
        print(f"\nUsing dates for current week: {current_monday} to {current_sunday}")
        
        # Generate API request payload with explicit date mappings
        url = "http://localhost:5001/api/schedules/generate"
        payload = {
            "start_date": current_monday.strftime("%Y-%m-%d"),
            "end_date": current_sunday.strftime("%Y-%m-%d"),
            "create_empty_schedules": True,
            "config": {
                "use_recurring_templates": True,
                "apply_day_index_mapping": True,
                "map_coverage_by_weekday": True,
                "debug_mode": True,
                "day_index_map": {
                    "0": 0,  # Monday -> day_index 0
                    "1": 1,  # Tuesday -> day_index 1
                    "2": 2,  # Wednesday -> day_index 2
                    "3": 3,  # Thursday -> day_index 3
                    "4": 4,  # Friday -> day_index 4
                    "5": 5,  # Saturday -> day_index 5
                    "6": None  # Sunday -> No day_index (no coverage)
                },
                "template_day_map": {
                    "0": "1",  # day_index 0 (Monday) -> active_days key "1"
                    "1": "2",  # day_index 1 (Tuesday) -> active_days key "2"
                    "2": "3",  # day_index 2 (Wednesday) -> active_days key "3"
                    "3": "4",  # day_index 3 (Thursday) -> active_days key "4"
                    "4": "5",  # day_index 4 (Friday) -> active_days key "5"
                    "5": "6"   # day_index 5 (Saturday) -> active_days key "6"
                }
            }
        }
        
        print(f"API payload: {json.dumps(payload, indent=2)}")
        
        # Make API request
        import requests
        try:
            print("\nSending request to API endpoint...")
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            # Parse the response
            result = response.json()
            
            # Print a summary of the result
            print("\nSchedule generation result:")
            print(f"Success: {result.get('success', False)}")
            print(f"Total shifts: {result.get('total_shifts', 0)}")
            print(f"Version: {result.get('version', '?')}")
            
            # Save the complete result to a file
            with open("schedule_result.json", "w") as f:
                json.dump(result, f, indent=2)
            
            print("\nFull results saved to schedule_result.json")
            
        except requests.exceptions.RequestException as e:
            print(f"Error connecting to the API: {e}")
            print("Make sure the Flask server is running on port 5001.")

if __name__ == "__main__":
    main() 