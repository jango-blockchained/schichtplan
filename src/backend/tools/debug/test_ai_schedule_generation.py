#!/usr/bin/env python
# test_ai_schedule_generation.py - Test script for AI schedule generation with diagnostics

import sys
import datetime
import json
from pathlib import Path

# Add the src directory to the Python path
src_path = str(Path(__file__).resolve().parent.parent.parent.parent)
if src_path not in sys.path:
    sys.path.append(src_path)

# Import models first, then app
from src.backend.app import create_app
from src.backend.services.ai_scheduler_service import AISchedulerService


def test_ai_schedule_generation():
    """
    Test AI schedule generation with diagnostics.
    This script uses the updated AISchedulerService to generate a schedule and verify diagnostics.
    """
    print("=== Testing AI Schedule Generation with Diagnostics ===")

    # Create Flask app and configure it
    app = create_app()

    # Define the date range for the test
    today = datetime.date.today()
    start_date = today.strftime("%Y-%m-%d")
    end_date = (today + datetime.timedelta(days=7)).strftime("%Y-%m-%d")

    print(f"Generating schedule from {start_date} to {end_date}...")

    # Use the app context
    with app.app_context():
        # Initialize the AI scheduler service inside the context
        ai_scheduler = AISchedulerService()
        # Run the AI schedule generation
        try:
            result = ai_scheduler.generate_schedule_via_ai(
                start_date_str=start_date,
                end_date_str=end_date,
                version_id=None,  # New version will be created
                ai_model_params=None,  # Use default parameters
            )

            # Print the result
            print("\n=== Generation Result ===")
            print(json.dumps(result, indent=2))

            # Verify if the diagnostic log was created
            if result.get("status") == "success" and result.get("diagnostic_log"):
                log_path_str = result.get("diagnostic_log")
                if log_path_str:  # Ensure log_path is not None
                    log_path = Path(log_path_str)  # Convert to Path object
                    print(f"\n=== Checking Diagnostic Log: {log_path} ===")

                    if log_path.exists():
                        print("✅ SUCCESS! Diagnostic log file exists!")
                        print("Last 10 lines of diagnostic log:")
                        with open(log_path, "r") as f:
                            lines = f.readlines()
                            for line in lines[-10:]:
                                print(f"  {line.strip()}")
                    else:
                        print(
                            f"❌ ERROR: Diagnostic log file does not exist at {log_path}"
                        )
                else:
                    print("❌ ERROR: No log path returned in the result")
            else:
                print("❌ Generation failed or no diagnostic log was returned.")
        except Exception as e:
            print(f"❌ ERROR: Exception during AI schedule generation: {str(e)}")

    print("\n=== Test Complete ===")


if __name__ == "__main__":
    test_ai_schedule_generation()
