#!/usr/bin/env python
"""
Script to test schedule generation with the newly created shift templates.
"""

from src.backend.app import create_app
from services.scheduler import ScheduleGenerator
from datetime import date, timedelta


def test_schedule_generation():
    """Test schedule generation with the sample shifts"""
    app = create_app()
    with app.app_context():
        print("Creating ScheduleGenerator...")
        generator = ScheduleGenerator()

        # Get today's date and generate a schedule for the next 7 days
        today = date.today()
        start_date = today
        end_date = today + timedelta(days=6)

        print(f"Generating schedule from {start_date} to {end_date}...")

        try:
            result = generator.generate_schedule(
                start_date=start_date, end_date=end_date, create_empty_schedules=True
            )

            print("Schedule generation successful!")
            print(f"Generated {len(result.get('schedule', []))} schedule entries")

            # Print warnings (if any)
            warnings = result.get("warnings", [])
            if warnings:
                print(f"Warnings: {len(warnings)}")
                for warning in warnings[:5]:  # Print first 5 warnings
                    print(f"  - {warning}")
                if len(warnings) > 5:
                    print(f"  ... and {len(warnings) - 5} more")
            else:
                print("No warnings")

            # Print validation errors (if any)
            errors = result.get("errors", [])
            if errors:
                print(f"Validation errors: {len(errors)}")
                for error in errors[:5]:  # Print first 5 errors
                    print(f"  - {error['message']} ({error['error_type']})")
                if len(errors) > 5:
                    print(f"  ... and {len(errors) - 5} more")
            else:
                print("No validation errors")

            return result

        except Exception as e:
            print(f"Error generating schedule: {str(e)}")
            return None


if __name__ == "__main__":
    test_schedule_generation()
