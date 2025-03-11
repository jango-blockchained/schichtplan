#!/usr/bin/env python
"""
Update the database with optimized demo data and test the scheduler.
"""

from src.backend.api.demo_data import (
    generate_improved_employee_data,
    generate_improved_coverage_data,
    generate_improved_shift_templates,
    generate_improved_availability_data,
)
from src.backend.app import create_app
from src.backend.models import db, Schedule

# Create app and set up context
app = create_app()
with app.app_context():
    # Clear existing schedules
    Schedule.query.delete()
    db.session.commit()
    print("Cleared existing schedules")

    # Generate data
    print("Generating optimized shift templates...")
    shift_templates = generate_improved_shift_templates()

    print("Generating optimized employee data...")
    employees = generate_improved_employee_data()

    print("Generating optimized coverage data...")
    coverage_slots = generate_improved_coverage_data()

    print("Generating optimized availability data...")
    availabilities = generate_improved_availability_data(employees)

    print("Data generation complete. You can now test the scheduler.")
