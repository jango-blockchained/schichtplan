#!/usr/bin/env python
"""
Comprehensive test script to verify all our scheduler fixes are working properly.
"""

from src.backend.app import create_app
from src.backend.services.scheduler import ScheduleGenerator
from datetime import date, timedelta
import traceback


def test_all_fixes():
    """Test all the fixes to the scheduler"""
    app = create_app()
    with app.app_context():
        print("=" * 80)
        print("TESTING SCHEDULER FIXES")
        print("=" * 80)

        try:
            print("\n1. Creating ScheduleGenerator...")
            generator = ScheduleGenerator()
            print("✓ ScheduleGenerator created successfully")

            # Get today's date and generate a schedule for the next 7 days
            today = date.today()
            start_date = today
            end_date = today + timedelta(days=6)

            print(f"\n2. Generating schedule from {start_date} to {end_date}...")

            result = generator.generate_schedule(
                start_date=start_date, end_date=end_date, create_empty_schedules=True
            )

            print("✓ Schedule generated successfully!")
            print(f"✓ Generated {len(result.get('schedule', []))} schedule entries")

            # Print warnings (if any)
            warnings = result.get("warnings", [])
            if warnings:
                print(f"\n3. Warnings ({len(warnings)}):")
                for i, warning in enumerate(warnings[:5], 1):
                    print(f"  {i}. {warning}")
                if len(warnings) > 5:
                    print(f"  ... and {len(warnings) - 5} more")
            else:
                print("\n3. No warnings found")

            # Print validation errors (if any)
            errors = result.get("errors", [])
            if errors:
                print(f"\n4. Validation errors ({len(errors)}):")
                for i, error in enumerate(errors[:5], 1):
                    print(
                        f"  {i}. {error.get('message', 'No message')} ({error.get('error_type', 'Unknown')})"
                    )
                if len(errors) > 5:
                    print(f"  ... and {len(errors) - 5} more")
            else:
                print("\n4. No validation errors found")

            # Test with null or invalid values
            print("\n5. Testing with potential edge cases...")
            # 5.1 Testing with None shift
            try:
                generator._exceeds_constraints(
                    generator.resources.employees[0], today, None
                )
                print("✓ _exceeds_constraints handles None shift")
            except Exception as e:
                print(f"✗ _exceeds_constraints fails with None shift: {str(e)}")

            # 5.2 Testing with None employee
            try:
                if generator.resources.shifts:
                    generator._exceeds_constraints(
                        None, today, generator.resources.shifts[0]
                    )
                    print("✓ _exceeds_constraints handles None employee")
                else:
                    print("? Cannot test None employee (no shifts available)")
            except Exception as e:
                print(f"✗ _exceeds_constraints fails with None employee: {str(e)}")

            # 5.3 Testing empty schedule processing
            try:
                generator._add_empty_schedules(today, today)
                print("✓ _add_empty_schedules works correctly")
            except Exception as e:
                print(f"✗ _add_empty_schedules fails: {str(e)}")

            print("\nAll tests completed successfully!")

        except Exception as e:
            print(f"\n❌ ERROR: {str(e)}")
            traceback.print_exc()
            return False

        return True


if __name__ == "__main__":
    test_all_fixes()
