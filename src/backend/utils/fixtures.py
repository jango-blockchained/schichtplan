import json
from pathlib import Path
from typing import Dict, Any
from models import db, Settings, Employee, ShiftTemplate, EmployeeAvailability
from models.employee import EmployeeGroup, AvailabilityType


def load_json_fixture(filename: str) -> Dict[str, Any]:
    """Load a JSON fixture file"""
    fixture_path = Path(__file__).parent.parent / "fixtures" / filename
    with open(fixture_path, "r") as f:
        return json.load(f)


def load_settings():
    """Load settings from fixture"""
    data = load_json_fixture("settings.json")
    settings = Settings.query.first()
    if not settings:
        settings = Settings()
        db.session.add(settings)
    settings.update_from_dict(data)
    db.session.commit()


def load_employees():
    """Load employees and related data from fixture"""
    data = load_json_fixture("employees.json")

    # First, clear existing data
    Employee.query.delete()
    db.session.commit()

    # Create employees
    for emp_data in data["employees"]:
        employee = Employee(
            employee_id=emp_data["employee_id"],
            first_name=emp_data["first_name"],
            last_name=emp_data["last_name"],
            employee_group=EmployeeGroup[emp_data["employee_group"]],
            contracted_hours=emp_data["contracted_hours"],
            is_keyholder=emp_data["is_keyholder"],
            is_active=emp_data["is_active"],
            email=emp_data["email"],
            phone=emp_data.get("phone"),
        )
        db.session.add(employee)

    db.session.commit()


def load_shifts():
    """Load shifts from fixture"""
    data = load_json_fixture("shifts.json")

    # First, clear existing data
    ShiftTemplate.query.delete()
    db.session.commit()

    # Create shifts
    for shift_data in data["shifts"]:
        shift = ShiftTemplate(
            start_time=shift_data["start_time"],
            end_time=shift_data["end_time"],
            requires_break=shift_data["requires_break"],
        )
        db.session.add(shift)

    db.session.commit()


def load_availabilities():
    """Load default availabilities from fixture"""
    data = load_json_fixture("availabilities.json")

    # First, clear existing data
    EmployeeAvailability.query.delete()
    db.session.commit()

    # Create availabilities for each employee based on their group
    for employee in Employee.query.all():
        group_key = {
            EmployeeGroup.VZ: "VZ",
            EmployeeGroup.TZ: "TZ",
            EmployeeGroup.GFB: "GfB",
            EmployeeGroup.TL: "team_leader",
        }[employee.employee_group]

        group_avail = data["availabilities"][group_key]

        # Map fixture availability types to AvailabilityType enum
        availability_type_map = {
            "REGULAR": AvailabilityType.AVAILABLE,
            "FIXED": AvailabilityType.FIXED,
            "PREFERRED": AvailabilityType.PREFERRED,
            "UNAVAILABLE": AvailabilityType.UNAVAILABLE,
        }

        # Add weekday availabilities (Monday to Friday)
        for day in range(1, 6):
            # Get the full range of hours from the fixture
            hours = group_avail["weekdays"]["hours"]

            # Ensure we have coverage for both shift templates (13:00-18:00 and 15:00-20:00)
            required_hours = list(range(13, 21))  # 13:00 to 20:00

            # Add availability records for all hours that are both in the fixture and required
            for hour in set(hours) & set(required_hours):
                availability = EmployeeAvailability(
                    employee_id=employee.id,
                    day_of_week=day,
                    hour=hour,
                    is_available=True,
                    availability_type=availability_type_map[
                        group_avail["weekdays"]["type"]
                    ],
                )
                db.session.add(availability)

        # Add Saturday availabilities
        hours = group_avail["saturday"]["hours"]
        required_hours = list(range(13, 21))  # 13:00 to 20:00

        for hour in set(hours) & set(required_hours):
            availability = EmployeeAvailability(
                employee_id=employee.id,
                day_of_week=6,
                hour=hour,
                is_available=True,
                availability_type=availability_type_map[
                    group_avail["saturday"]["type"]
                ],
            )
            db.session.add(availability)

    db.session.commit()


def load_all_fixtures():
    """Load all fixtures in the correct order"""
    load_settings()
    load_employees()
    load_shifts()
    load_availabilities()
    print("All fixtures loaded successfully!")
