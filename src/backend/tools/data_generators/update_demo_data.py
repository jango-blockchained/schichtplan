#!/usr/bin/env python
"""
Seed the database with realistic sample data for development and testing.

This script clears existing data (optional) and populates core entities.
"""

import argparse
import logging

from src.backend.app import create_app
from src.backend.models import (
    db,
    Settings,
    Employee,
    EmployeeAvailability,
    EmployeeGroup,
    Coverage,
    ShiftTemplate,
    Schedule,
    Absence,
    User,
    UserRole,
)

# Import generation functions from demo_data API (or replicate/adapt them here)
# For simplicity in this step, we'll assume these functions from demo_data.py are accessible
# and can be called. In a real scenario, they might be refactored into a shared library.
from src.backend.api.demo_data import (
    generate_employee_types as get_default_employee_types,
    generate_absence_types as get_default_absence_types,
    # We will define our own shift type generation for settings for more control
    generate_improved_employee_data,
    generate_granular_coverage_data,
    generate_optimized_shift_templates,
    generate_improved_availability_data,
    generate_improved_absences,
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# --- Configuration for Seed Data ---
NUM_DEFAULT_EMPLOYEES = 25
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "admin"
DEFAULT_ADMIN_EMAIL = "admin@example.com"

# --- Helper Functions ---


def clear_all_data():
    logger.info("Clearing existing data...")
    # Order matters due to foreign key constraints
    Schedule.query.delete()
    Absence.query.delete()
    EmployeeAvailability.query.delete()
    User.query.filter(User.username != DEFAULT_ADMIN_USERNAME).delete()  # Keep admin
    Employee.query.delete()
    ShiftTemplate.query.delete()
    Coverage.query.delete()
    # Settings are usually kept or reset to default, not fully deleted
    # db.session.query(Settings).delete()
    db.session.commit()
    logger.info("Existing data cleared (except admin user and settings).")


def seed_settings():
    logger.info("Seeding Settings...")
    settings = Settings.query.first()
    if not settings:
        logger.info("No existing settings found, creating default settings.")
        settings = Settings.get_default_settings()
        db.session.add(settings)
    else:
        logger.info("Existing settings found, ensuring defaults for lists.")

    # Ensure JSON fields for types are populated if empty or missing
    if not settings.employee_types:
        settings.employee_types = get_default_employee_types()
        logger.info("Populated default employee types in settings.")

    if not settings.absence_types:
        settings.absence_types = get_default_absence_types()
        logger.info("Populated default absence types in settings.")

    # Define and populate shift_types in settings
    # This gives more control than importing a generic generator
    default_shift_types_for_settings = [
        {
            "id": "EARLY",
            "name": "Early Shift",
            "color": "#4CAF50",
            "type": "shift_type",
            "auto_assign_only": False,
        },
        {
            "id": "MIDDLE",
            "name": "Middle Shift",
            "color": "#2196F3",
            "type": "shift_type",
            "auto_assign_only": False,
        },
        {
            "id": "LATE",
            "name": "Late Shift",
            "color": "#9C27B0",
            "type": "shift_type",
            "auto_assign_only": False,
        },
        {
            "id": "TRAINING",
            "name": "Training Shift",
            "color": "#FFC107",
            "type": "shift_type",
            "auto_assign_only": True,
        },
        {
            "id": "OFFICE",
            "name": "Office Duty",
            "color": "#795548",
            "type": "shift_type",
            "auto_assign_only": True,
        },
    ]
    if not settings.shift_types:
        settings.shift_types = default_shift_types_for_settings
        logger.info("Populated default shift types in settings.")

    # Ensure availability_types are populated (using the model's default if necessary)
    if not settings.availability_types or not settings.availability_types.get("types"):
        # Replicate structure from Settings model default
        settings.availability_types = {
            "types": [
                {
                    "id": "AVAILABLE",
                    "name": "Available",
                    "description": "Available for work",
                    "color": "#22c55e",
                    "priority": 2,
                    "is_available": True,
                },
                {
                    "id": "FIXED",
                    "name": "Fixed",
                    "description": "Fixed working hours",
                    "color": "#3b82f6",
                    "priority": 1,
                    "is_available": True,
                },
                {
                    "id": "PREFERRED",
                    "name": "Preferred",
                    "description": "Preferred hours",
                    "color": "#f59e0b",
                    "priority": 3,
                    "is_available": True,
                },
                {
                    "id": "UNAVAILABLE",
                    "name": "Unavailable",
                    "description": "Not available for work",
                    "color": "#ef4444",
                    "priority": 4,
                    "is_available": False,
                },
            ]
        }
        logger.info("Populated default availability types in settings.")

    db.session.commit()
    logger.info("Settings seeded/updated.")
    return settings


def seed_employees(num_employees: int):
    logger.info(f"Seeding {num_employees} Employees...")
    # This function from demo_data.py already clears existing employees.
    # We might want to modify it or wrap it if we want finer control (e.g. not clearing if not desired)
    employees = generate_improved_employee_data(num_employees_override=num_employees)
    db.session.add_all(employees)
    db.session.commit()  # Commit here so User can link to existing employee
    logger.info(f"{len(employees)} Employees seeded.")
    return employees


def seed_admin_user(employees):
    logger.info("Seeding Admin User...")
    admin_user = User.query.filter_by(username=DEFAULT_ADMIN_USERNAME).first()
    if not admin_user:
        admin_employee = next(
            (emp for emp in employees if emp.employee_group == EmployeeGroup.TL), None
        )
        if not admin_employee and employees:
            admin_employee = employees[0]  # Assign to the first employee if no TL

        admin_user = User(
            username=DEFAULT_ADMIN_USERNAME,
            email=DEFAULT_ADMIN_EMAIL,
            password=DEFAULT_ADMIN_PASSWORD,
            role=UserRole.ADMIN,
            employee_id=admin_employee.id if admin_employee else None,
            is_active=True,
        )
        db.session.add(admin_user)
        db.session.commit()
        logger.info(f"Admin user '{DEFAULT_ADMIN_USERNAME}' created.")
    else:
        logger.info(f"Admin user '{DEFAULT_ADMIN_USERNAME}' already exists.")
    return admin_user


def seed_shift_templates():
    logger.info("Seeding Shift Templates...")
    # This function from demo_data.py clears existing shift templates.
    shift_templates = (
        generate_optimized_shift_templates()
    )  # Uses ShiftTemplateShiftTypeEnum
    # db.session.add_all(shift_templates) # generate_optimized_shift_templates already adds and commits
    logger.info(f"{len(shift_templates)} Shift Templates seeded.")
    return shift_templates


def seed_coverage():
    logger.info("Seeding Coverage Rules...")
    Coverage.query.delete()  # Clear existing coverage before adding new ones
    db.session.commit()
    coverage_slots = generate_granular_coverage_data()
    db.session.add_all(coverage_slots)
    db.session.commit()
    logger.info(f"{len(coverage_slots)} Coverage Rules seeded.")
    return coverage_slots


def seed_availability(employees):
    logger.info("Seeding Employee Availability...")
    # This function from demo_data.py does not clear existing availabilities.
    EmployeeAvailability.query.delete()  # Clear them first
    db.session.commit()
    availabilities, _, _ = generate_improved_availability_data(employees)
    db.session.add_all(availabilities)
    db.session.commit()
    logger.info(f"{len(availabilities)} Employee Availability records seeded.")
    return availabilities


def seed_absences(employees):
    logger.info("Seeding Absences...")
    # This function from demo_data.py does not clear existing absences.
    Absence.query.delete()  # Clear them first
    db.session.commit()
    absences = generate_improved_absences(employees)
    db.session.add_all(absences)
    db.session.commit()
    logger.info(f"{len(absences)} Absences seeded.")
    return absences


# --- Main Seeding Logic ---


def main(args):
    app = create_app()
    with app.app_context():
        if args.clear:
            clear_all_data()

        settings = seed_settings()
        employees = seed_employees(args.num_employees)

        if not employees:
            logger.error(
                "No employees were created, cannot seed admin user or related data."
            )
            return

        admin_user = seed_admin_user(employees)
        seed_shift_templates()
        seed_coverage()
        seed_availability(employees)
        seed_absences(employees)

        logger.info("Database seeding complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the database with sample data.")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing data (except admin user and settings) before seeding.",
    )
    parser.add_argument(
        "--num-employees",
        type=int,
        default=NUM_DEFAULT_EMPLOYEES,
        help=f"Number of employees to generate (default: {NUM_DEFAULT_EMPLOYEES})",
    )
    script_args = parser.parse_args()
    main(script_args)
