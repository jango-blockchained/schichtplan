#!/usr/bin/env python
"""
Diagnostic script to trace date handling issues in the scheduler.
"""

from src.backend.app import create_app
from services.scheduler import ScheduleGenerator
from datetime import date, timedelta, datetime
import traceback


def diagnose_date_error():
    """Diagnose date handling issues in the scheduler"""
    app = create_app()
    with app.app_context():
        print("=" * 80)
        print("DIAGNOSING DATE HANDLING ISSUES")
        print("=" * 80)

        print("\nChecking date object creation:")
        try:
            today = date.today()
            print(f"  today = {today} (type: {type(today)})")

            # Test date to string conversion
            today_str = today.isoformat()
            print(f"  today.isoformat() = {today_str} (type: {type(today_str)})")

            # Test string to date conversion
            back_to_date = datetime.fromisoformat(today_str).date()
            print(
                f"  datetime.fromisoformat(today_str).date() = {back_to_date} (type: {type(back_to_date)})"
            )

            # Test date math
            tomorrow = today + timedelta(days=1)
            print(f"  tomorrow = {tomorrow} (type: {type(tomorrow)})")

            print("✓ Basic date operations work correctly")
        except Exception as e:
            print(f"✗ Error in date operations: {str(e)}")
            traceback.print_exc()

        print("\nChecking ScheduleGenerator initialization:")
        try:
            generator = ScheduleGenerator()
            print(f"✓ ScheduleGenerator initialized: {generator}")
        except Exception as e:
            print(f"✗ Error initializing ScheduleGenerator: {str(e)}")
            traceback.print_exc()

        print("\nChecking _date_range method:")
        try:
            generator = ScheduleGenerator()
            today = date.today()
            tomorrow = today + timedelta(days=1)

            dates = list(generator._date_range(today, tomorrow))
            print(f"  _date_range({today}, {tomorrow}) = {dates}")
            print(f"  Types: {[type(d) for d in dates]}")
            print("✓ _date_range works correctly")
        except Exception as e:
            print(f"✗ Error in _date_range: {str(e)}")
            traceback.print_exc()

        print("\nChecking generate_schedule with various date formats:")
        generator = ScheduleGenerator()

        # Case 1: Using date objects
        print("\n1. Testing with date objects:")
        try:
            today = date.today()
            tomorrow = today + timedelta(days=1)
            result = generator.generate_schedule(
                today, tomorrow, create_empty_schedules=False
            )
            print(f"  ✓ Success: Generated {len(result.get('schedule', []))} entries")
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            traceback.print_exc()

        # Case 2: Using ISO-formatted strings
        print("\n2. Testing with ISO date strings:")
        try:
            today_str = date.today().isoformat()
            tomorrow_str = (date.today() + timedelta(days=1)).isoformat()
            result = generator.generate_schedule(
                today_str, tomorrow_str, create_empty_schedules=False
            )
            print(f"  ✓ Success: Generated {len(result.get('schedule', []))} entries")
        except Exception as e:
            print(f"  ✗ Error: {str(e)}")
            traceback.print_exc()

        # Case 3: Using None values (should fail gracefully)
        print("\n3. Testing with None values (should fail with clear error):")
        try:
            result = generator.generate_schedule(
                None, date.today(), create_empty_schedules=False
            )
            print(
                f"  ✓ (Unexpected) Success: Generated {len(result.get('schedule', []))} entries"
            )
        except Exception as e:
            print(f"  ✓ Expected error: {str(e)}")

        print("\nDiagnosis complete")


if __name__ == "__main__":
    diagnose_date_error()
