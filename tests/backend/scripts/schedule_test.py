#!/usr/bin/env python
"""
Test script for the schedule generator with day mapping fixes.
"""
import os
import sys
import json
import requests
from datetime import datetime, date, timedelta

# Set Flask environment
os.environ['FLASK_APP'] = 'src.backend.run'
os.environ['FLASK_ENV'] = 'development'

def main(args):
    """Main function to test schedule generation."""
    # Get date range from arguments or use current week
    if len(args) >= 2:
        try:
            start_date = datetime.strptime(args[0], '%Y-%m-%d').date()
            end_date = datetime.strptime(args[1], '%Y-%m-%d').date()
        except ValueError:
            print("Invalid date format. Use YYYY-MM-DD")
            return 1
    else:
        # Use current week
        today = date.today()
        start_date = today - timedelta(days=today.weekday())  # Monday
        end_date = start_date + timedelta(days=6)  # Sunday
    
    print(f"Generating schedule from {start_date} to {end_date}")
    
    # Set up API request
    api_url = "http://localhost:5001/api/schedules/generate"
    payload = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "create_empty_schedules": True,
        "config": {
            "use_recurring_templates": True,
            "include_sundays": False
        }
    }
    
    try:
        print(f"Sending request to {api_url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(api_url, json=payload)
        
        # Check response
        if response.status_code == 200:
            result = response.json()
            print(f"Schedule generation {'successful' if result.get('success', False) else 'failed'}")
            print(f"Total shifts generated: {result.get('total_shifts', 0)}")
            
            # Check errors
            errors = result.get('errors', [])
            if errors:
                print(f"Encountered {len(errors)} errors:")
                for error in errors:
                    print(f"- {error}")
            
            # Save results to file
            with open('schedule_test_result.json', 'w') as f:
                json.dump(result, f, indent=2)
            print(f"Results saved to schedule_test_result.json")
            
            return 0
        else:
            print(f"API request failed with status code {response.status_code}")
            print(f"Response: {response.text}")
            return 1
            
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to the API server at {api_url}")
        print("Make sure the Flask server is running on port 5001.")
        return 1
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:])) 