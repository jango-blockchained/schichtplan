#!/usr/bin/env python
"""
Script to check if shift templates exist in the database and fix any issues with missing durations.
"""

from src.backend.app import create_app
from models import ShiftTemplate, db
from services.scheduler.utility import calculate_duration


def check_and_fix_shifts():
    """Check for shift templates and fix any missing durations"""
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

        # Check for shifts with missing durations
        missing_duration = [s for s in shifts if not s.duration_hours]
        if missing_duration:
            print(f"Found {len(missing_duration)} shifts with missing duration")

            # Fix missing durations
            for shift in missing_duration:
                print(
                    f"Fixing shift '{shift.shift_type.value}' ({shift.start_time} - {shift.end_time})"
                )
                try:
                    calculated_duration = calculate_duration(
                        shift.start_time, shift.end_time
                    )
                    shift.duration_hours = calculated_duration
                    print(f"  - Set duration to {calculated_duration} hours")
                except Exception as e:
                    print(f"  - Error calculating duration: {str(e)}")

            # Save changes to database
            db.session.commit()
            print("Fixed missing durations and saved to database")
        else:
            print("All shifts have durations set correctly")

        # Print all shifts with their durations
        print("\nCurrent shifts:")
        for shift in shifts:
            print(
                f"  - {shift.shift_type.value}: {shift.start_time} - {shift.end_time} ({shift.duration_hours} hours)"
            )


if __name__ == "__main__":
    check_and_fix_shifts()
