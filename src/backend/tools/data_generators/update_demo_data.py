#!/usr/bin/env python
"""
Update the database with optimized demo data and test the scheduler.
"""

from src.backend.api.demo_data import (
    generate_improved_employee_data,
    generate_improved_coverage_data,
    generate_improved_shift_templates,
    generate_improved_availability_data,
    generate_improved_absences,
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
    db.session.add_all(shift_templates)

    print("Generating optimized employee data...")
    employees = generate_improved_employee_data()
    db.session.add_all(employees)

    print("Generating optimized coverage data...")
    coverage_slots = generate_improved_coverage_data()
    db.session.add_all(coverage_slots)

    print("Generating optimized availability data...")
    availabilities, _, _ = generate_improved_availability_data(employees)
    db.session.add_all(availabilities)

    print("Generating optimized absence data...")
    absences = generate_improved_absences(employees)
    db.session.add_all(absences)
    
    try:
        db.session.commit()
        print("Successfully committed all generated data to the database.")
    except Exception as e:
        db.session.rollback()
        print(f"Error committing data to the database: {e}")
        raise

    print("Data generation complete. You can now test the scheduler.")
