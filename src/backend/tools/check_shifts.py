#!/usr/bin/env python
"""
Quick script to check shift template configuration in the database.
"""

import os
import sys

# Add the backend directory to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "src", "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from src.backend.app import create_app

app = create_app()

with app.app_context():
    from src.backend.models import ShiftTemplate

    print("SHIFT TEMPLATES:")
    print("-" * 80)
    for shift in ShiftTemplate.query.all():
        print(
            f"ID: {shift.id}, Type: {shift.shift_type_id}, Hours: {shift.start_time}-{shift.end_time}"
        )
        active_days = shift.active_days
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

    print("-" * 80)
    print("Now checking how shifts are categorized by the scheduler:")

    # Import the scheduler components
    from src.backend.services.scheduler.generator import ScheduleGenerator
    from src.backend.services.scheduler.config import SchedulerConfig
    from src.backend.services.scheduler.resources import ScheduleResources

    resources = ScheduleResources()
    resources.load()

    # Initialize a generator with these resources
    config = SchedulerConfig()
    generator = ScheduleGenerator(resources, config)

    print("How the scheduler categorizes these shifts:")
    print("-" * 80)

    for shift in resources.shifts:
        shift_type = shift.shift_type_id

        # Check if shift has explicit type
        if shift_type:
            print(
                f"ID: {shift.id}, Type: {shift_type}, Hours: {shift.start_time}-{shift.end_time}"
            )
        else:
            # Determine category based on start time (similar to distribution.py)
            start_hour = int(shift.start_time.split(":")[0])
            category = None

            if start_hour < 10:
                category = "EARLY"
            elif 10 <= start_hour < 14:
                category = "MIDDLE"
            else:
                category = "LATE"

            print(
                f"ID: {shift.id}, Explicit Type: None, Inferred Type: {category}, Hours: {shift.start_time}-{shift.end_time}"
            )

    print("-" * 80)
    print("Analyzing assignment distribution...")

    # Let's check if assigning shifts by type
    for shift_type in ["EARLY", "MIDDLE", "LATE"]:
        type_shifts = [s for s in resources.shifts if s.shift_type_id == shift_type]
        print(
            f"Shifts of type {shift_type}: {len(type_shifts)} ({[s.id for s in type_shifts]})"
        )

    print("-" * 80)
    print("Shifts by time of day (based on start hour):")

    early_shifts = [s for s in resources.shifts if int(s.start_time.split(":")[0]) < 10]
    middle_shifts = [
        s for s in resources.shifts if 10 <= int(s.start_time.split(":")[0]) < 14
    ]
    late_shifts = [s for s in resources.shifts if int(s.start_time.split(":")[0]) >= 14]

    print(
        f"Morning shifts (before 10:00): {len(early_shifts)} ({[s.id for s in early_shifts]})"
    )
    print(
        f"Midday shifts (10:00-13:59): {len(middle_shifts)} ({[s.id for s in middle_shifts]})"
    )
    print(
        f"Evening shifts (14:00+): {len(late_shifts)} ({[s.id for s in late_shifts]})"
    )

    print("-" * 80)
    print("Shift type inconsistencies (where type != time category):")

    for shift in resources.shifts:
        start_hour = int(shift.start_time.split(":")[0])
        inferred_type = None

        if start_hour < 10:
            inferred_type = "EARLY"
        elif 10 <= start_hour < 14:
            inferred_type = "MIDDLE"
        else:
            inferred_type = "LATE"

        if shift.shift_type_id != inferred_type:
            print(
                f"ID: {shift.id}, Type: {shift.shift_type_id}, Hours: {shift.start_time}-{shift.end_time}, "
                + f"Time matches: {inferred_type}"
            )
