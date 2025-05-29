#!/usr/bin/env python
"""
Script to check and fix shift template active_days, which appears to be preventing shifts from being assigned.
"""

import os
import sys
from datetime import date, timedelta

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../../.."))
sys.path.insert(0, backend_dir)


def main():
    """Main function to check and fix shift template active_days."""
    print("=================================================================")
    print("                 SHIFT ACTIVE DAYS FIXED TOOL                      ")
    print("=================================================================")

    # Import necessary modules in function to ensure proper path resolution
    from backend.app import create_app

    # Create app and run within context
    app = create_app()

    with app.app_context():
        # Import models within app context
        from backend.models import db, ShiftTemplate, Coverage

        # 1. Check if shifts exist
        shifts = ShiftTemplate.query.all()
        print(f"Found {len(shifts)} shift templates")

        # 2. Check for missing active_days
        shifts_missing_active_days = []
        shifts_with_invalid_active_days = []

        # Map for day of week indices
        day_names = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]

        for shift in shifts:
            if (
                not hasattr(shift, "active_days")
                or shift.active_days is None
                or len(shift.active_days) == 0
            ):
                shifts_missing_active_days.append(shift)
            elif not isinstance(shift.active_days, list) or not all(
                isinstance(day, int) and 0 <= day <= 6 for day in shift.active_days
            ):
                shifts_with_invalid_active_days.append(shift)
            else:
                print(
                    f"Shift #{shift.id}: active on {shift.active_days} ({', '.join(day_names[day] for day in shift.active_days if 0 <= day <= 6)})"
                )

        # 3. Check coverage to determine which days have requirements
        coverage_by_day = {}
        for day_idx in range(7):
            day_coverage = Coverage.query.filter_by(day_index=day_idx).all()
            coverage_by_day[day_idx] = day_coverage

        days_with_coverage = [
            day for day, coverage in coverage_by_day.items() if coverage
        ]
        print(
            f"\nDays with coverage requirements: {[day_names[day] for day in days_with_coverage]}"
        )

        # 4. Report issues
        if shifts_missing_active_days:
            print(
                f"\nFOUND {len(shifts_missing_active_days)} SHIFTS WITH MISSING ACTIVE_DAYS:"
            )
            for shift in shifts_missing_active_days:
                print(
                    f"  Shift #{shift.id}: {shift.start_time}-{shift.end_time}, {getattr(shift, 'shift_type', 'Unknown type')}"
                )

        if shifts_with_invalid_active_days:
            print(
                f"\nFOUND {len(shifts_with_invalid_active_days)} SHIFTS WITH INVALID ACTIVE_DAYS:"
            )
            for shift in shifts_with_invalid_active_days:
                print(f"  Shift #{shift.id}: active_days = {shift.active_days}")

        # 5. Offer to fix the issues
        if shifts_missing_active_days or shifts_with_invalid_active_days:
            fix_option = input("\nWould you like to fix these issues? (y/n): ")
            if fix_option.lower() == "y":
                # Default to all days with coverage or all weekdays if no coverage
                default_days = (
                    days_with_coverage if days_with_coverage else list(range(7))
                )

                print(
                    f"Default active days will be set to: {default_days} ({', '.join(day_names[day] for day in default_days)})"
                )
                use_default = input(
                    "Use these default active days for all shifts? (y/n): "
                )

                fixed_count = 0
                for shift in (
                    shifts_missing_active_days + shifts_with_invalid_active_days
                ):
                    if use_default.lower() == "y":
                        shift.active_days = default_days
                        fixed_count += 1
                    else:
                        print(
                            f"\nShift #{shift.id}: {shift.start_time}-{shift.end_time}"
                        )
                        days_input = input(
                            f"Enter active days (comma-separated 0-6, e.g. '0,1,2,3,4' for weekdays): "
                        )
                        try:
                            active_days = [
                                int(d.strip())
                                for d in days_input.split(",")
                                if d.strip()
                            ]
                            if all(0 <= day <= 6 for day in active_days):
                                shift.active_days = active_days
                                fixed_count += 1
                            else:
                                print("Invalid input. Days must be between 0-6.")
                        except ValueError:
                            print(
                                "Invalid input. Please enter comma-separated integers."
                            )

                if fixed_count > 0:
                    db.session.commit()
                    print(f"\nSuccessfully fixed {fixed_count} shifts.")

                    # Test to see which shifts will be active for the next 7 days
                    today = date.today()
                    print("\nShifts active for the next 7 days:")
                    for i in range(7):
                        test_date = today + timedelta(days=i)
                        weekday = test_date.weekday()
                        active_shifts = [
                            s
                            for s in shifts
                            if hasattr(s, "active_days")
                            and s.active_days
                            and weekday in s.active_days
                        ]
                        print(
                            f"  {test_date} ({day_names[weekday]}): {len(active_shifts)} active shifts"
                        )
                else:
                    print("No shifts were fixed.")
            else:
                print("No changes made.")
        else:
            print("\nAll shifts have valid active_days configuration.")

        # 6. Check alignment between shifts and coverage
        print("\nChecking alignment between shifts and coverage:")
        misalignments = []

        for day_idx, day_coverage in coverage_by_day.items():
            if not day_coverage:
                continue  # Skip days without coverage

            # Find shifts active on this day
            active_shifts = [
                s
                for s in shifts
                if hasattr(s, "active_days")
                and s.active_days
                and day_idx in s.active_days
            ]

            # Check if there are any active shifts for this day
            if not active_shifts:
                misalignments.append(
                    f"Day {day_idx} ({day_names[day_idx]}) has coverage but no active shifts"
                )
                continue

            # Check each coverage block
            for cov in day_coverage:
                matching_shifts = [
                    s
                    for s in active_shifts
                    if s.start_time == cov.start_time and s.end_time == cov.end_time
                ]

                if not matching_shifts:
                    misalignments.append(
                        f"Day {day_idx} ({day_names[day_idx]}): No shift matches coverage {cov.start_time}-{cov.end_time}"
                    )

        if misalignments:
            print("\nMISALIGNMENTS FOUND:")
            for issue in misalignments:
                print(f"  - {issue}")
            print(
                "\nThis means that even with active_days fixed, you might still have issues with shift assignments"
            )
            print("because the shift times don't match the coverage times.")
        else:
            print("\nGood news! Shifts and coverage requirements appear to be aligned.")

        print(
            "\nScript completed. Try generating a schedule now to see if shifts are assigned."
        )


if __name__ == "__main__":
    main()
