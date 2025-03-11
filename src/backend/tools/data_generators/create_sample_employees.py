#!/usr/bin/env python
"""
Script to create sample employees in the database.
"""

from src.backend.app import create_app
from models import Employee, db
from models.employee import EmployeeGroup


def create_sample_employees():
    """Create sample employees"""
    app = create_app()
    with app.app_context():
        # Check if any employees already exist
        existing = Employee.query.count()
        if existing > 0:
            print(f"Found {existing} existing employees.")
            confirm = input("Do you want to add more sample employees? (y/N): ")
            if confirm.lower() != "y":
                print("Operation cancelled.")
                return

        # Define sample employees
        sample_employees = [
            {
                "first_name": "Maria",
                "last_name": "Schmidt",
                "group": EmployeeGroup.TL,
                "email": "maria.schmidt@example.com",
                "phone": "012345678901",
                "hours_per_week": 38.5,
                "is_keyholder": True,
                "is_active": True,
            },
            {
                "first_name": "Thomas",
                "last_name": "Meyer",
                "group": EmployeeGroup.VZ,
                "email": "thomas.meyer@example.com",
                "phone": "012345678902",
                "hours_per_week": 38.5,
                "is_keyholder": True,
                "is_active": True,
            },
            {
                "first_name": "Anna",
                "last_name": "Müller",
                "group": EmployeeGroup.TZ,
                "email": "anna.mueller@example.com",
                "phone": "012345678903",
                "hours_per_week": 25.0,
                "is_keyholder": False,
                "is_active": True,
            },
            {
                "first_name": "Michael",
                "last_name": "Klein",
                "group": EmployeeGroup.TZ,
                "email": "michael.klein@example.com",
                "phone": "012345678904",
                "hours_per_week": 20.0,
                "is_keyholder": False,
                "is_active": True,
            },
            {
                "first_name": "Laura",
                "last_name": "Weber",
                "group": EmployeeGroup.GFB,
                "email": "laura.weber@example.com",
                "phone": "012345678905",
                "hours_per_week": 12.0,
                "is_keyholder": False,
                "is_active": True,
            },
        ]

        # Create employees
        created = 0
        for employee_data in sample_employees:
            # Create new employee
            employee = Employee(
                first_name=employee_data["first_name"],
                last_name=employee_data["last_name"],
                group=employee_data["group"],
                email=employee_data["email"],
                phone=employee_data["phone"],
                hours_per_week=employee_data["hours_per_week"],
                is_keyholder=employee_data["is_keyholder"],
                is_active=employee_data["is_active"],
            )

            # Add to session
            db.session.add(employee)
            created += 1
            print(
                f"Added employee: {employee.first_name} {employee.last_name} ({employee.group.name})"
            )

        # Commit changes
        db.session.commit()
        print(f"Successfully created {created} sample employees.")


if __name__ == "__main__":
    create_sample_employees()
