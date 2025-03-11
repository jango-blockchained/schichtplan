#!/usr/bin/env python
"""
Script to create sample shift templates in the database.
"""

from src.backend.app import create_app
from models import ShiftTemplate, db, Settings
from models.fixed_shift import ShiftType
import argparse


def create_sample_shifts(bypass_validation=False):
    """Create sample shift templates"""
    app = create_app()
    with app.app_context():
        # Check if any shift templates already exist
        existing = ShiftTemplate.query.count()
        if existing > 0:
            print(f"Found {existing} existing shift templates.")
            confirm = input("Do you want to add more sample templates? (y/N): ")
            if confirm.lower() != "y":
                print("Operation cancelled.")
                return

        # Check store hours
        settings = Settings.query.first()
        if not settings:
            print("No store settings found. Creating default settings...")
            settings = Settings()
            db.session.add(settings)
            db.session.commit()

        print(f"Store hours: {settings.store_opening} - {settings.store_closing}")

        # Define sample shifts
        sample_shifts = [
            {
                "start_time": "06:00",
                "end_time": "14:00",
                "min_employees": 2,
                "max_employees": 4,
                "requires_break": True,
                "shift_type": ShiftType.EARLY,
                "active_days": {
                    "0": False,  # Sunday
                    "1": True,  # Monday
                    "2": True,  # Tuesday
                    "3": True,  # Wednesday
                    "4": True,  # Thursday
                    "5": True,  # Friday
                    "6": True,  # Saturday
                },
            },
            {
                "start_time": "10:00",
                "end_time": "18:00",
                "min_employees": 3,
                "max_employees": 5,
                "requires_break": True,
                "shift_type": ShiftType.MIDDLE,
                "active_days": {
                    "0": False,  # Sunday
                    "1": True,  # Monday
                    "2": True,  # Tuesday
                    "3": True,  # Wednesday
                    "4": True,  # Thursday
                    "5": True,  # Friday
                    "6": True,  # Saturday
                },
            },
            {
                "start_time": "14:00",
                "end_time": settings.store_closing,  # Use store closing time
                "min_employees": 2,
                "max_employees": 4,
                "requires_break": True,
                "shift_type": ShiftType.LATE,
                "active_days": {
                    "0": False,  # Sunday
                    "1": True,  # Monday
                    "2": True,  # Tuesday
                    "3": True,  # Wednesday
                    "4": True,  # Thursday
                    "5": True,  # Friday
                    "6": True,  # Saturday
                },
            },
        ]

        # If bypass validation is requested, update store hours temporarily
        original_closing_time = None
        if bypass_validation:
            print("Bypassing validation by temporarily extending store hours...")
            original_closing_time = settings.store_closing
            settings.store_closing = "22:00"
            db.session.commit()
            # Update the late shift to use this time
            sample_shifts[2]["end_time"] = "22:00"

        # Create shift templates
        created = 0
        try:
            for shift_data in sample_shifts:
                # Create new shift template
                shift = ShiftTemplate(
                    start_time=shift_data["start_time"],
                    end_time=shift_data["end_time"],
                    min_employees=shift_data["min_employees"],
                    max_employees=shift_data["max_employees"],
                    requires_break=shift_data["requires_break"],
                    shift_type=shift_data["shift_type"],
                    active_days=shift_data["active_days"],
                )

                # Add to session
                db.session.add(shift)
                created += 1
                print(
                    f"Added shift: {shift.shift_type.value} ({shift.start_time} - {shift.end_time})"
                )

            # Commit changes
            db.session.commit()
            print(f"Successfully created {created} sample shift templates.")

        finally:
            # Restore original closing time if it was changed
            if bypass_validation and original_closing_time:
                settings.store_closing = original_closing_time
                db.session.commit()
                print(f"Restored original store closing time: {original_closing_time}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create sample shift templates")
    parser.add_argument(
        "--bypass-validation",
        action="store_true",
        help="Bypass validation by temporarily changing store hours",
    )
    args = parser.parse_args()

    create_sample_shifts(bypass_validation=args.bypass_validation)
