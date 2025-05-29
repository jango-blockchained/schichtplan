#!/usr/bin/env python
# test_flash_model.py - Test the gemini-1.5-flash model for schedule generation

import os
import sys
import json
import requests
from pathlib import Path

# Add the parent directory to the path so imports work
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent
sys.path.insert(0, str(backend_dir.parent.parent))


def test_gemini_flash():
    """Test the gemini-1.5-flash model for schedule generation"""

    # API key and parameters
    api_key = "AIzaSyBHkmdaJzg4R249RunbNlbWo8HUjy425vM"
    model_name = "gemini-1.5-flash"

    print(f"Testing {model_name} for schedule generation")

    # Simple API parameters
    params = {
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 2048,
        }
    }

    # Prompt for schedule generation
    prompt = """
    Create a schedule for 3 employees (John, Mary, and Alex) working in a store for one week.
    The store is open from 9:00 to 18:00 every day.
    There are three shift types:
    1. Morning shift: 9:00 - 13:00
    2. Afternoon shift: 13:00 - 18:00
    3. Full day shift: 9:00 - 18:00

    Output the schedule in this CSV format:
    EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime

    EmployeeID should be: 1 for John, 2 for Mary, 3 for Alex
    ShiftTemplateID should be: 1 for Morning, 2 for Afternoon, 3 for Full day
    
    Create a schedule for these dates: 2023-08-01 to 2023-08-07
    
    Output ONLY the CSV format with no additional text, explanations or markdown.
    """

    # API endpoint
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}

    # Build the payload
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": params.get("generationConfig"),
    }

    try:
        print("Sending request...")
        response = requests.post(api_url, headers=headers, json=payload, timeout=30)

        print(f"Status code: {response.status_code}")

        if response.status_code == 200:
            response_json = response.json()

            # Extract the text response
            if (
                (candidates := response_json.get("candidates"))
                and (content := candidates[0].get("content"))
                and (parts := content.get("parts"))
                and (text := parts[0].get("text"))
            ):
                print("\nSchedule CSV Response:")
                print("-----------------------")
                print(text.strip())
                print("-----------------------")

                # Try to parse as CSV
                try:
                    import csv
                    from io import StringIO

                    print("\nParsed entries:")
                    csvfile = StringIO(text.strip())
                    reader = csv.reader(csvfile)

                    # Print header
                    header = next(reader, None)
                    if header:
                        print(f"Header: {', '.join(header)}")

                    # Print first few rows
                    rows = list(reader)
                    for i, row in enumerate(rows[:5]):  # Show first 5 rows
                        print(f"Row {i + 1}: {', '.join(row)}")

                    print(f"Total rows: {len(rows)}")
                except Exception as csv_err:
                    print(f"Error parsing CSV: {str(csv_err)}")
            else:
                print("Response format didn't match expected structure.")
                print(json.dumps(response_json, indent=2))

        else:
            print(f"API request failed with status code: {response.status_code}")
            try:
                error_details = response.json()
                print("Error details:")
                print(json.dumps(error_details, indent=2))
            except json.JSONDecodeError:
                print("Raw error response:", response.text)

    except requests.exceptions.RequestException as e:
        print(f"Request error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    test_gemini_flash()
