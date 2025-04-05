#!/usr/bin/env python
"""
Test script to verify day mapping through the API.
"""
import os
import sys
import json
import requests
from datetime import date, timedelta

def main():
    """Test the day mapping functionality through the API."""
    try:
        # API endpoint
        api_url = "http://localhost:5001/api/schedules/day-mapping"
        
        # Test dates
        dates = []
        start_date = date(2025, 3, 31)  # Monday
        
        # Generate one week of dates
        for i in range(7):
            current_date = start_date + timedelta(days=i)
            dates.append(current_date.isoformat())
        
        # Prepare request data
        data = {
            "dates": dates
        }
        
        print(f"Sending request to API with dates: {dates}")
        
        # Send request to API
        response = requests.post(api_url, json=data)
        
        if response.status_code == 200:
            result = response.json()
            print("\nAPI Response:")
            print(json.dumps(result, indent=2))
            
            # Save results to file
            with open("day_map_test_result.json", "w") as f:
                json.dump(result, f, indent=2)
            print("Results saved to day_map_test_result.json")
            
            return 0
        else:
            print(f"API request failed with status {response.status_code}: {response.text}")
            return 1
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main()) 