from flask import Blueprint, jsonify, request
from models import db, Settings, Employee, Shift, Coverage, EmployeeAvailability
from models.employee import AvailabilityType
from http import HTTPStatus
from datetime import datetime
import random
import logging

bp = Blueprint("demo_data", __name__, url_prefix="/api/demo_data")


def generate_employee_types():
    """Generate demo employee types"""
    return [
        {
            "id": "VZ",
            "name": "Vollzeit",
            "min_hours": 35,
            "max_hours": 40,
            "type": "employee",
        },
        {
            "id": "TZ",
            "name": "Teilzeit",
            "min_hours": 15,
            "max_hours": 34,
            "type": "employee",
        },
        {
            "id": "GFB",
            "name": "Geringfügig Beschäftigt",
            "min_hours": 0,
            "max_hours": 14,
            "type": "employee",
        },
        {
            "id": "TL",
            "name": "Teamleiter",
            "min_hours": 35,
            "max_hours": 40,
            "type": "employee",
        },
    ]


def generate_absence_types():
    """Generate demo absence types"""
    return [
        {"id": "URL", "name": "Urlaub", "color": "#FF9800", "type": "absence"},
        {"id": "ABW", "name": "Abwesend", "color": "#F44336", "type": "absence"},
        {"id": "SLG", "name": "Schulung", "color": "#4CAF50", "type": "absence"},
    ]


def generate_availability_types():
    """Generate demo availability types"""
    return [
        {
            "id": "AVL",
            "name": "Available",
            "color": "#22c55e",
            "description": "Employee is available for work",
            "type": "availability",
        },
        {
            "id": "FIX",
            "name": "Fixed",
            "color": "#3b82f6",
            "description": "Fixed/regular schedule",
            "type": "availability",
        },
        {
            "id": "PRM",
            "name": "Promised",
            "color": "#f59e0b",
            "description": "Promised/preferred hours",
            "type": "availability",
        },
        {
            "id": "UNV",
            "name": "Unavailable",
            "color": "#ef4444",
            "description": "Not available for work",
            "type": "availability",
        },
    ]


def generate_employee_data():
    """Generate demo employee data"""
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
        db.session.commit()

    # Clear all existing employees first
    Employee.query.delete()
    db.session.commit()

    employee_types = [
        {"id": "VZ", "name": "Vollzeit", "min_hours": 35, "max_hours": 40},
        {"id": "TZ", "name": "Teilzeit", "min_hours": 15, "max_hours": 34},
        {
            "id": "GFB",
            "name": "Geringfügig Beschäftigt",
            "min_hours": 0,
            "max_hours": 10,
        },
        {"id": "TL", "name": "Teamleiter", "min_hours": 35, "max_hours": 40},
    ]

    first_names = [
        "Anna",
        "Max",
        "Sophie",
        "Liam",
        "Emma",
        "Noah",
        "Mia",
        "Lucas",
        "Maike",
        "Tim",
        "Laura",
        "Jan",
        "Julia",
        "David",
        "Nina",
        "Thomas",
        "Laura",
        "Jan",
        "Lisa",
        "Michael",
    ]
    last_names = [
        "Müller",
        "Schmidt",
        "Weber",
        "Wagner",
        "Fischer",
        "Becker",
        "Maier",
        "Hoffmann",
        "Schneider",
        "Meyer",
        "Lang",
        "Klein",
        "Schulz",
        "Kowalski",
        "Schmidt",
        "Weber",
        "Wagner",
        "Fischer",
    ]

    employees = []
    for i in range(20):
        emp_type = random.choice(employee_types)
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        # Generate employee_id based on name (first letter of first name + first two letters of last name)
        base_id = f"{first_name[0]}{last_name[:2]}".upper()
        # Add a number if the ID already exists
        counter = 1
        employee_id = base_id
        while any(e.employee_id == employee_id for e in employees):
            employee_id = f"{base_id}{counter:02d}"
            counter += 1

        # Set contracted hours within valid range for employee type
        if emp_type["id"] in ["VZ", "TL"]:
            contracted_hours = 40.0  # Standard full-time hours
        elif emp_type["id"] == "TZ":
            contracted_hours = random.randint(15, 34)  # Part-time range
        else:  # GFB
            contracted_hours = random.randint(5, 10)  # Mini-job range

        employee = Employee(
            employee_id=employee_id,
            first_name=first_name,
            last_name=last_name,
            employee_group=emp_type["id"],
            contracted_hours=contracted_hours,
            is_keyholder=i < 3,  # First 3 employees are keyholders
            is_active=True,
            email=f"employee{i + 1}@example.com",
            phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}",
        )
        employees.append(employee)

    return employees


def generate_shift_data():
    """Generate demo shift data"""
    shifts = [
        Shift(
            start_time="09:00",
            end_time="14:00",
            min_employees=1,
            max_employees=2,
            requires_break=False,
            active_days=[1, 2, 3, 4, 5, 6],  # Monday to Saturday
        ),
        Shift(
            start_time="14:00",
            end_time="20:00",
            min_employees=1,
            max_employees=2,
            requires_break=True,
            active_days=[1, 2, 3, 4, 5, 6],  # Monday to Saturday
        ),
    ]
    return shifts


def generate_coverage_data():
    """Generate demo coverage data"""
    # Clear existing coverage data first
    Coverage.query.delete()
    db.session.commit()

    # Get store settings
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()

    # Calculate times based on store settings
    store_opening = settings.store_opening
    store_closing = settings.store_closing

    coverage_slots = []
    for day_index in range(1, 7):  # Monday to Saturday
        # Morning slot
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time=store_opening,
                end_time="14:00",
                min_employees=1,
                max_employees=2,
                employee_types=["TL", "VZ", "TZ", "GFB"],
                requires_keyholder=True,
                keyholder_before_minutes=settings.keyholder_before_minutes,
                keyholder_after_minutes=0,
            )
        )
        # Afternoon slot
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="14:00",
                end_time=store_closing,
                min_employees=1,
                max_employees=2,
                employee_types=["TL", "VZ", "TZ", "GFB"],
                requires_keyholder=True,
                keyholder_before_minutes=0,
                keyholder_after_minutes=settings.keyholder_after_minutes,
            )
        )

    db.session.bulk_save_objects(coverage_slots)
    db.session.commit()

    return coverage_slots


def generate_availability_data(employees):
    """Generate demo availability data with continuous blocks without gaps"""
    availabilities = []

    # Randomly select 30% of employees to have random availability patterns
    random_pattern_employees = set(
        random.sample(employees, k=max(1, len(employees) // 3))
    )

    # Select some full-time employees (VZ and TL) to have fixed schedules
    fixed_schedule_employees = set(
        employee
        for employee in employees
        if employee.employee_group in ["VZ", "TL"]
        and employee not in random_pattern_employees
        and random.random()
        < 0.4  # 40% of remaining full-time employees get fixed schedules
    )

    for employee in employees:
        # Generate recurring availability for each employee
        for day_of_week in range(7):  # 0-6 (Sunday-Saturday)
            if day_of_week != 0:  # Skip Sunday
                # Determine the daily schedule pattern
                if employee in fixed_schedule_employees:
                    # Fixed schedule employees have set blocks
                    if employee.employee_group == "TL":
                        # Team leaders work one solid block morning to mid-afternoon
                        blocks = [(8, 16, AvailabilityType.FIXED)]
                    else:  # VZ with fixed schedule
                        # Alternate between morning and afternoon blocks
                        if day_of_week % 2 == 0:
                            blocks = [(9, 15, AvailabilityType.FIXED)]  # Morning block
                        else:
                            blocks = [
                                (14, 20, AvailabilityType.FIXED)
                            ]  # Afternoon block

                elif employee in random_pattern_employees:
                    # Create 2-3 continuous blocks with different types, NO GAPS
                    blocks = []
                    if random.random() < 0.7:  # 70% chance of starting in the morning
                        current_hour = 9
                    else:
                        current_hour = 14  # Start in the afternoon

                    end_hour = 20  # Latest possible end time

                    while current_hour < end_hour:
                        # Determine block length - between 2 and 4 hours, but must reach end_hour
                        remaining_hours = end_hour - current_hour
                        if remaining_hours <= 4:
                            block_length = remaining_hours
                        else:
                            block_length = random.randint(2, min(4, remaining_hours))

                        block_end = current_hour + block_length
                        # Assign type - higher chance of AVAILABLE, lower chance of PROMISE
                        block_type = (
                            AvailabilityType.PROMISE
                            if random.random() < 0.3
                            else AvailabilityType.AVAILABLE
                        )
                        blocks.append((current_hour, block_end, block_type))
                        current_hour = block_end

                else:
                    # Regular employees get one continuous block
                    if random.random() < 0.6:  # 60% chance of full day
                        blocks = [(9, 20, AvailabilityType.AVAILABLE)]
                    else:  # Morning or afternoon block, but not both
                        if random.random() < 0.5:
                            blocks = [(9, 14, AvailabilityType.AVAILABLE)]  # Morning
                        else:
                            blocks = [(14, 20, AvailabilityType.AVAILABLE)]  # Afternoon

                # Create availability records for each block
                for start_hour, end_hour, availability_type in blocks:
                    for hour in range(start_hour, end_hour):
                        availability = EmployeeAvailability(
                            employee_id=employee.id,
                            is_recurring=True,
                            day_of_week=day_of_week,
                            hour=hour,
                            is_available=True,
                            availability_type=availability_type,
                        )
                        availabilities.append(availability)

    return availabilities


@bp.route("/", methods=["POST"])
def generate_demo_data():
    """Generate demo data based on selected module"""
    data = request.get_json()
    module = data.get("module", "all")

    try:
        # First, ensure we have a settings record
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()

        # Update employee types and absence types
        if module in ["settings", "all"]:
            logging.info("Generating demo settings...")
            settings.employee_types = generate_employee_types()
            settings.absence_types = generate_absence_types()
            try:
                db.session.commit()
                logging.info("Successfully updated employee and absence types")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error updating settings: {str(e)}")
                raise

        # Clean up all availabilities first
        if module in ["availability", "employees", "all"]:
            logging.info("Cleaning up existing availabilities...")
            try:
                EmployeeAvailability.query.delete()
                db.session.commit()
                logging.info("Successfully cleaned up existing availabilities")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error cleaning up availabilities: {str(e)}")
                raise

        if module in ["employees", "all"]:
            # Clear existing employees
            logging.info("Generating demo employees...")
            Employee.query.delete()
            employees = generate_employee_data()
            db.session.add_all(employees)
            try:
                db.session.commit()
                logging.info(f"Successfully created {len(employees)} employees")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error creating employees: {str(e)}")
                raise

            if module == "all":
                # Generate availability for new employees
                logging.info("Generating demo availabilities...")
                availabilities = generate_availability_data(employees)
                db.session.add_all(availabilities)
                try:
                    db.session.commit()
                    logging.info(
                        f"Successfully created {len(availabilities)} availabilities"
                    )
                except Exception as e:
                    db.session.rollback()
                    logging.error(f"Error creating availabilities: {str(e)}")
                    raise

                # Generate coverage data
                logging.info("Generating demo coverage...")
                coverage_slots = generate_coverage_data()
                db.session.add_all(coverage_slots)
                try:
                    db.session.commit()
                    logging.info(
                        f"Successfully created {len(coverage_slots)} coverage slots"
                    )
                except Exception as e:
                    db.session.rollback()
                    logging.error(f"Error creating coverage slots: {str(e)}")
                    raise

        elif module == "availability":
            # Generate new availabilities for existing employees
            logging.info("Generating demo availabilities for existing employees...")
            employees = Employee.query.all()
            availabilities = generate_availability_data(employees)
            db.session.add_all(availabilities)
            try:
                db.session.commit()
                logging.info(
                    f"Successfully created {len(availabilities)} availabilities"
                )
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error creating availabilities: {str(e)}")
                raise

        # Update settings to record the execution
        settings = Settings.query.first()
        if settings:
            settings.actions_demo_data = {
                "selected_module": module,
                "last_execution": datetime.utcnow().isoformat(),
            }
            try:
                db.session.commit()
                logging.info("Successfully updated settings")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error updating settings: {str(e)}")
                raise

        return jsonify(
            {
                "message": f"Successfully generated demo data for module: {module}",
                "timestamp": datetime.utcnow().isoformat(),
            }
        ), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to generate demo data: {str(e)}")
        return jsonify(
            {"error": "Failed to generate demo data", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
