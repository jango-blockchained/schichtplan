#!/usr/bin/env python
"""
Diagnostic script to check shift templates and identify any issues.
"""

from src.backend.app import create_app
from models import ShiftTemplate, db
from services.scheduler.resources import ScheduleResources
import traceback


def diagnose_shifts():
    """Diagnose shift template issues in the database"""
    app = create_app()
    with app.app_context():
        # Check if any shift templates exist
        shifts = ShiftTemplate.query.all()
        print(f"Found {len(shifts)} shift templates")

        if not shifts:
            print(
                "No shift templates found. You need to create some shift templates first."
            )
            return

        # Print all shifts and check for missing or invalid values
        print("\nChecking shifts for issues:")
        for i, shift in enumerate(shifts, 1):
            print(f"\nShift #{i}:")
            print(f"  ID: {shift.id}")
            print(
                f"  Type: {shift.shift_type.value if shift.shift_type else 'MISSING'}"
            )
            print(f"  Start time: {shift.start_time}")
            print(f"  End time: {shift.end_time}")
            print(f"  Duration: {shift.duration_hours}")
            print(f"  Min employees: {shift.min_employees}")
            print(f"  Max employees: {shift.max_employees}")
            print(f"  Requires break: {shift.requires_break}")

            # Check for missing required fields
            issues = []
            if not shift.start_time:
                issues.append("Missing start time")
            if not shift.end_time:
                issues.append("Missing end time")
            if not shift.shift_type:
                issues.append("Missing shift type")
            if shift.duration_hours is None:
                issues.append("Missing duration")
            elif shift.duration_hours <= 0:
                issues.append(f"Invalid duration: {shift.duration_hours}")

            if issues:
                print("  ISSUES FOUND:")
                for issue in issues:
                    print(f"    - {issue}")
            else:
                print("  No issues found")

        # Test loading shifts through ScheduleResources
        print("\nTesting shift loading through ScheduleResources:")
        resources = ScheduleResources()
        try:
            resources.load()
            print("Successfully loaded resources")
            print(f"Loaded {len(resources.shifts)} shifts")

            # Check if any shifts are None
            none_shifts = [i for i, s in enumerate(resources.shifts) if s is None]
            if none_shifts:
                print(
                    f"WARNING: Found {len(none_shifts)} None shifts at indices: {none_shifts}"
                )

            # Check durations
            for i, shift in enumerate(resources.shifts):
                if shift is None:
                    continue
                if shift.duration_hours is None:
                    print(f"  Shift #{i + 1} (ID: {shift.id}) has None duration_hours")
                elif shift.duration_hours <= 0:
                    print(
                        f"  Shift #{i + 1} (ID: {shift.id}) has invalid duration: {shift.duration_hours}"
                    )

        except Exception as e:
            print(f"ERROR loading resources: {str(e)}")
            traceback.print_exc()

        # Try to fix any issues
        fix_issues = input("\nWould you like to fix any detected issues? (y/N): ")
        if fix_issues.lower() == "y":
            print("\nFixing issues...")
            fixed = 0

            for shift in shifts:
                updated = False

                # Fix missing durations
                if shift.duration_hours is None or shift.duration_hours <= 0:
                    try:
                        # Calculate duration from start/end time
                        start_hour, start_minute = map(int, shift.start_time.split(":"))
                        end_hour, end_minute = map(int, shift.end_time.split(":"))

                        # Convert to minutes
                        start_minutes = start_hour * 60 + start_minute
                        end_minutes = end_hour * 60 + end_minute

                        # Handle shifts that go past midnight
                        if end_minutes < start_minutes:
                            end_minutes += 24 * 60  # Add 24 hours

                        # Calculate duration in hours
                        duration = (end_minutes - start_minutes) / 60

                        # Update the shift
                        shift.duration_hours = duration
                        print(
                            f"  Fixed duration for shift {shift.id}: {duration} hours"
                        )
                        updated = True
                    except Exception as e:
                        print(f"  ERROR fixing duration for shift {shift.id}: {str(e)}")

                if updated:
                    fixed += 1

            if fixed > 0:
                # Commit changes
                db.session.commit()
                print(f"Fixed issues with {fixed} shifts and saved to database")
            else:
                print("No issues fixed")


if __name__ == "__main__":
    diagnose_shifts()
