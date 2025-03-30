from flask import Blueprint, jsonify, request, current_app
from models import (
    db,
    Settings,
    Employee,
    Coverage,
    EmployeeAvailability,
    ShiftTemplate,
    Absence,
)
from models.employee import AvailabilityType, EmployeeGroup
from models.fixed_shift import ShiftType
from http import HTTPStatus
from datetime import datetime, date, timedelta
import random
import logging
from sqlalchemy import text
import uuid
from threading import Thread
import traceback

# Change url_prefix to / since app.py already adds /api/demo-data
bp = Blueprint("demo_data", __name__, url_prefix="/")


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
    for i in range(30):
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
            # Geringfügig Beschäftigt employees must stay under the monthly limit
            # Based on validation in employee.py: max_monthly_hours = 556 / 12.41 / 4.33
            # This is approximately 10.35 hours per week
            contracted_hours = random.randint(
                5, 10
            )  # Mini-job range, max 10 to stay within limit
            logging.info(
                f"GFB employee: {first_name} {last_name}, contracted_hours: {contracted_hours}"
            )

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
        module = request.json.get("module", "all")
        logging.info(f"Generating demo data for module: {module}")

        if module in ["settings", "all"]:
            logging.info("Generating demo settings...")
            settings = Settings.query.first()
            if not settings:
                settings = Settings.get_default_settings()
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


def generate_improved_employee_data():
    """Generate optimized employee data with keyholders and proper distribution of types"""
    logging.info("Starting to generate improved employee data")

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
            "min_hours": 15,
            "max_hours": 34,
            "count": 12,
        },
        {
            "id": "GFB",  # String value for employee group
            "enum": EmployeeGroup.GFB,  # Keep enum for reference
            "name": "Geringfügig Beschäftigt",
            "min_hours": 0,
            "max_hours": 14,
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

    # Create employees based on the defined distribution
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
                # Geringfügig Beschäftigt employees must stay under the monthly limit
                # Based on validation in employee.py: max_monthly_hours = 556 / 12.41 / 4.33
                # This is approximately 10.35 hours per week
                contracted_hours = random.randint(
                    5, 10
                )  # Mini-job range, max 10 to stay within limit
                logging.info(
                    f"GFB employee: {first_name} {last_name}, contracted_hours: {contracted_hours}"
                )

            # Make all employees with more than 20 contracted hours keyholders
            is_keyholder = contracted_hours > 20

            logging.info(
                f"Creating employee: {first_name} {last_name}, "
                f"group: {emp_type['id']}, hours: {contracted_hours}, "
                f"keyholder: {is_keyholder}"
            )

            try:
                employee = Employee(
                    employee_id=employee_id,
                    first_name=first_name,
                    last_name=last_name,
                    employee_group=emp_type["id"],  # Using string value
                    contracted_hours=contracted_hours,
                    is_keyholder=is_keyholder,
                    is_active=True,
                    email=f"employee{len(employees) + 1}@example.com",
                    phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}",
                )
                employees.append(employee)
            except Exception as e:
                logging.error(f"Error creating employee: {e}")
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
    """Generate optimized availability data ensuring coverage requirements are met"""
    try:
        logging.info(f"Starting availability generation for {len(employees)} employees")
        availabilities = []

        # Group employees by type for easier assignment
        employee_groups = {
            "TL": [e for e in employees if e.employee_group == "TL"],
            "VZ": [e for e in employees if e.employee_group == "VZ"],
            "TZ": [e for e in employees if e.employee_group == "TZ"],
            "GFB": [e for e in employees if e.employee_group == "GFB"],
        }
        
        logging.info(f"Employee groups: TL={len(employee_groups['TL'])}, VZ={len(employee_groups['VZ'])}, TZ={len(employee_groups['TZ'])}, GFB={len(employee_groups['GFB'])}")

        # Define working days (Monday to Saturday)
        working_days = list(range(1, 7))  # 1-6 (Monday-Saturday)

        def calculate_weekly_hours(employee_availabilities):
            """Calculate total weekly available hours for an employee"""
            # Count unique day-hour combinations
            unique_slots = set()
            for avail in employee_availabilities:
                unique_slots.add((avail.day_of_week, avail.hour))
            return len(unique_slots)

        # Step 1: Ensure keyholders have availability for each time slot
        keyholders = [e for e in employees if e.is_keyholder]
        logging.info(f"Found {len(keyholders)} keyholders")
        
        for day in working_days:
            for slot_idx, (start_hour, end_hour) in enumerate([(9, 14), (14, 20)]):
                if not keyholders:
                    logging.warning("No keyholders found, skipping keyholder availability")
                    break
                    
                slot_keyholders = random.sample(keyholders, min(2, len(keyholders)))
                logging.info(f"Assigning {len(slot_keyholders)} keyholders for day {day}, slot {slot_idx}")
                
                for keyholder in slot_keyholders:
                    for hour in range(start_hour, end_hour):
                        availability = EmployeeAvailability(
                            employee_id=keyholder.id,
                            is_recurring=True,
                            day_of_week=day,
                            hour=hour,
                            is_available=True,
                            availability_type=AvailabilityType.FIXED,
                        )
                        availabilities.append(availability)

        # Process each employee type
        logging.info("Generating availability for regular employees")
        for employee_type, group_employees in employee_groups.items():
            logging.info(f"Processing {len(group_employees)} employees of type {employee_type}")
            
            for employee in group_employees:
                employee_availabilities = []
                target_hours = employee.contracted_hours * (
                    2.5 if employee.contracted_hours <= 20 else 1.5
                )
                
                logging.info(f"Employee {employee.employee_id}: contracted={employee.contracted_hours}h, target={target_hours}h")

                # Determine number of working days based on target hours
                if employee.contracted_hours <= 20:
                    min_days = 4  # More days for flexibility
                    max_days = 6
                else:
                    min_days = max(3, int(employee.contracted_hours / 8))  # At least 3 days
                    max_days = 6

                work_days_count = random.randint(min_days, max_days)
                work_days = random.sample(working_days, work_days_count)

                logging.info(f"Employee {employee.employee_id}: assigned {work_days_count} working days")

                # Generate availability blocks for each working day
                for day in work_days:
                    # Multiple blocks per day for flexible employees
                    if employee.contracted_hours <= 20:
                        num_blocks = random.randint(2, 3)  # More blocks for flexibility
                    else:
                        num_blocks = random.randint(1, 2)

                    # Available time slots
                    time_slots = [
                        (9, 14),  # Morning
                        (11, 16),  # Mid-day
                        (14, 20),  # Afternoon
                        (9, 13),  # Short morning
                        (16, 20),  # Short afternoon
                        (12, 17),  # Mid-shift
                    ]

                    # Select random blocks for this day
                    day_slots = random.sample(time_slots, min(num_blocks, len(time_slots)))

                    for start_hour, end_hour in day_slots:
                        for hour in range(start_hour, end_hour):
                            availability = EmployeeAvailability(
                                employee_id=employee.id,
                                is_recurring=True,
                                day_of_week=day,
                                hour=hour,
                                is_available=True,
                                availability_type=AvailabilityType.AVAILABLE,
                            )
                            employee_availabilities.append(availability)

                # Add preferred availability on additional days
                remaining_days = [d for d in working_days if d not in work_days]
                if remaining_days:
                    preferred_days_count = random.randint(
                        2 if employee.contracted_hours <= 20 else 1,
                        min(3, len(remaining_days)),
                    )
                    preferred_days = random.sample(remaining_days, preferred_days_count)

                    for day in preferred_days:
                        num_slots = random.randint(1, 2)
                        preferred_slots = random.sample(
                            [(9, 13), (13, 17), (16, 20)], num_slots
                        )

                        for start_hour, end_hour in preferred_slots:
                            for hour in range(start_hour, end_hour):
                                availability = EmployeeAvailability(
                                    employee_id=employee.id,
                                    is_recurring=True,
                                    day_of_week=day,
                                    hour=hour,
                                    is_available=True,
                                    availability_type=AvailabilityType.PREFERRED,
                                )
                                employee_availabilities.append(availability)

                # Check if we have enough hours
                weekly_hours = calculate_weekly_hours(employee_availabilities)

                # If we don't have enough hours, add more availability
                while weekly_hours < target_hours and len(remaining_days) > 0:
                    day = random.choice(remaining_days)
                    start_hour, end_hour = random.choice(time_slots)

                    for hour in range(start_hour, end_hour):
                        availability = EmployeeAvailability(
                            employee_id=employee.id,
                            is_recurring=True,
                            day_of_week=day,
                            hour=hour,
                            is_available=True,
                            availability_type=AvailabilityType.PREFERRED,
                        )
                        employee_availabilities.append(availability)

                    weekly_hours = calculate_weekly_hours(employee_availabilities)

                # Add all availabilities for this employee
                availabilities.extend(employee_availabilities)

                # Log availability statistics
                logging.info(
                    f"Employee {employee.employee_id} ({employee.employee_group}): "
                    f"Contracted={employee.contracted_hours:.1f}h/week, "
                    f"Target={target_hours:.1f}h/week, "
                    f"Available={weekly_hours}h/week"
                )

        logging.info(f"Successfully generated {len(availabilities)} availabilities for {len(employees)} employees")
        return availabilities
        
    except Exception as e:
        logging.error(f"Error in availability generation: {str(e)}")
        logging.error(traceback.format_exc())
        # Return empty list instead of raising to allow other operations to continue
        return []


def generate_optimized_shift_templates():
    """Generate diverse shift templates that align with granular coverage requirements"""
    logging.info("Generating optimized and diverse shift templates...")

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
            active_days={str(i): i != 0 for i in range(7)},  # All days except Sunday
        ),
        # Mid-day shifts
        ShiftTemplate(
            start_time="11:00",
            end_time="16:00",
            requires_break=False,
            shift_type=ShiftType.MIDDLE,
            active_days={str(i): i != 0 for i in range(7)},
        ),
        # Closing shifts
        ShiftTemplate(
            start_time="15:00",
            end_time="20:00",
            requires_break=False,
            shift_type=ShiftType.LATE,
            active_days={str(i): i != 0 for i in range(7)},
        ),
        # Full-time morning to mid-afternoon
        ShiftTemplate(
            start_time="09:00",
            end_time="17:00",
            requires_break=True,
            shift_type=ShiftType.EARLY,
            active_days={str(i): i != 0 for i in range(7)},
        ),
        # Full-time mid-day to closing
        ShiftTemplate(
            start_time="12:00",
            end_time="20:00",
            requires_break=True,
            shift_type=ShiftType.LATE,
            active_days={str(i): i != 0 for i in range(7)},
        ),
        # Short opening shift (mini-job)
        ShiftTemplate(
            start_time="09:00",
            end_time="12:00",
            requires_break=False,
            shift_type=ShiftType.EARLY,
            active_days={str(i): i != 0 for i in range(7)},
        ),
        # Short mid-day shift (mini-job)
        ShiftTemplate(
            start_time="12:00",
            end_time="16:00",
            requires_break=False,
            shift_type=ShiftType.MIDDLE,
            active_days={str(i): i != 0 for i in range(7)},
        ),
        # Short closing shift (mini-job)
        ShiftTemplate(
            start_time="16:00",
            end_time="20:00",
            requires_break=False,
            shift_type=ShiftType.LATE,
            active_days={str(i): i != 0 for i in range(7)},
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
    for day_index in range(0, 6):  # Monday (0) to Saturday (5)
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


def generate_improved_absences(employees):
    """Generate realistic absences for employees"""
    try:
        logging.info(f"Starting absence generation for {len(employees)} employees")
        absences = []
        today = date.today()
        # Generate absences for the next 3 months
        date_range = 90

        # Define absence types with their probabilities and typical durations
        absence_types = {
            "URL": {  # Vacation
                "prob": 1.0,  # 100% of employees will have vacation
                "min_duration": 5,
                "max_duration": 14,
                "min_instances": 1,  # At least 1 vacation period
                "max_instances": 2,  # Up to 2 vacation periods
            },
            "ABW": {  # Absent/Sick
                "prob": 0.8,  # 80% chance of being absent
                "min_duration": 1,
                "max_duration": 5,
                "min_instances": 1,  # At least 1 absence
                "max_instances": 3,  # Up to 3 absences
            },
            "SLG": {  # Training
                "prob": 0.9,  # 90% chance of training
                "min_duration": 1,
                "max_duration": 3,
                "min_instances": 1,  # At least 1 training
                "max_instances": 2,  # Up to 2 trainings
            },
        }

        logging.info(f"Defined absence types: {list(absence_types.keys())}")
        employee_count = 0
        
        for employee in employees:
            employee_count += 1
            logging.info(f"Processing absences for employee {employee.employee_id} ({employee_count}/{len(employees)})")
            employee_absences = []
            # Process each absence type
            for absence_type, config in absence_types.items():
                if random.random() < config["prob"]:
                    # Determine number of instances for this absence type
                    num_instances = random.randint(
                        config["min_instances"], config["max_instances"]
                    )
                    
                    logging.info(f"Generating {num_instances} {absence_type} absences for {employee.employee_id}")

                    for _ in range(num_instances):
                        # Determine duration
                        duration = random.randint(
                            config["min_duration"], config["max_duration"]
                        )

                        # Find a suitable start date
                        attempts = 0
                        max_attempts = 20  # Increased attempts to ensure we find a slot
                        valid_date_found = False

                        while attempts < max_attempts and not valid_date_found:
                            # Random start date within next 3 months
                            start_date = today + timedelta(
                                days=random.randint(1, date_range - duration)
                            )
                            end_date = start_date + timedelta(days=duration - 1)

                            # Check if this period overlaps with existing absences
                            overlaps = False
                            for existing in employee_absences:
                                if not (
                                    end_date < existing.start_date
                                    or start_date > existing.end_date
                                ):
                                    overlaps = True
                                    break

                            if not overlaps:
                                valid_date_found = True
                                try:
                                    absence = Absence(
                                        employee_id=employee.id,
                                        absence_type_id=absence_type,
                                        start_date=start_date,
                                        end_date=end_date,
                                        note=f"Generated {absence_type} absence for {employee.first_name} {employee.last_name}",
                                    )
                                    employee_absences.append(absence)
                                    absences.append(absence)
                                    logging.info(
                                        f"Created {absence_type} absence for {employee.employee_id} "
                                        f"from {start_date} to {end_date}"
                                    )
                                except Exception as e:
                                    logging.error(f"Error creating absence: {str(e)}")

                            attempts += 1

                        if not valid_date_found:
                            logging.warning(
                                f"Could not find suitable dates for {absence_type} absence "
                                f"for employee {employee.employee_id} after {max_attempts} attempts"
                            )

            # Ensure at least one absence of any type if none were generated
            if not employee_absences:
                absence_type = random.choice(list(absence_types.keys()))
                duration = random.randint(1, 5)
                start_date = today + timedelta(
                    days=random.randint(1, date_range - duration)
                )
                end_date = start_date + timedelta(days=duration - 1)

                try:
                    absence = Absence(
                        employee_id=employee.id,
                        absence_type_id=absence_type,
                        start_date=start_date,
                        end_date=end_date,
                        note=f"Generated fallback {absence_type} absence for {employee.first_name} {employee.last_name}",
                    )
                    absences.append(absence)
                    logging.info(
                        f"Created fallback {absence_type} absence for {employee.employee_id} "
                        f"from {start_date} to {end_date}"
                    )
                except Exception as e:
                    logging.error(f"Error creating fallback absence: {str(e)}")

        # Log summary statistics
        absence_stats = {}
        for absence in absences:
            if absence.absence_type_id not in absence_stats:
                absence_stats[absence.absence_type_id] = 0
            absence_stats[absence.absence_type_id] += 1

        logging.info("Absence generation summary:")
        for absence_type, count in absence_stats.items():
            logging.info(f"{absence_type}: {count} absences generated")
        logging.info(f"Total absences generated: {len(absences)}")
        logging.info(f"Average absences per employee: {len(absences) / len(employees):.1f}")

        return absences
        
    except Exception as e:
        logging.error(f"Error in absence generation: {str(e)}")
        logging.error(traceback.format_exc())
        # Return empty list instead of raising to allow other operations to continue
        return []


@bp.route("/optimized/", methods=["POST"])
def generate_optimized_demo_data():
    """Generate optimized demo data with more diverse shifts and granular coverage"""
    try:
        # Start a background task and return immediately
        task_id = str(uuid.uuid4())
        app = current_app._get_current_object()  # Get the actual app instance

        # Store task info in the database
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()

        settings.actions_demo_data = {
            "selected_module": "optimized",
            "task_id": task_id,
            "status": "started",
            "start_time": datetime.utcnow().isoformat(),
            "progress": 0,
        }
        db.session.commit()

        # Start the background task with app instance
        thread = Thread(target=generate_demo_data_background, args=(app, task_id))
        thread.daemon = True
        thread.start()

        return jsonify(
            {
                "message": "Demo data generation started",
                "task_id": task_id,
                "status": "started",
            }
        ), HTTPStatus.ACCEPTED

    except Exception as e:
        logging.error(f"Failed to start demo data generation: {str(e)}")
        return jsonify(
            {"error": "Failed to start demo data generation", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/optimized/status/<task_id>", methods=["GET"])
def get_generation_status(task_id):
    """Get the status of a demo data generation task"""
    try:
        settings = Settings.query.first()
        if not settings or "actions_demo_data" not in settings.__dict__:
            return jsonify({"error": "Task not found"}), HTTPStatus.NOT_FOUND

        task_info = settings.actions_demo_data
        logging.info(f"Status check for task {task_id}, current status: {task_info.get('status', 'Unknown')}")
        if task_info.get("task_id") != task_id:
            return jsonify({"error": "Task not found"}), HTTPStatus.NOT_FOUND

        return jsonify(
            {
                "task_id": task_id,
                "status": task_info.get("status"),
                "progress": task_info.get("progress"),
                "start_time": task_info.get("start_time"),
                "end_time": task_info.get("end_time"),
                "error": task_info.get("error"),
            }
        ), HTTPStatus.OK

    except Exception as e:
        logging.error(f"Failed to get task status: {str(e)}")
        return jsonify(
            {"error": "Failed to get task status", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/optimized/reset", methods=["POST"])
def reset_optimized_demo_data_status():
    """Reset the status of the optimized demo data generation"""
    try:
        settings = Settings.query.first()
        if not settings:
            return jsonify({"error": "Settings not found"}), HTTPStatus.NOT_FOUND

        # Reset the status
        settings.actions_demo_data.update({
            "status": None,
            "progress": 0,
            "task_id": None,
            "start_time": None,
            "end_time": None,
            "error": None
        })
        db.session.commit()

        return jsonify({
            "message": "Status reset successfully",
        }), HTTPStatus.OK

    except Exception as e:
        logging.error(f"Failed to reset optimized demo data status: {str(e)}")
        return jsonify(
            {"error": "Failed to reset status", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


def generate_demo_data_background(app, task_id):
    """Background task to generate demo data"""
    with app.app_context():
        try:
            logging.info(f"Starting background demo data generation task {task_id}")

            def update_progress(progress, status="running", error=None):
                settings = Settings.query.first()
                if settings:
                    try:
                        settings.actions_demo_data.update(
                            {"status": status, "progress": progress, "error": error}
                        )
                        if status == "completed":
                            settings.actions_demo_data["end_time"] = (
                                datetime.utcnow().isoformat()
                            )
                        db.session.commit()
                        logging.info(f"Updated progress: {progress}%, status: {status}")
                    except Exception as e:
                        logging.error(f"Error updating progress: {str(e)}")
                        db.session.rollback()

            # Update settings first
            update_progress(5, "updating_settings")
            settings = Settings.query.first()
            if not settings:
                settings = Settings.get_default_settings()
                db.session.add(settings)
                db.session.commit()

            # Generate employee and absence types
            employee_types = generate_employee_types()
            absence_types = generate_absence_types()
            settings.employee_types = employee_types
            settings.absence_types = absence_types
            db.session.commit()
            logging.info("Updated settings with employee and absence types")

            # Clear existing data
            update_progress(10, "clearing_existing_data")
            try:
                logging.info("Clearing existing data...")
                tables = [EmployeeAvailability, Absence, Coverage, ShiftTemplate, Employee]
                for table in tables:
                    count = table.query.delete()
                    logging.info(f"Deleted {count} rows from {table.__tablename__}")
                db.session.commit()
                logging.info("Successfully cleared existing data")
            except Exception as e:
                logging.error(f"Error clearing data: {str(e)}")
                db.session.rollback()
                # Continue despite errors

            statistics = {}

            # STEP 1: Generate and insert employees
            update_progress(20, "generating_employees")
            try:
                logging.info("Generating employees...")
                employees = generate_improved_employee_data()
                logging.info(f"Created {len(employees)} employee objects")
                
                # Insert all employees at once
                db.session.bulk_save_objects(employees)
                db.session.commit()
                
                # Retrieve the newly created employees with their IDs
                employees = Employee.query.all()
                statistics["employees"] = len(employees)
                logging.info(f"Successfully inserted {len(employees)} employees")
                update_progress(30, "employees_created")
            except Exception as e:
                logging.error(f"Error generating employees: {str(e)}")
                logging.error(traceback.format_exc())
                db.session.rollback()
                update_progress(30, "error_with_employees", str(e))
                raise  # Stop the process if employees fail

            # STEP 2: Create shift templates
            update_progress(40, "generating_shift_templates")
            try:
                logging.info("Generating shift templates...")
                templates = generate_optimized_shift_templates()
                db.session.bulk_save_objects(templates)
                db.session.commit()
                statistics["shift_templates"] = len(templates)
                logging.info(f"Successfully inserted {len(templates)} shift templates")
                update_progress(50, "templates_created")
            except Exception as e:
                logging.error(f"Error generating shift templates: {str(e)}")
                logging.error(traceback.format_exc())
                db.session.rollback()
                update_progress(50, "error_with_templates", str(e))

            # STEP 3: Create coverage
            update_progress(60, "generating_coverage")
            try:
                logging.info("Generating coverage requirements...")
                coverage = generate_granular_coverage_data()
                db.session.bulk_save_objects(coverage)
                db.session.commit()
                statistics["coverage"] = len(coverage)
                logging.info(f"Successfully inserted {len(coverage)} coverage slots")
                update_progress(65, "coverage_created")
            except Exception as e:
                logging.error(f"Error generating coverage: {str(e)}")
                logging.error(traceback.format_exc())
                db.session.rollback()
                update_progress(65, "error_with_coverage", str(e))

            # STEP 4: Generate and insert employee availabilities - IMPORTANT!
            update_progress(70, "generating_availability")
            try:
                logging.info("Generating employee availability...")
                # We work directly with the employees we already have
                if not employees:
                    employees = Employee.query.all()  # Fetch again if needed
                
                if not employees:
                    raise ValueError("No employees found for availability generation")
                
                # Generate availabilities for each employee individually
                # This ensures we can insert at least some availabilities even if others fail
                all_availabilities = []
                for i, employee in enumerate(employees):
                    logging.info(f"Generating availability for employee {employee.employee_id} ({i+1}/{len(employees)})")
                    try:
                        # Create individual availability entries per day and hour
                        employee_availabilities = []
                        
                        # Handle availability for each weekday (1-6, Mon-Sat)
                        for day in range(1, 7):  # Skip Sunday (0)
                            # Determine availability periods based on employee type
                            if employee.employee_group == "TL":  # Team Lead - more hours
                                periods = [(9, 17, AvailabilityType.FIXED)]  # 8-hour fixed block
                            elif employee.employee_group == "VZ":  # Full-time
                                periods = [(9, 17, AvailabilityType.AVAILABLE)]  # 8-hour block
                            elif employee.employee_group == "TZ":  # Part-time
                                # Alternate between morning and afternoon
                                if day % 2 == 0:
                                    periods = [(9, 15, AvailabilityType.AVAILABLE)]  # Morning
                                else:
                                    periods = [(14, 20, AvailabilityType.AVAILABLE)]  # Afternoon
                            else:  # GFB / Mini-job
                                # Shorter periods, different times each day
                                if day % 3 == 0:
                                    periods = [(9, 13, AvailabilityType.AVAILABLE)]  # Morning
                                elif day % 3 == 1:
                                    periods = [(14, 18, AvailabilityType.AVAILABLE)]  # Afternoon
                                else:
                                    periods = [(16, 20, AvailabilityType.PREFERRED)]  # Evening preferred
                            
                            # Create hour-by-hour availability entries
                            for start_hour, end_hour, avail_type in periods:
                                for hour in range(start_hour, end_hour):
                                    availability = EmployeeAvailability(
                                        employee_id=employee.id,
                                        is_recurring=True,
                                        day_of_week=day,
                                        hour=hour,
                                        is_available=True,
                                        availability_type=avail_type
                                    )
                                    employee_availabilities.append(availability)
                        
                        # Add all availabilities for this employee
                        all_availabilities.extend(employee_availabilities)
                        logging.info(f"Generated {len(employee_availabilities)} availability entries for employee {employee.employee_id}")
                    except Exception as e:
                        logging.error(f"Error generating availability for employee {employee.employee_id}: {str(e)}")
                
                # Save all availabilities
                if all_availabilities:
                    # Insert in chunks of 1000
                    chunk_size = 1000
                    for i in range(0, len(all_availabilities), chunk_size):
                        chunk = all_availabilities[i:i+chunk_size]
                        db.session.bulk_save_objects(chunk)
                        db.session.commit()
                        logging.info(f"Saved chunk {i//chunk_size + 1} of availabilities ({len(chunk)} entries)")
                    
                    statistics["availabilities"] = len(all_availabilities)
                    logging.info(f"Successfully inserted {len(all_availabilities)} availability entries")
                    update_progress(80, "availabilities_created")
                else:
                    logging.error("No availabilities were generated")
                    update_progress(80, "no_availabilities_generated", "No availabilities were generated")
            except Exception as e:
                logging.error(f"Error with availability generation: {str(e)}")
                logging.error(traceback.format_exc())
                db.session.rollback()
                update_progress(80, "error_with_availabilities", str(e))

            # STEP 5: Generate absences for employees - IMPORTANT!
            update_progress(85, "generating_absences")
            try:
                logging.info("Generating employee absences...")
                if not employees:
                    employees = Employee.query.all()
                
                if not employees:
                    raise ValueError("No employees found for absence generation")
                
                all_absences = []
                today = date.today()
                date_range = 90  # Generate absences for the next 3 months
                
                # Define absence types
                absence_types = {
                    "URL": {"duration": (5, 14)},  # Vacation: 5-14 days
                    "ABW": {"duration": (1, 5)},   # Absent/Sick: 1-5 days
                    "SLG": {"duration": (1, 3)}    # Training: 1-3 days
                }
                
                # Generate absences for each employee
                for i, employee in enumerate(employees):
                    logging.info(f"Generating absences for employee {employee.employee_id} ({i+1}/{len(employees)})")
                    
                    # Vacation - Everyone gets at least one
                    vacation_start = today + timedelta(days=random.randint(7, 60))
                    vacation_duration = random.randint(5, 14)
                    vacation_end = vacation_start + timedelta(days=vacation_duration - 1)
                    
                    vacation = Absence(
                        employee_id=employee.id,
                        absence_type_id="URL",
                        start_date=vacation_start,
                        end_date=vacation_end,
                        note=f"Vacation for {employee.first_name} {employee.last_name}"
                    )
                    all_absences.append(vacation)
                    
                    # 70% chance of sick leave
                    if random.random() < 0.7:
                        sick_start = today + timedelta(days=random.randint(1, 85))
                        sick_duration = random.randint(1, 5)
                        sick_end = sick_start + timedelta(days=sick_duration - 1)
                        
                        sick = Absence(
                            employee_id=employee.id,
                            absence_type_id="ABW",
                            start_date=sick_start,
                            end_date=sick_end,
                            note=f"Sick leave for {employee.first_name} {employee.last_name}"
                        )
                        all_absences.append(sick)
                    
                    # 50% chance of training
                    if random.random() < 0.5:
                        training_start = today + timedelta(days=random.randint(14, 75))
                        training_duration = random.randint(1, 3)
                        training_end = training_start + timedelta(days=training_duration - 1)
                        
                        training = Absence(
                            employee_id=employee.id,
                            absence_type_id="SLG",
                            start_date=training_start,
                            end_date=training_end,
                            note=f"Training for {employee.first_name} {employee.last_name}"
                        )
                        all_absences.append(training)
                
                # Save all absences
                if all_absences:
                    # Insert in chunks of 100
                    chunk_size = 100
                    for i in range(0, len(all_absences), chunk_size):
                        chunk = all_absences[i:i+chunk_size]
                        db.session.bulk_save_objects(chunk)
                        db.session.commit()
                        logging.info(f"Saved chunk {i//chunk_size + 1} of absences ({len(chunk)} entries)")
                    
                    statistics["absences"] = len(all_absences)
                    logging.info(f"Successfully inserted {len(all_absences)} absences")
                    update_progress(95, "absences_created")
                else:
                    logging.error("No absences were generated")
                    update_progress(95, "no_absences_generated", "No absences were generated")
            except Exception as e:
                logging.error(f"Error with absence generation: {str(e)}")
                logging.error(traceback.format_exc())
                db.session.rollback()
                update_progress(95, "error_with_absences", str(e))

            # Update settings with statistics
            update_progress(98, "finalizing")
            try:
                # Get fresh settings in case they were updated
                settings = Settings.query.first()
                settings.actions_demo_data.update({
                    "statistics": statistics,
                    "last_execution": datetime.utcnow().isoformat(),
                    "status": "completed",
                    "progress": 100,
                    "end_time": datetime.utcnow().isoformat()
                })
                db.session.commit()
                update_progress(100, "completed")
                logging.info(f"Task completed successfully with statistics: {statistics}")
            except Exception as e:
                logging.error(f"Error updating settings: {str(e)}")
                logging.error(traceback.format_exc())
                db.session.rollback()
                update_progress(98, "error_updating_settings", str(e))

        except Exception as e:
            logging.error(f"Background task failed: {str(e)}")
            logging.error(traceback.format_exc())
            update_progress(0, "failed", str(e))
            db.session.rollback()
