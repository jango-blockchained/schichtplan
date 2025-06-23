#!/usr/bin/env python3
"""
Test script for CSV import API
"""

import requests


def test_csv_preview():
    """Test the CSV preview endpoint with text input"""

    # Test data
    csv_data = """first_name,last_name,employee_group,contracted_hours,email,is_keyholder
John,Doe,Full-time,40,john.doe@example.com,true
Jane,Smith,Part-time,20,jane.smith@example.com,false"""

    # Test with JSON data (textarea input)
    print("Testing CSV preview with text input...")
    try:
        response = requests.post(
            "http://localhost:5000/api/csv-import/preview",
            json={"csv_text": csv_data, "data_type": "employees"},
            headers={"Content-Type": "application/json"},
        )

        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")

        if response.status_code == 200:
            data = response.json()
            print(f"Headers: {data.get('headers')}")
            print(f"Row count: {data.get('row_count')}")
            print(f"Validation: {data.get('validation')}")

    except Exception as e:
        print(f"Error: {e}")


def test_data_types():
    """Test the data types endpoint"""
    print("\nTesting data types endpoint...")
    try:
        response = requests.get("http://localhost:5000/api/csv-import/data-types")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_data_types()
    test_csv_preview()
