#!/usr/bin/env python
# test_ai_generation.py - Debug tool to test AI schedule generation

import os
import sys
import json
from pathlib import Path

# Add the parent directory to the path so imports work
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent
sys.path.insert(0, str(backend_dir.parent.parent))

# Import the service with a direct API key
from src.backend.services.ai_scheduler_service import AISchedulerService


def test_ai_generation():
    # Use the provided API key
    api_key = "AIzaSyBHkmdaJzg4R249RunbNlbWo8HUjy425vM"

    # Create AISchedulerService with the provided API key
    ai_service = AISchedulerService()
    ai_service.gemini_api_key = api_key

    print(f"Testing AI generation with model: {ai_service.gemini_model_name}")

    # Test dates for schedule generation
    start_date = "2023-08-01"
    end_date = "2023-08-07"
    test_version = 999  # Use a test version ID that won't conflict with real data

    # Test schedule generation
    print(f"\nTesting schedule generation for {start_date} to {end_date}...")
    try:
        result = ai_service.generate_schedule_via_ai(
            start_date_str=start_date,
            end_date_str=end_date,
            version_id=test_version,
            ai_model_params={"generationConfig": {"temperature": 0.7}},
        )
        print("\nGenerated Schedule Result:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error during schedule generation: {str(e)}")

    print("\nAI generation test completed")


if __name__ == "__main__":
    test_ai_generation()
