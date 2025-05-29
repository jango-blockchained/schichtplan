#!/usr/bin/env python
# direct_test_ai.py - Test AI generation directly without Flask context

import sys
import json
import requests
from pathlib import Path

# Add the parent directory to the path so imports work
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent
sys.path.insert(0, str(backend_dir.parent.parent))


def test_gemini_api_directly():
    """Test the Gemini API directly without relying on Flask app context"""

    # API key and parameters
    api_key = "AIzaSyBHkmdaJzg4R249RunbNlbWo8HUjy425vM"
    model_name = "gemini-1.5-pro-latest"

    print(f"Testing Gemini API directly with model: {model_name}")

    # Simple API parameters
    params = {
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 2048,
        },
        "safetySettings": [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE",
            },
        ],
    }

    # Simple prompt for testing
    prompt = """
    Give me a very brief schedule for 3 employees working in a store for a week.
    Please output in this CSV format:
    EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime
    
    Example:
    1,2023-08-01,1,Morning,08:00,16:00
    
    Only output the CSV data with no additional text.
    """

    # API endpoint
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}

    # Build the payload
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": params.get("generationConfig"),
        "safetySettings": params.get("safetySettings"),
    }

    try:
        print("Sending request to Gemini API...")
        response = requests.post(api_url, headers=headers, json=payload, timeout=30)

        print(f"Status code: {response.status_code}")

        if response.status_code == 200:
            response_json = response.json()

            # Try to extract the text response
            if (
                (candidates := response_json.get("candidates"))
                and (content := candidates[0].get("content"))
                and (parts := content.get("parts"))
                and (text := parts[0].get("text"))
            ):
                print("\nAPI Response Text:")
                print("-----------------")
                print(text.strip())
                print("-----------------")
                return

            # If we couldn't extract the text in the expected format
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
    test_gemini_api_directly()
