#!/usr/bin/env python3
"""
Shift Type Analyzer

This script analyzes the shift types and scheduling configurations to identify
why only EARLY shifts are being assigned.
"""

import os
import sys
import logging
from datetime import date, datetime, timedelta
import argparse

# Add parent directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
root_dir = os.path.abspath(os.path.join(backend_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Configure basic logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("shift_analyzer")

# Import Flask app directly from app.py
try:
    from app import create_app

    print("Creating Flask app from app module...")
    app = create_app()
except ImportError as e:
    logger.warning(f"Could not import from app: {e}")
    try:
        # Try with the full package path
        from src.backend.app import create_app

        print("Creating Flask app from src.backend.app...")
        app = create_app()
    except ImportError as e:
        logger.error(f"Could not import create_app: {e}")
        logger.error(
            "This script requires the Flask application to access the database."
        )
        logger.error("Please run this script from the project root directory.")
        sys.exit(1)

if not app:
    logger.error("Failed to create Flask application")
    sys.exit(1)


def print_section(title):
    """Print a section title with formatting"""
    print("\n" + "=" * 80)
    print(f" {title} ".center(80, "="))
    print("=" * 80 + "\n")


def print_info(label, value):
    """Print labeled information with consistent formatting"""
    print(f"{label.ljust(25)}: {value}")


def analyze_shifts():
    """Analyze shifts and their type configurations"""
    print_section("SHIFT TYPE ANALYSIS")

    # Always use the Flask app context for database operations
    with app.app_context():
        # Import models after app context is established
        from models import ShiftTemplate

        print("Database Shift Templates:")
        print("-" * 80)

        # Collect shifts by type for analysis
        shifts_by_type = {"EARLY": [], "MIDDLE": [], "LATE": []}
        shifts_by_time = {"morning": [], "midday": [], "evening": []}
        inconsistent_shifts = []

        for shift in ShiftTemplate.query.all():
            shift_id = shift.id
            shift_type = shift.shift_type_id
            start_time = shift.start_time
            end_time = shift.end_time

            # Categorize by configured type
            if shift_type in shifts_by_type:
                shifts_by_type[shift_type].append(shift_id)

            # Categorize by time of day
            start_hour = int(start_time.split(":")[0])
            if start_hour < 10:
                time_category = "morning"
                inferred_type = "EARLY"
            elif 10 <= start_hour < 14:
                time_category = "midday"
                inferred_type = "MIDDLE"
            else:
                time_category = "evening"
                inferred_type = "LATE"

            shifts_by_time[time_category].append(shift_id)

            # Check for inconsistencies
            if shift_type != inferred_type:
                inconsistent_shifts.append(
                    {
                        "id": shift_id,
                        "configured_type": shift_type,
                        "time_category": time_category,
                        "inferred_type": inferred_type,
                        "hours": f"{start_time}-{end_time}",
                    }
                )

            # Print details
            print(f"ID: {shift_id}, Type: {shift_type}, Hours: {start_time}-{end_time}")

            # Show active days
            active_days = shift.active_days
            print(f"  Active days format: {type(active_days).__name__}")

            # Handle both list and dictionary formats for active_days
            if isinstance(active_days, dict):
                days_active = [k for k, v in active_days.items() if v]
                days_map = {
                    "0": "Monday",
                    "1": "Tuesday",
                    "2": "Wednesday",
                    "3": "Thursday",
                    "4": "Friday",
                    "5": "Saturday",
                    "6": "Sunday",
                }
                active_days_names = [days_map[day] for day in days_active]
                print(f"  Active days: {', '.join(active_days_names)}")
            elif isinstance(active_days, list):
                days_map = {
                    0: "Monday",
                    1: "Tuesday",
                    2: "Wednesday",
                    3: "Thursday",
                    4: "Friday",
                    5: "Saturday",
                    6: "Sunday",
                }
                active_days_names = [
                    days_map.get(day, f"Unknown({day})") for day in active_days
                ]
                print(f"  Active days: {', '.join(active_days_names)}")
            else:
                print(f"  Active days: Unknown format - {active_days}")

        print("\nShifts by Configured Type:")
        for shift_type, shift_ids in shifts_by_type.items():
            print(f"  {shift_type}: {len(shift_ids)} shifts - {shift_ids}")

        print("\nShifts by Time of Day:")
        print(
            f"  Morning (before 10:00): {len(shifts_by_time['morning'])} shifts - {shifts_by_time['morning']}"
        )
        print(
            f"  Midday (10:00-13:59): {len(shifts_by_time['midday'])} shifts - {shifts_by_time['midday']}"
        )
        print(
            f"  Evening (14:00+): {len(shifts_by_time['evening'])} shifts - {shifts_by_time['evening']}"
        )

        if inconsistent_shifts:
            print("\nInconsistent Type Assignments (type doesn't match time):")
            for shift in inconsistent_shifts:
                print(
                    f"  Shift ID {shift['id']}: Type is {shift['configured_type']} but time {shift['hours']} suggests {shift['inferred_type']}"
                )
            print("\n⚠️  WARNING: These inconsistencies may cause distribution issues!")
        else:
            print("\n✅ All shifts have types that match their time ranges.")

        # Now check how the distribution manager handles these shifts
        print_section("DISTRIBUTION MANAGER ANALYSIS")

        # Import scheduler components
        from services.scheduler.generator import ScheduleGenerator
        from services.scheduler.config import SchedulerConfig
        from services.scheduler.resources import ScheduleResources
        from services.scheduler.distribution import DistributionManager

        resources = ScheduleResources()
        resources.load()

        config = SchedulerConfig()
        generator = ScheduleGenerator(resources, config)

        # Create a distribution manager
        distribution_manager = DistributionManager(
            resources,
            generator.constraint_checker,
            generator.availability_checker,
            config,
        )

        print("Looking at how shifts are distributed in _assign_employees_by_type:")

        # Check if we can access and call the assign_employees_by_type method
        sample_date = date.today()

        # Get max 4 random shifts for testing
        test_shifts = (
            resources.shifts[:4] if len(resources.shifts) >= 4 else resources.shifts
        )

        # Get test shifts by type
        early_shifts = [s for s in resources.shifts if s.shift_type_id == "EARLY"][:2]
        middle_shifts = [s for s in resources.shifts if s.shift_type_id == "MIDDLE"][:2]
        late_shifts = [s for s in resources.shifts if s.shift_type_id == "LATE"][:2]

        print(f"\nEarly shifts for testing: {[s.id for s in early_shifts]}")
        print(f"Middle shifts for testing: {[s.id for s in middle_shifts]}")
        print(f"Late shifts for testing: {[s.id for s in late_shifts]}")

        # Check categorization logic
        print("\nChecking categorize_shift method (if available):")

        for shift in resources.shifts:
            if hasattr(distribution_manager, "_categorize_shift"):
                try:
                    category = distribution_manager._categorize_shift(shift)
                    print(
                        f"Shift {shift.id} ({shift.shift_type_id}, {shift.start_time}-{shift.end_time}) categorized as: {category}"
                    )

                    # Warn about inconsistencies
                    if category != shift.shift_type_id:
                        print(
                            f"⚠️  WARNING: Distribution manager categorizes shift {shift.id} as {category}, "
                            f"but it's configured as {shift.shift_type_id}!"
                        )
                except Exception as e:
                    print(f"Error categorizing shift {shift.id}: {e}")
            else:
                print("Distribution manager doesn't have _categorize_shift method.")
                break

        # Analyze the filter_shifts_by_type method if it exists
        if hasattr(distribution_manager, "filter_shifts_by_type"):
            print("\nChecking if shift filtering works correctly:")

            for shift_type in ["EARLY", "MIDDLE", "LATE"]:
                try:
                    filtered = distribution_manager.filter_shifts_by_type(
                        resources.shifts, shift_type
                    )
                    print(
                        f"Shifts filtered by {shift_type}: {[s.id for s in filtered]}"
                    )
                except Exception as e:
                    print(f"Error filtering shifts by {shift_type}: {e}")
        else:
            print("\nDistribution manager doesn't have a filter_shifts_by_type method.")


def main():
    """Main function to parse arguments and run the analysis"""
    parser = argparse.ArgumentParser(description="Shift Type Analyzer Tool")

    args = parser.parse_args()

    print_section("SHIFT TYPE ANALYZER TOOL")
    print(
        "This tool analyzes shift types and configurations to identify distribution issues."
    )

    analyze_shifts()

    print("\n" + "=" * 80)
    print(" ANALYSIS COMPLETE ".center(80, "="))
    print("=" * 80)


if __name__ == "__main__":
    main()
