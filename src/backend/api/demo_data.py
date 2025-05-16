from flask import Blueprint, jsonify, request
from src.backend.models import (
    db,
    Settings,
    Employee,
    Coverage,
    EmployeeAvailability,
    ShiftTemplate,
    Absence,
)
from src.backend.models.employee import AvailabilityType, EmployeeGroup
from src.backend.models.fixed_shift import ShiftType
from http import HTTPStatus
from datetime import datetime, date, timedelta
import random
import logging
import math

bp = Blueprint("demo_data", __name__, url_prefix="/demo-data")


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
            "id": "AVAILABLE",
            "name": "Available",
            "color": "#22c55e",
            "description": "Employee is available for work",
            "type": "availability",
        },
        {
            "id": "FIXED",
            "name": "Fixed",
            "color": "#3b82f6",
            "description": "Fixed/regular schedule",
            "type": "availability",
        },
        {
            "id": "PREFERRED",
            "name": "Preferred",
            "color": "#f59e0b",
            "description": "Preferred hours",
            "type": "availability",
        },
        {
            "id": "UNAVAILABLE",
            "name": "Unavailable",
            "color": "#ef4444",
            "description": "Not available for work",
            "type": "availability",
        },
    ]


def generate_employee_data(num_employees: int = 30):
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
    for i in range(num_employees):
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
            logging.info(
                f"VZ/TL employee: {first_name} {last_name}, contracted_hours: {contracted_hours}"
            )
        elif emp_type["id"] == "TZ":
            contracted_hours = random.randint(20, 34)  # Part-time range
            logging.info(
                f"TZ employee: {first_name} {last_name}, contracted_hours: {contracted_hours}"
            )
        else:  # GFB
            contracted_hours = random.randint(
                5, 10
            )
            logging.info(
                f"GFB employee: {first_name} {last_name}, contracted_hours: {contracted_hours}"
            )

        employee = Employee(
            employee_id=employee_id,
            first_name=first_name,
            last_name=last_name,
            employee_group=emp_type["id"],
            contracted_hours=contracted_hours,
            is_keyholder=i < 3,
            is_active=True,
            email=f"employee{i + 1}@example.com",
            phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}",
        )
        employees.append(employee)

    return employees


def generate_coverage_data():
    """Generate demo coverage data"""
    # Get store settings
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()

    coverage_slots = []
    for day_index in range(0, 6):  # Monday (0) to Saturday (5)
        # Early afternoon slot
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="09:00",
                end_time="14:00",
                min_employees=1,
                max_employees=2,
                employee_types=["TL", "VZ", "TZ", "GFB"],
                requires_keyholder=True,
                keyholder_before_minutes=settings.keyholder_before_minutes,
                keyholder_after_minutes=0,
            )
        )
        # Late afternoon slot
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="14:00",
                end_time="20:00",
                min_employees=1,
                max_employees=2,
                employee_types=["TL", "VZ", "TZ", "GFB"],
                requires_keyholder=True,
                keyholder_before_minutes=0,
                keyholder_after_minutes=settings.keyholder_after_minutes,
            )
        )

    return coverage_slots


def calculate_weekly_availability_hours(blocks, days_available):
    """Calculate total weekly availability hours from blocks"""
    total_hours = 0
    for start_hour, end_hour, _ in blocks:
        total_hours += (end_hour - start_hour) * days_available
    return total_hours


def validate_availability_vs_contracted(employee, blocks, days_available):
    """Validate that availability hours are sufficient for contracted hours"""
    weekly_availability = calculate_weekly_availability_hours(blocks, days_available)
    # Add 20% buffer to contracted hours to ensure enough availability
    min_required_hours = employee.contracted_hours * 1.2

    logging.info(
        f"Employee {employee.employee_id}: "
        f"Contracted={employee.contracted_hours:.1f}h/week, "
        f"Available={weekly_availability:.1f}h/week"
    )

    return weekly_availability >= min_required_hours


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
        and random.random() < 0.4
    )

    for employee in employees:
        valid_blocks = False
        while not valid_blocks:
            temp_availabilities = []
            blocks = []
            days_available = 0

            # Generate recurring availability for each employee
            for day_of_week in range(7):  # 0-6 (Sunday-Saturday)
                if day_of_week != 0:  # Skip Sunday
                    days_available += 1
                    # Determine the daily schedule pattern
                    if employee in fixed_schedule_employees:
                        # Fixed schedule employees have set blocks
                        if employee.employee_group == "TL":
                            # Team leaders work one solid block morning to mid-afternoon
                            blocks = [(8, 16, AvailabilityType.FIXED)]
                        else:  # VZ with fixed schedule
                            # Alternate between morning and afternoon blocks
                            if day_of_week % 2 == 0:
                                blocks = [
                                    (9, 15, AvailabilityType.FIXED)
                                ]  # Morning block
                            else:
                                blocks = [
                                    (14, 20, AvailabilityType.FIXED)
                                ]  # Afternoon block

                    elif employee in random_pattern_employees:
                        # Create 2-3 continuous blocks with different types, NO GAPS
                        blocks = []
                        if (
                            random.random() < 0.7
                        ):  # 70% chance of starting in the morning
                            current_hour = 9
                        else:
                            current_hour = 14  # Start in the afternoon

                        end_hour = 20  # Latest possible end time

                        while current_hour < end_hour:
                            remaining_hours = end_hour - current_hour
                            if remaining_hours <= 4:
                                block_length = remaining_hours
                            else:
                                block_length = random.randint(
                                    2, min(4, remaining_hours)
                                )

                            block_end = current_hour + block_length
                            block_type = (
                                AvailabilityType.PREFERRED
                                if random.random() < 0.3
                                else AvailabilityType.AVAILABLE
                            )
                            blocks.append((current_hour, block_end, block_type))
                            current_hour = block_end

                    else:
                        # Regular employees get one continuous block
                        if (
                            random.random() < 0.8
                        ):  # Increased chance of full day for sufficient hours
                            blocks = [(9, 20, AvailabilityType.AVAILABLE)]
                        else:  # Morning or afternoon block, but not both
                            if random.random() < 0.5:
                                blocks = [
                                    (9, 15, AvailabilityType.AVAILABLE)
                                ]  # Extended morning
                            else:
                                blocks = [
                                    (14, 20, AvailabilityType.AVAILABLE)
                                ]  # Afternoon

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
                            temp_availabilities.append(availability)

            # Validate that the generated availability is sufficient
            if validate_availability_vs_contracted(employee, blocks, days_available):
                valid_blocks = True
                availabilities.extend(temp_availabilities)
            else:
                logging.warning(
                    f"Regenerating availability for {employee.employee_id} - "
                    f"insufficient hours"
                )

    return availabilities


def generate_shift_templates():
    """Generate demo shift templates"""
    logging.info("Generating shift templates...")

    # Delete existing shift templates
    ShiftTemplate.query.delete()
    db.session.commit()

    shift_templates = [
        # Full-time shifts (8 hours)
        ShiftTemplate(
            start_time="08:00",
            end_time="16:00",
            requires_break=True,
            shift_type=ShiftType.EARLY,
        ),
        ShiftTemplate(
            start_time="09:00",
            end_time="17:00",
            requires_break=True,
            shift_type=ShiftType.MIDDLE,
        ),
        ShiftTemplate(
            start_time="10:00",
            end_time="18:00",
            requires_break=True,
            shift_type=ShiftType.MIDDLE,
        ),
        ShiftTemplate(
            start_time="11:00",
            end_time="19:00",
            requires_break=True,
            shift_type=ShiftType.LATE,
        ),
        ShiftTemplate(
            start_time="12:00",
            end_time="20:00",
            requires_break=True,
            shift_type=ShiftType.LATE,
        ),
        # Part-time shifts (4-6 hours)
        ShiftTemplate(
            start_time="08:00",
            end_time="13:00",
            requires_break=False,
            shift_type=ShiftType.EARLY,
        ),
        ShiftTemplate(
            start_time="13:00",
            end_time="18:00",
            requires_break=False,
            shift_type=ShiftType.MIDDLE,
        ),
        ShiftTemplate(
            start_time="15:00",
            end_time="20:00",
            requires_break=False,
            shift_type=ShiftType.LATE,
        ),
    ]

    # Calculate durations and validate before adding
    for template in shift_templates:
        template._calculate_duration()
        template.validate()
        db.session.add(template)

    try:
        db.session.commit()
        logging.info(f"Successfully created {len(shift_templates)} shift templates")
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating shift templates: {str(e)}")
        raise

    return shift_templates


@bp.route("/", methods=["POST"])
def generate_demo_data():
    """Generate demo data"""
    try:
        json_data = request.get_json() or {}
        module = json_data.get("module", "all")
        
        num_employees_raw = json_data.get("num_employees")
        num_employees = 30  # Default
        if isinstance(num_employees_raw, int):
            if num_employees_raw > 0:
                num_employees = num_employees_raw
        elif isinstance(num_employees_raw, str):
            if num_employees_raw.isdigit():
                parsed_num = int(num_employees_raw)
                if parsed_num > 0:
                    num_employees = parsed_num

        logging.info(f"Generating demo data for module: {module}, num_employees: {num_employees}")

        if module in ["settings", "all"]:
            logging.info("Generating demo settings...")
            settings = Settings.query.first()
            if not settings:
                settings = Settings.get_default_settings()
            settings.employee_types = generate_employee_types()  # type: ignore[assignment]
            settings.absence_types = generate_absence_types()  # type: ignore[assignment]
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

        if module in ["shifts", "all"]:
            logging.info("Generating shift templates...")
            try:
                shift_templates = generate_shift_templates()
                logging.info(
                    f"Successfully created {len(shift_templates)} shift templates"
                )
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error creating shift templates: {str(e)}")
                raise

        if module in ["employees", "all"]:
            # Clear existing employees
            logging.info("Generating employees...")
            Employee.query.delete()
            employees = generate_employee_data(num_employees=num_employees)
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
                logging.info("Generating availabilities...")
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
                try:
                    # Clear existing coverage data in a transaction
                    logging.info("Clearing existing coverage data...")
                    Coverage.query.delete()
                    db.session.commit()

                    # Generate and save new coverage data in a new transaction
                    logging.info("Generating coverage...")
                    coverage_slots = generate_coverage_data()
                    db.session.add_all(coverage_slots)
                    db.session.commit()
                    logging.info(
                        f"Successfully created {len(coverage_slots)} coverage slots"
                    )
                except Exception as e:
                    db.session.rollback()
                    logging.error(f"Error managing coverage data: {str(e)}")
                    raise

        elif module == "availability":
            # Generate new availabilities for existing employees
            logging.info("Generating availabilities for existing employees...")
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

        elif module == "coverage":
            try:
                # Clear existing coverage data in a transaction
                logging.info("Clearing existing coverage data...")
                Coverage.query.delete()
                db.session.commit()

                # Generate and save new coverage data in a new transaction
                logging.info("Generating coverage...")
                coverage_slots = generate_coverage_data()
                db.session.add_all(coverage_slots)
                db.session.commit()
                logging.info(
                    f"Successfully created {len(coverage_slots)} coverage slots"
                )
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error managing coverage data: {str(e)}")
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


def generate_improved_employee_data(num_employees_override: int | None = None):
    """Generate optimized employee data with keyholders and proper distribution of types"""
    logging.info(f"Starting to generate improved employee data. Override: {num_employees_override}")

    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
        db.session.commit()

    # Clear all existing employees first
    Employee.query.delete()
    db.session.commit()

    # Define employee types with proper distribution with string values
    employee_types = [
        {
            "id": "TL",  # String value for employee group
            "enum": EmployeeGroup.TL,  # Keep enum for reference
            "name": "Teamleiter",
            "min_hours": 35,
            "max_hours": 40,
            "count": 3,
        },
        {
            "id": "VZ",  # String value for employee group
            "enum": EmployeeGroup.VZ,  # Keep enum for reference
            "name": "Vollzeit",
            "min_hours": 35,
            "max_hours": 40,
            "count": 7,
        },
        {
            "id": "TZ",  # String value for employee group
            "enum": EmployeeGroup.TZ,  # Keep enum for reference
            "name": "Teilzeit",
            "min_hours": 10,  # Changed from 15 to 10
            "max_hours": 34,
            "count": 12,
        },
        {
            "id": "GFB",  # String value for employee group
            "enum": EmployeeGroup.GFB,  # Keep enum for reference
            "name": "Geringfügig Beschäftigt",
            "min_hours": 0,
            "max_hours": 10,  # Changed from 14 to 10
            "count": 8,
        },
    ]

    logging.info(
        f"Employee types defined: {[{t['id']: t['name']} for t in employee_types]}"
    )

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
        "Sarah",
        "Felix",
        "Lisa",
        "Michael",
        "Lena",
        "Daniel",
        "Hannah",
        "Paul",
        "Charlotte",
        "Elias",
        "Marie",
        "Leon",
        "Victoria",
        "Ben",
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
        "Huber",
        "Wolf",
        "Peters",
        "Richter",
        "Lehmann",
        "Krause",
        "Schäfer",
        "König",
        "Schwarz",
        "Krüger",
        "Walter",
        "Schmitz",
        "Roth",
        "Lorenz",
        "Bauer",
        "Kaiser",
    ]

    employees = []
    employee_id_counter = 1

    if num_employees_override is not None:
        logging.info(f"Generating specified number of employees: {num_employees_override}")
        for _ in range(num_employees_override):
            emp_type = random.choice(employee_types)
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)

            base_id = f"{first_name[0]}{last_name[:2]}".upper()
            employee_id = f"{base_id}{employee_id_counter:02d}"
            employee_id_counter += 1

            # Contracted hours based on chosen emp_type
            contracted_hours = random.randint(emp_type["min_hours"], emp_type["max_hours"])
            if emp_type["id"] in ["VZ", "TL"] and contracted_hours < 35: # Ensure VZ/TL have at least 35
                contracted_hours = 40.0
            elif emp_type["id"] == "GFB" and contracted_hours > 10: # Cap GFB at 10 (was 14)
                 contracted_hours = 10.0
            elif emp_type["id"] == "TZ" and contracted_hours < 10: # Ensure TZ has at least 10
                 contracted_hours = 10.0

            is_keyholder = emp_type["id"] != "GFB"

            logging.info(
                f"Creating employee (override): {first_name} {last_name}, "
                f"group: {emp_type['id']}, hours: {contracted_hours}, "
                f"keyholder: {is_keyholder}"
            )
            try:
                employee = Employee(
                    employee_id=employee_id,
                    first_name=first_name,
                    last_name=last_name,
                    employee_group=emp_type["id"],
                    contracted_hours=contracted_hours,
                    is_keyholder=is_keyholder,
                    is_active=True,
                    email=f"employee{employee_id_counter}@example.com", # Use unique counter for email
                    phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}",
                )
                employees.append(employee)
            except Exception as e:
                logging.error(f"Error creating employee (override): {e}")
                logging.error(
                    f"Employee details: group={emp_type['id']}, "
                    f"type={type(emp_type['id'])}, hours={contracted_hours}"
                )
                raise
    else:
        # Original logic: Create employees based on the defined distribution in employee_types counts
        for emp_type in employee_types:
            for i in range(emp_type["count"]):
                first_name = random.choice(first_names)
                last_name = random.choice(last_names)

                # Generate employee_id based on name
                base_id = f"{first_name[0]}{last_name[:2]}".upper()
                employee_id = f"{base_id}{employee_id_counter:02d}"
                employee_id_counter += 1

                # Set contracted hours within valid range for employee type
                if emp_type["id"] in ["VZ", "TL"]:
                    contracted_hours = 40.0
                elif emp_type["id"] == "TZ":
                    contracted_hours = random.randint(20, 34)
                else:  # GFB
                    contracted_hours = random.randint(5, 10)

                is_keyholder = emp_type["id"] != "GFB"

                logging.info(
                    f"Creating employee (original dist): {first_name} {last_name}, "
                    f"group: {emp_type['id']}, hours: {contracted_hours}, "
                    f"keyholder: {is_keyholder}"
                )
                try:
                    employee = Employee(
                        employee_id=employee_id,
                        first_name=first_name,
                        last_name=last_name,
                        employee_group=emp_type["id"],
                        contracted_hours=contracted_hours,
                        is_keyholder=is_keyholder,
                        is_active=True,
                        email=f"employee{employee_id_counter}@example.com", # Use unique counter for email
                        phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}",
                    )
                    employees.append(employee)
                except Exception as e:
                    logging.error(f"Error creating employee (original dist): {e}")
                    logging.error(
                        f"Employee details: group={emp_type['id']}, "
                        f"type={type(emp_type['id'])}, hours={contracted_hours}"
                    )
                    raise
    return employees


def generate_improved_coverage_data():
    """Generate optimized coverage data with reasonable staffing requirements"""
    # Get store settings
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()

    coverage_slots = []
    for day_index in range(0, 6):  # Monday (0) to Saturday (5)
        # Morning slot (9:00-14:00)
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="09:00",
                end_time="14:00",
                min_employees=2,  # Increased from 1
                max_employees=4,
                employee_types=["TL", "VZ", "TZ", "GFB"],  # Using string values
                requires_keyholder=True,
                keyholder_before_minutes=settings.keyholder_before_minutes,
                keyholder_after_minutes=0,
            )
        )
        # Afternoon slot (14:00-20:00)
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="14:00",
                end_time="20:00",
                min_employees=2,  # Increased from 1
                max_employees=4,
                employee_types=["TL", "VZ", "TZ", "GFB"],  # Using string values
                requires_keyholder=True,
                keyholder_before_minutes=0,
                keyholder_after_minutes=settings.keyholder_after_minutes,
            )
        )

    return coverage_slots


def generate_improved_availability_data(employees):
    """Generate optimized availability data using hourly slots, ensuring most employees
    are available most of the time, and keyholders follow a clopen pattern.
    FIXED AT only for >= 30 contracted hours. FIXED is a portion. All get AVAILABLE.
    """
    availabilities = []
    # Tracks the dominant AvailabilityType for an employee on a given day_idx (0-5 for Mon-Sat)
    # Used to prevent mixing FIXED with AVAILABLE/PREFERRED on the same day if not intended.
    # Value can be FIXED if any fixed block exists, otherwise AVAILABLE/PREFERRED.
    daily_employee_day_type = {}
    employee_weekly_hours = {emp.id: 0.0 for emp in employees}

    working_days_indices = list(range(0, 6))  # 0=Monday, 1=Tuesday, ..., 5=Saturday

    today = date.today()
    start_of_week_date = today - timedelta(days=today.weekday())

    # --- Step 1: Core Keyholders (e.g., first 2 keyholders, if they meet criteria) ---
    all_keyholders = [e for e in employees if e.is_keyholder]
    num_core_keyholders = min(2, len(all_keyholders))
    core_keyholders = random.sample(all_keyholders, num_core_keyholders) if all_keyholders else []
    
    logging.info(f"Processing Core Keyholders: {[e.employee_id for e in core_keyholders]}")

    for emp in core_keyholders:
        current_emp_weekly_hours_fixed = 0
        current_emp_weekly_hours_available = 0
        
        # Core keyholders get some FIXED time ONLY IF their contracted hours are >= 30
        if emp.contracted_hours >= 30:
            fixed_block_start_hour = 10  # e.g., 10:00
            fixed_block_duration = 6     # e.g., 6 hours fixed
            fixed_block_end_hour = fixed_block_start_hour + fixed_block_duration # 16:00
            
            logging.info(f"  Core Keyholder {emp.employee_id} (contracted: {emp.contracted_hours}h) eligible for FIXED block {fixed_block_start_hour}-{fixed_block_end_hour}.")

            for day_idx in working_days_indices: # Assign fixed block on all working days
                day_date_obj = start_of_week_date + timedelta(days=day_idx)
                daily_employee_day_type[(emp.id, day_idx)] = AvailabilityType.FIXED # Mark day as having FIXED
                for hour_of_day in range(fixed_block_start_hour, fixed_block_end_hour):
                    avail_slot = EmployeeAvailability(
                        employee_id=emp.id, day_of_week=day_idx, hour=hour_of_day,
                        is_available=True, availability_type=AvailabilityType.FIXED,
                        start_date=day_date_obj, end_date=day_date_obj, is_recurring=False
                    )
                    availabilities.append(avail_slot)
                    current_emp_weekly_hours_fixed += 1
            logging.info(f"  Core Keyholder {emp.employee_id} assigned {current_emp_weekly_hours_fixed}h total FIXED.")

        # All core keyholders (even those not getting FIXED) should also have AVAILABLE time.
        # Target roughly their contracted hours as total availability for simplicity here.
        # This available time will be outside their fixed block if they have one.
        target_available_hours_for_core = emp.contracted_hours * 1.1 - current_emp_weekly_hours_fixed
        num_available_days_for_core = random.randint(4, 6) # Spread available time
        
        if target_available_hours_for_core > 0:
            chosen_days_for_available = random.sample(working_days_indices, num_available_days_for_core)
            remaining_available_target = target_available_hours_for_core

            for day_idx in chosen_days_for_available:
                if remaining_available_target <= 0: break
                day_date_obj = start_of_week_date + timedelta(days=day_idx)
                
                # Determine hours for this day from remaining target
                avg_avail_hrs_per_day = remaining_available_target / len([d for d in chosen_days_for_available if d >= day_idx])
                avail_hours_this_day = math.floor(random.uniform(max(2.0, avg_avail_hrs_per_day - 1), min(8.0, avg_avail_hrs_per_day + 1, remaining_available_target)))
                avail_hours_this_day = max(0, avail_hours_this_day)

                if avail_hours_this_day == 0: continue

                # Assign available slots, avoiding the fixed block if one exists on this day
                # For simplicity, let's try to add available slots in morning (09-fixed_start) or evening (fixed_end-20)
                
                possible_avail_slots = []
                if daily_employee_day_type.get((emp.id, day_idx)) == AvailabilityType.FIXED:
                    # Morning part
                    for h in range(9, fixed_block_start_hour): possible_avail_slots.append(h)
                    # Evening part
                    for h in range(fixed_block_end_hour, 20): possible_avail_slots.append(h)
                else: # No fixed block on this day, can use 09-20
                    for h in range(9, 20): possible_avail_slots.append(h)
                
                random.shuffle(possible_avail_slots) # Randomize order of filling
                
                hours_added_as_available_today = 0
                for hour_val in possible_avail_slots:
                    if hours_added_as_available_today >= avail_hours_this_day: break
                    
                    # Check if this slot is already taken by fixed
                    is_slot_taken_by_fixed = False
                    if daily_employee_day_type.get((emp.id, day_idx)) == AvailabilityType.FIXED:
                        if fixed_block_start_hour <= hour_val < fixed_block_end_hour:
                           is_slot_taken_by_fixed = True
                    
                    if not is_slot_taken_by_fixed:
                        avail_slot = EmployeeAvailability(
                            employee_id=emp.id, day_of_week=day_idx, hour=hour_val,
                            is_available=True, availability_type=AvailabilityType.AVAILABLE,
                            start_date=day_date_obj, end_date=day_date_obj, is_recurring=False
                        )
                        availabilities.append(avail_slot)
                        current_emp_weekly_hours_available += 1
                        hours_added_as_available_today +=1
                        # If this day previously wasn't marked as having FIXED, mark it as AVAILABLE
                        if daily_employee_day_type.get((emp.id, day_idx)) != AvailabilityType.FIXED:
                             daily_employee_day_type[(emp.id, day_idx)] = AvailabilityType.AVAILABLE
                remaining_available_target -= hours_added_as_available_today
            logging.info(f"  Core Keyholder {emp.employee_id} assigned {current_emp_weekly_hours_available}h additional AVAILABLE time.")
        employee_weekly_hours[emp.id] = current_emp_weekly_hours_fixed + current_emp_weekly_hours_available

    # --- Step 2: Other Employees (Non-Core Keyholders & Regular Staff) ---
    other_employees = [e for e in employees if e not in core_keyholders]
    logging.info(f"Processing Other Employees: {len(other_employees)} staff members.")
    
    for employee in other_employees:
        target_weekly_hours = 0
        num_available_days = 0

        # Define target weekly hours based on contracted hours (aim for more than contracted)
        if employee.employee_group in [EmployeeGroup.VZ, EmployeeGroup.TL]:
            target_weekly_hours = random.uniform(employee.contracted_hours * 1.1, employee.contracted_hours * 1.3)
            num_available_days = random.randint(5, 6)
        elif employee.employee_group == EmployeeGroup.TZ:
            target_weekly_hours = random.uniform(employee.contracted_hours * 1.2, min(40.0, employee.contracted_hours * 1.5))
            num_available_days = random.randint(4, 5)
        else:  # GFB
            target_weekly_hours = random.uniform(employee.contracted_hours * 1.2, min(15.0, employee.contracted_hours * 1.8))
            min_days_for_gfb = max(1, math.ceil(target_weekly_hours / 10.0)) 
            num_available_days = random.randint(min_days_for_gfb, 4)
        target_weekly_hours = round(target_weekly_hours,1)

        logging.info(f"  Emp {employee.employee_id} ({employee.employee_group.value}, contracted: {employee.contracted_hours}h): Target avail. {target_weekly_hours:.1f}h over {num_available_days} days.")

        potential_days_for_av = [d_idx for d_idx in working_days_indices if daily_employee_day_type.get((employee.id, d_idx)) != AvailabilityType.FIXED]
        
        if len(potential_days_for_av) < num_available_days:
            chosen_days_indices = random.sample(potential_days_for_av if potential_days_for_av else working_days_indices, 
                                                min(num_available_days, len(potential_days_for_av if potential_days_for_av else working_days_indices)))
        else:
            chosen_days_indices = random.sample(potential_days_for_av, num_available_days)
        chosen_days_indices.sort()

        if not chosen_days_indices and target_weekly_hours > 0:
            logging.warning(f"  No assignable days for {employee.employee_id} to meet {target_weekly_hours}h. Skipping.")
            continue

        current_emp_weekly_hours_fixed_local = 0
        current_emp_weekly_hours_available_local = 0
        remaining_target_hours = target_weekly_hours

        for day_idx in chosen_days_indices:
            if remaining_target_hours <= 0: break
            day_date_obj = start_of_week_date + timedelta(days=day_idx)
            
            num_remaining_chosen_days = len([d for d in chosen_days_indices if d >= day_idx])
            hours_for_this_day_total = 0
            if num_remaining_chosen_days > 0:
                avg_hours_per_rem_day = remaining_target_hours / num_remaining_chosen_days
                hours_for_this_day_total = random.uniform(max(4.0, avg_hours_per_rem_day - 2), 
                                                       min(10.0, avg_hours_per_rem_day + 2, remaining_target_hours))
            hours_for_this_day_total = max(4.0, min(hours_for_this_day_total, 10.0, remaining_target_hours))
            hours_for_this_day_total = math.floor(hours_for_this_day_total)

            if hours_for_this_day_total < 1: continue

            day_block_start_hour = random.randint(9, max(9, 20 - int(hours_for_this_day_total)))
            day_block_end_hour = day_block_start_hour + int(hours_for_this_day_total)

            # Determine if this employee gets FIXED time on this block
            fixed_hours_on_block = 0
            available_hours_on_block = hours_for_this_day_total
            current_day_primary_type = AvailabilityType.AVAILABLE # Default for the block

            if employee.is_keyholder and employee.contracted_hours >= 30:
                # Non-core KH with enough contracted hours: assign a portion as FIXED
                fixed_hours_on_block = math.floor(hours_for_this_day_total * 0.6) # e.g., 60% fixed
                fixed_hours_on_block = min(fixed_hours_on_block, 5) # Cap fixed portion to, say, 5 hours
                available_hours_on_block = hours_for_this_day_total - fixed_hours_on_block
                current_day_primary_type = AvailabilityType.FIXED # Day contains fixed
            
            # If not a KH eligible for fixed, the whole block is AVAILABLE (or PREFERRED by some minor chance)
            if current_day_primary_type == AvailabilityType.AVAILABLE and random.random() < 0.15: # Small chance for PREFERRED
                current_day_primary_type = AvailabilityType.PREFERRED

            daily_employee_day_type[(employee.id, day_idx)] = current_day_primary_type
            
            # Assign FIXED slots if any
            for h_offset in range(fixed_hours_on_block):
                hour_val = day_block_start_hour + h_offset
                avail_slot = EmployeeAvailability(
                    employee_id=employee.id, day_of_week=day_idx, hour=hour_val,
                    is_available=True, availability_type=AvailabilityType.FIXED,
                    start_date=day_date_obj, end_date=day_date_obj, is_recurring=False
                )
                availabilities.append(avail_slot)
                current_emp_weekly_hours_fixed_local += 1

            # Assign AVAILABLE/PREFERRED slots
            # Start after fixed slots end, or from block start if no fixed slots
            start_hour_for_available = day_block_start_hour + fixed_hours_on_block 
            for h_offset in range(available_hours_on_block):
                hour_val = start_hour_for_available + h_offset
                avail_slot = EmployeeAvailability(
                    employee_id=employee.id, day_of_week=day_idx, hour=hour_val,
                    is_available=True, availability_type= current_day_primary_type if fixed_hours_on_block == 0 else AvailabilityType.AVAILABLE, # If fixed was present, remainder is AVAILABLE
                    start_date=day_date_obj, end_date=day_date_obj, is_recurring=False
                )
                availabilities.append(avail_slot)
                current_emp_weekly_hours_available_local += 1
            
            remaining_target_hours -= hours_for_this_day_total
            logging.debug(f"    Emp {employee.employee_id} Day {day_idx}: Block {day_block_start_hour:02d}-{day_block_end_hour:02d} ({hours_for_this_day_total}h total). "
                          f"Fixed: {fixed_hours_on_block}h, Avail/Pref: {available_hours_on_block}h ({current_day_primary_type.value}). RemTarget: {remaining_target_hours:.1f}h")

        employee_weekly_hours[employee.id] = current_emp_weekly_hours_fixed_local + current_emp_weekly_hours_available_local
        logging.info(f"  Emp {employee.employee_id} assigned total {employee_weekly_hours[employee.id]:.1f}h (Fixed: {current_emp_weekly_hours_fixed_local}h, Avail/Pref: {current_emp_weekly_hours_available_local}h) for week (target was ~{target_weekly_hours:.1f}h).")

    # --- Step 3: "Clopen" Logic for Non-Core Keyholders ---
    # This logic remains largely the same: if a keyholder (who is not a core_keyholder and thus subject to Step 2)
    # had a FIXED block ending late, they get PREFERRED opening the next day.
    non_core_keyholders_for_clopen = [e for e in employees if e.is_keyholder and e not in core_keyholders]
    opening_hours_clopen = list(range(9, 14)) 
    closing_check_hours = [18, 19] 

    logging.info(f"Processing Clopen Logic for {len(non_core_keyholders_for_clopen)} non-core keyholders.")
    for kh_emp in non_core_keyholders_for_clopen:
        for day_idx in working_days_indices:
            is_closing_keyholder_today = False
            # Check if the day was marked as having FIXED and if specific late hours were indeed FIXED
            if daily_employee_day_type.get((kh_emp.id, day_idx)) == AvailabilityType.FIXED:
                fixed_late_hours_found = 0
                for chk_hour in closing_check_hours:
                    for av in availabilities:
                        if av.employee_id == kh_emp.id and av.day_of_week == day_idx and \
                           av.hour == chk_hour and av.availability_type == AvailabilityType.FIXED:
                            fixed_late_hours_found +=1
                            break 
                if fixed_late_hours_found == len(closing_check_hours): # Must have all closing hours as fixed
                    is_closing_keyholder_today = True
            
            if is_closing_keyholder_today:
                actual_next_working_day_idx = (day_idx + 1) if day_idx < 5 else 0 
                next_day_date_obj = start_of_week_date + timedelta(days=actual_next_working_day_idx)
                
                type_for_next_day_overall = daily_employee_day_type.get((kh_emp.id, actual_next_working_day_idx))
                
                if type_for_next_day_overall == AvailabilityType.FIXED:
                    logging.debug(f"  KH {kh_emp.employee_id} already primarily FIXED on next working day {actual_next_working_day_idx}. Skipping PREFERRED clopen addition.")
                    continue

                logging.info(f"  Adding PREFERRED clopen (09-14) for KH {kh_emp.employee_id} on day {actual_next_working_day_idx} due to closing FIXED on day {day_idx}")
                
                clopen_hours_added_count = 0
                for h_open in opening_hours_clopen:
                    # Remove any existing AVAILABLE slots for these hours on this day before adding PREFERRED
                    # And ensure we don't overwrite an existing FIXED slot from core assignment (though unlikely for non-core)
                    
                    # Check if a FIXED slot already exists from another part of logic
                    existing_fixed_for_clopen_hour = any(
                        av.employee_id == kh_emp.id and 
                        av.day_of_week == actual_next_working_day_idx and 
                        av.hour == h_open and
                        av.availability_type == AvailabilityType.FIXED 
                        for av in availabilities
                    )
                    if existing_fixed_for_clopen_hour:
                        logging.debug(f"    Skipping PREFERRED for {h_open} on day {actual_next_working_day_idx} for KH {kh_emp.employee_id}, already FIXED.")
                        continue

                    # Remove existing non-FIXED (AVAILABLE or PREFERRED) for this hour to replace with this clopen PREFERRED
                    availabilities = [
                        av for av in availabilities 
                        if not (av.employee_id == kh_emp.id and 
                                av.day_of_week == actual_next_working_day_idx and 
                                av.hour == h_open and
                                av.availability_type != AvailabilityType.FIXED) # Keep any fixed
                    ]

                    clopen_slot = EmployeeAvailability(
                        employee_id=kh_emp.id, day_of_week=actual_next_working_day_idx, hour=h_open,
                        is_available=True, availability_type=AvailabilityType.PREFERRED,
                        start_date=next_day_date_obj, end_date=next_day_date_obj, is_recurring=False
                    )
                    availabilities.append(clopen_slot)
                    clopen_hours_added_count +=1
                
                # Update the overall day type if it wasn't FIXED
                if type_for_next_day_overall != AvailabilityType.FIXED:
                    daily_employee_day_type[(kh_emp.id, actual_next_working_day_idx)] = AvailabilityType.PREFERRED
                
                employee_weekly_hours[kh_emp.id] = employee_weekly_hours.get(kh_emp.id, 0.0) + clopen_hours_added_count
                if clopen_hours_added_count > 0:
                    logging.debug(f"    KH {kh_emp.employee_id} weekly hours updated to {employee_weekly_hours[kh_emp.id]:.1f} after {clopen_hours_added_count}h PREFERRED clopen add.")
    
    # Final summary log (optional, can be extensive)
    for emp_id_log, total_hrs_log in employee_weekly_hours.items():
        emp_obj_log = next((e for e in employees if e.id == emp_id_log), None)
        if emp_obj_log:
            fixed_count = sum(1 for av in availabilities if av.employee_id == emp_id_log and av.availability_type == AvailabilityType.FIXED)
            avail_count = sum(1 for av in availabilities if av.employee_id == emp_id_log and av.availability_type == AvailabilityType.AVAILABLE)
            pref_count = sum(1 for av in availabilities if av.employee_id == emp_id_log and av.availability_type == AvailabilityType.PREFERRED)
            logging.info(
                f"Final Availability Summary for Emp {emp_obj_log.employee_id} ({emp_obj_log.employee_group.value}, contracted: {emp_obj_log.contracted_hours}h): "
                f"Total Generated: {total_hrs_log:.1f}h. Counts - FIXED: {fixed_count}, AVAILABLE: {avail_count}, PREFERRED: {pref_count}"
            )
    
    return availabilities, daily_employee_day_type, employee_weekly_hours


def generate_improved_shift_templates():
    """Generate optimized shift templates aligned with coverage requirements"""
    logging.info("Generating optimized shift templates...")

    # Delete existing shift templates
    ShiftTemplate.query.delete()
    db.session.commit()

    shift_templates = [
        # Full-time shifts (8 hours) that align with coverage slots
        ShiftTemplate(
            start_time="09:00",
            end_time="16:00",
            requires_break=True,
            shift_type=ShiftType.EARLY,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
        ShiftTemplate(
            start_time="09:00",
            end_time="17:00",
            requires_break=True,
            shift_type=ShiftType.MIDDLE,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
        ShiftTemplate(
            start_time="12:00",
            end_time="20:00",
            requires_break=True,
            shift_type=ShiftType.LATE,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
        # Part-time shifts (6 hours)
        ShiftTemplate(
            start_time="09:00",
            end_time="14:00",
            requires_break=False,
            shift_type=ShiftType.EARLY,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
        ShiftTemplate(
            start_time="11:00",
            end_time="17:00",
            requires_break=False,
            shift_type=ShiftType.MIDDLE,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
        ShiftTemplate(
            start_time="14:00",
            end_time="20:00",
            requires_break=False,
            shift_type=ShiftType.LATE,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
        # Mini-job shifts (4 hours)
        ShiftTemplate(
            start_time="09:00",
            end_time="13:00",
            requires_break=False,
            shift_type=ShiftType.EARLY,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
        ShiftTemplate(
            start_time="16:00",
            end_time="20:00",
            requires_break=False,
            shift_type=ShiftType.LATE,
            active_days={
                "0": False,
                "1": True,
                "2": True,
                "3": True,
                "4": True,
                "5": True,
                "6": True,
            },
        ),
    ]

    # Calculate durations and validate before adding
    for template in shift_templates:
        template._calculate_duration()
        template.validate()
        db.session.add(template)

    try:
        db.session.commit()
        logging.info(f"Successfully created {len(shift_templates)} shift templates")
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating shift templates: {str(e)}")
        raise

    return shift_templates


def generate_granular_coverage_data():
    """Generate more granular coverage requirements to support varied shift assignments"""
    # Get store settings
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()

    coverage_slots = []
    # Note: Coverage is already using correct day indices: Monday (0) to Saturday (5)
    for day_index in range(6):  # Monday (0) to Saturday (5)
        # Morning slot (opening)
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="09:00",
                end_time="12:00",
                min_employees=1,
                max_employees=2,
                employee_types=["TL", "VZ", "TZ", "GFB"],  # Using string values
                requires_keyholder=True,
                keyholder_before_minutes=settings.keyholder_before_minutes,
                keyholder_after_minutes=0,
            )
        )
        # Mid-day slot
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="12:00",
                end_time="16:00",
                min_employees=2,
                max_employees=3,
                employee_types=["TL", "VZ", "TZ", "GFB"],  # Using string values
                requires_keyholder=False,
                keyholder_before_minutes=0,
                keyholder_after_minutes=0,
            )
        )
        # Afternoon slot
        coverage_slots.append(
            Coverage(
                day_index=day_index,
                start_time="16:00",
                end_time="20:00",
                min_employees=1,
                max_employees=2,
                employee_types=["TL", "VZ", "TZ", "GFB"],  # Using string values
                requires_keyholder=True,
                keyholder_before_minutes=0,
                keyholder_after_minutes=settings.keyholder_after_minutes,
            )
        )

    return coverage_slots


def generate_optimized_shift_templates():
    """Generate diverse shift templates that align with granular coverage requirements"""
    logging.info("Generating optimized and diverse shift templates...")

    # Delete existing shift templates
    ShiftTemplate.query.delete()
    db.session.commit()

    # Get store settings
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()

    shift_templates = [
        # Opening shifts (early morning)
        ShiftTemplate(
            start_time="09:00",
            end_time="14:00",
            requires_break=False,
            shift_type=ShiftType.EARLY,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
        # Mid-day shifts
        ShiftTemplate(
            start_time="11:00",
            end_time="16:00",
            requires_break=False,
            shift_type=ShiftType.MIDDLE,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
        # Closing shifts
        ShiftTemplate(
            start_time="15:00",
            end_time="20:00",
            requires_break=False,
            shift_type=ShiftType.LATE,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
        # Full-time morning to mid-afternoon
        ShiftTemplate(
            start_time="09:00",
            end_time="17:00",
            requires_break=True,
            shift_type=ShiftType.EARLY,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
        # Full-time mid-day to closing
        ShiftTemplate(
            start_time="12:00",
            end_time="20:00",
            requires_break=True,
            shift_type=ShiftType.LATE,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
        # Short opening shift (mini-job)
        ShiftTemplate(
            start_time="09:00",
            end_time="12:00",
            requires_break=False,
            shift_type=ShiftType.EARLY,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
        # Short mid-day shift (mini-job)
        ShiftTemplate(
            start_time="12:00",
            end_time="16:00",
            requires_break=False,
            shift_type=ShiftType.MIDDLE,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
        # Short closing shift (mini-job)
        ShiftTemplate(
            start_time="16:00",
            end_time="20:00",
            requires_break=False,
            shift_type=ShiftType.LATE,
            active_days={str(i): i != 6 for i in range(7)},  # All days except Sunday (Sunday is 6)
        ),
    ]

    # Calculate durations and validate before adding
    for template in shift_templates:
        template._calculate_duration()
        template.validate()
        db.session.add(template)

    try:
        db.session.commit()
        logging.info(f"Successfully created {len(shift_templates)} shift templates")
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating shift templates: {str(e)}")
        raise

    return shift_templates


def generate_improved_absences(employees):
    """Generate realistic absences for employees"""
    logging.info("Generating improved absences...")

    absences = []
    today = date.today()
    # Generate absences for the next 3 months
    date_range = 90

    # Define absence types with their probabilities and typical durations
    absence_types = {
        "URL": {  # Vacation
            "prob": 0.7,  # 70% of employees will have vacation
            "min_duration": 5,
            "max_duration": 14,
            "instances": (1, 2),  # 1-2 vacation periods
        },
        "ABW": {  # Absent
            "prob": 0.3,  # 30% chance of being absent
            "min_duration": 1,
            "max_duration": 3,
            "instances": (0, 2),  # 0-2 absences
        },
        "SLG": {  # Training
            "prob": 0.4,  # 40% chance of training
            "min_duration": 1,
            "max_duration": 3,
            "instances": (0, 1),  # 0-1 training periods
        },
    }

    for employee in employees:
        # Process each absence type
        for absence_type, config in absence_types.items():
            if random.random() < config["prob"]:
                # Determine number of instances for this absence type
                num_instances = random.randint(*config["instances"])

                for _ in range(num_instances):
                    # Determine duration
                    duration = random.randint(
                        config["min_duration"], config["max_duration"]
                    )

                    # Find a suitable start date
                    attempts = 0
                    max_attempts = 10
                    valid_date_found = False

                    while attempts < max_attempts and not valid_date_found:
                        # Random start date within next 3 months
                        start_date_obj = today + timedelta(  # Renamed to avoid conflict
                            days=random.randint(1, date_range - duration)
                        )
                        end_date_obj = start_date_obj + timedelta(days=duration - 1) # Renamed

                        # Check if this period overlaps with existing absences
                        overlaps = False
                        for existing in absences:
                            if existing.employee_id == employee.id and not (
                                end_date_obj < existing.start_date # Use renamed var
                                or start_date_obj > existing.end_date # Use renamed var
                            ):
                                overlaps = True
                                break

                        if not overlaps:
                            valid_date_found = True
                            absence = Absence(
                                employee_id=employee.id,  # noqa
                                absence_type_id=absence_type,  # noqa
                                start_date=start_date_obj, # Use renamed var # noqa
                                end_date=end_date_obj,   # Use renamed var # noqa
                                note=f"Generated {absence_type} absence",  # noqa
                            )
                            absences.append(absence)
                            logging.info(
                                f"Created {absence_type} absence for {employee.employee_id} "
                                f"from {start_date_obj} to {end_date_obj}" # Use renamed vars
                            )

                        attempts += 1
    return absences


@bp.route("/optimized/", methods=["POST"])
def generate_optimized_demo_data():
    """Generate optimized demo data with more diverse shifts and granular coverage"""
    try:
        json_data = request.get_json() or {}
        num_employees_raw = json_data.get("num_employees")
        num_employees_override = None  # Default
        if isinstance(num_employees_raw, int):
            if num_employees_raw > 0:
                num_employees_override = num_employees_raw
        elif isinstance(num_employees_raw, str):
            if num_employees_raw.isdigit():
                parsed_num = int(num_employees_raw)
                if parsed_num > 0:
                    num_employees_override = parsed_num

        logging.info(f"Generating optimized demo data with diverse shift patterns, num_employees_override: {num_employees_override}")

        # Update settings first
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()

        settings.employee_types = generate_employee_types()  # type: ignore[assignment]
        settings.absence_types = generate_absence_types()  # type: ignore[assignment]
        db.session.commit()
        logging.info("Successfully updated employee and absence types")

        # Clear existing data
        logging.info("Cleaning up existing data...")
        EmployeeAvailability.query.delete()
        Coverage.query.delete()
        ShiftTemplate.query.delete()
        Employee.query.delete()
        Absence.query.delete()
        db.session.commit()
        logging.info("Successfully cleaned up existing data")

        # Generate new optimized data
        try:
            logging.info("Generating improved employee data...")
            employees = generate_improved_employee_data(num_employees_override=num_employees_override)
            logging.info(f"Created {len(employees)} employees, adding to session...")
            db.session.add_all(employees)
            logging.info("Committing employees to database...")
            db.session.commit()
            logging.info(f"Successfully created {len(employees)} employees")
        except Exception as e:
            logging.error(f"Error in generate_improved_employee_data: {str(e)}")
            db.session.rollback()
            raise

        # Generate granular coverage
        try:
            logging.info("Generating granular coverage data...")
            coverage_slots = generate_granular_coverage_data()
            db.session.add_all(coverage_slots)
            db.session.commit()
            logging.info(
                f"Successfully created {len(coverage_slots)} granular coverage slots"
            )
        except Exception as e:
            logging.error(f"Error in generate_granular_coverage_data: {str(e)}")
            db.session.rollback()
            raise

        # Generate diverse shift templates
        shift_templates = generate_optimized_shift_templates()
        logging.info(
            f"Successfully created {len(shift_templates)} diverse shift templates"
        )

        # Generate optimized availability data
        # Note: The old generate_improved_availability_data is being replaced.
        # The new one (defined as a string above) should be used here.
        # For now, this call will use the OLD version from the file.
        availabilities, daily_employee_day_type, employee_weekly_hours = generate_improved_availability_data(employees)
        db.session.add_all(availabilities)
        db.session.commit()
        logging.info(f"Successfully created {len(availabilities)} availabilities")

        # Generate absences
        try:
            logging.info("Generating employee absences...")
            absences = generate_improved_absences(employees)
            db.session.add_all(absences)
            db.session.commit()
            logging.info(f"Successfully created {len(absences)} absences")
        except Exception as e:
            logging.error(f"Error in generate_improved_absences: {str(e)}")
            db.session.rollback()
            raise

        # Update settings to record the execution
        settings.actions_demo_data = {
            "selected_module": "optimized",
            "last_execution": datetime.utcnow().isoformat(),
        }
        db.session.commit()
        logging.info("Successfully updated settings")

        return jsonify(
            {
                "message": "Successfully generated optimized demo data with realistic schedules",
                "timestamp": datetime.utcnow().isoformat(),
            }
        ), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to generate optimized demo data: {str(e)}")
        return jsonify(
            {"error": "Failed to generate optimized demo data", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
