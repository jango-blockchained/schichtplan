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
            min_employees=shift_data["min_employees"],
            max_employees=shift_data["max_employees"],
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

        # Add weekday availabilities
        for day in range(1, 6):  # Monday to Friday
            for hour in group_avail["weekdays"]["hours"]:
                availability = EmployeeAvailability(
                    employee_id=employee.id,
                    day_of_week=day,
                    hour=hour,
                    is_available=True,
                    availability_type=AvailabilityType[group_avail["weekdays"]["type"]],
                )
                db.session.add(availability)

        # Add Saturday availabilities
        for hour in group_avail["saturday"]["hours"]:
            availability = EmployeeAvailability(
                employee_id=employee.id,
                day_of_week=6,
                hour=hour,
                is_available=True,
                availability_type=AvailabilityType[group_avail["saturday"]["type"]],
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
