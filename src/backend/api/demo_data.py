from flask import Blueprint, jsonify, request
from models import db, Settings, Employee, Coverage, EmployeeAvailability, ShiftTemplate
from models.employee import AvailabilityType
from models.fixed_shift import ShiftType
from http import HTTPStatus
from datetime import datetime
import random
import logging

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
            min_employees=2,
            max_employees=4,
            requires_break=True,
            shift_type=ShiftType.EARLY,
        ),
        ShiftTemplate(
            start_time="09:00",
            end_time="17:00",
            min_employees=2,
            max_employees=4,
            requires_break=True,
            shift_type=ShiftType.MIDDLE,
        ),
        ShiftTemplate(
            start_time="10:00",
            end_time="18:00",
            min_employees=2,
            max_employees=4,
            requires_break=True,
            shift_type=ShiftType.MIDDLE,
        ),
        ShiftTemplate(
            start_time="11:00",
            end_time="19:00",
            min_employees=2,
            max_employees=4,
            requires_break=True,
            shift_type=ShiftType.LATE,
        ),
        ShiftTemplate(
            start_time="12:00",
            end_time="20:00",
            min_employees=2,
            max_employees=4,
            requires_break=True,
            shift_type=ShiftType.LATE,
        ),
        # Part-time shifts (4-6 hours)
        ShiftTemplate(
            start_time="08:00",
            end_time="13:00",
            min_employees=1,
            max_employees=2,
            requires_break=False,
            shift_type=ShiftType.EARLY,
        ),
        ShiftTemplate(
            start_time="13:00",
            end_time="18:00",
            min_employees=1,
            max_employees=2,
            requires_break=False,
            shift_type=ShiftType.MIDDLE,
        ),
        ShiftTemplate(
            start_time="15:00",
            end_time="20:00",
            min_employees=1,
            max_employees=2,
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
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
        db.session.commit()

    # Clear all existing employees first
    Employee.query.delete()
    db.session.commit()

    # Define employee types with proper distribution
    employee_types = [
        {
            "id": "TL",
            "name": "Teamleiter",
            "min_hours": 35,
            "max_hours": 40,
            "count": 3,
        },
        {"id": "VZ", "name": "Vollzeit", "min_hours": 35, "max_hours": 40, "count": 7},
        {"id": "TZ", "name": "Teilzeit", "min_hours": 15, "max_hours": 34, "count": 12},
        {
            "id": "GFB",
            "name": "Geringfügig Beschäftigt",
            "min_hours": 0,
            "max_hours": 14,
            "count": 8,
        },
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
            elif emp_type["id"] == "TZ":
                contracted_hours = random.randint(20, 34)  # Part-time range
            else:  # GFB
                contracted_hours = random.randint(8, 14)  # Mini-job range

            # All TL and first 2 VZ employees are keyholders (ensures enough keyholders)
            is_keyholder = emp_type["id"] == "TL" or (emp_type["id"] == "VZ" and i < 2)

            employee = Employee(
                employee_id=employee_id,
                first_name=first_name,
                last_name=last_name,
                employee_group=emp_type["id"],
                contracted_hours=contracted_hours,
                is_keyholder=is_keyholder,
                is_active=True,
                email=f"employee{len(employees) + 1}@example.com",
                phone=f"+49 {random.randint(100, 999)} {random.randint(1000000, 9999999)}",
            )
            employees.append(employee)

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
                employee_types=["TL", "VZ", "TZ", "GFB"],
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
                employee_types=["TL", "VZ", "TZ", "GFB"],
                requires_keyholder=True,
                keyholder_before_minutes=0,
                keyholder_after_minutes=settings.keyholder_after_minutes,
            )
        )

    return coverage_slots


def generate_improved_availability_data(employees):
    """Generate optimized availability data ensuring coverage requirements are met"""
    availabilities = []

    # Group employees by type for easier assignment
    employee_groups = {
        "TL": [e for e in employees if e.employee_group == "TL"],
        "VZ": [e for e in employees if e.employee_group == "VZ"],
        "TZ": [e for e in employees if e.employee_group == "TZ"],
        "GFB": [e for e in employees if e.employee_group == "GFB"],
    }

    # Define working days (Monday to Saturday)
    working_days = range(1, 7)  # 1-6 (Monday-Saturday)

    # Step 1: Ensure keyholders have availability for each time slot
    # We need at least one keyholder available for each day and time slot
    keyholders = [e for e in employees if e.is_keyholder]

    # Assign keyholders to ensure coverage for all time slots
    for day in working_days:
        # Create a rotation of keyholders for morning and afternoon slots
        for slot_idx, (start_hour, end_hour) in enumerate([(9, 14), (14, 20)]):
            # Use a different keyholder for each slot to avoid overloading
            assigned_keyholders = []

            # Choose 2 keyholders for this slot
            slot_keyholders = random.sample(keyholders, min(2, len(keyholders)))
            assigned_keyholders.extend(slot_keyholders)

            # Set availability for chosen keyholders
            for keyholder in slot_keyholders:
                for hour in range(start_hour, end_hour):
                    availability = EmployeeAvailability(
                        employee_id=keyholder.id,
                        is_recurring=True,
                        day_of_week=day,
                        hour=hour,
                        is_available=True,
                        availability_type=AvailabilityType.FIXED,  # Keyholders get fixed schedules
                    )
                    availabilities.append(availability)

    # Step 2: Assign regular full-time employees (VZ) to shifts
    # Each VZ employee works 5 days per week with 8 hour shifts
    for employee in employee_groups["VZ"]:
        # Choose 5 random days for this employee
        work_days = random.sample(list(working_days), 5)

        for day in work_days:
            # Decide if morning or afternoon shift
            if random.random() < 0.5:  # Morning shift
                start_hour, end_hour = 9, 17  # 8-hour shift
            else:  # Afternoon shift
                start_hour, end_hour = 12, 20  # 8-hour shift

            for hour in range(start_hour, end_hour):
                availability = EmployeeAvailability(
                    employee_id=employee.id,
                    is_recurring=True,
                    day_of_week=day,
                    hour=hour,
                    is_available=True,
                    availability_type=AvailabilityType.AVAILABLE,
                )
                availabilities.append(availability)

    # Step 3: Assign part-time employees (TZ) to shifts
    # Each TZ employee works 3-4 days per week with 6-hour shifts
    for employee in employee_groups["TZ"]:
        work_days_count = random.randint(3, 4)
        work_days = random.sample(list(working_days), work_days_count)

        for day in work_days:
            # Assign to either morning, midday, or afternoon shift
            shift_type = random.choice(["morning", "midday", "afternoon"])

            if shift_type == "morning":
                start_hour, end_hour = 9, 15  # 6-hour shift
            elif shift_type == "midday":
                start_hour, end_hour = 11, 17  # 6-hour shift
            else:  # afternoon
                start_hour, end_hour = 14, 20  # 6-hour shift

            for hour in range(start_hour, end_hour):
                availability = EmployeeAvailability(
                    employee_id=employee.id,
                    is_recurring=True,
                    day_of_week=day,
                    hour=hour,
                    is_available=True,
                    availability_type=AvailabilityType.AVAILABLE,
                )
                availabilities.append(availability)

    # Step 4: Assign mini-job employees (GFB) to shifts
    # Each GFB employee works 2-3 days per week with 4-hour shifts
    for employee in employee_groups["GFB"]:
        work_days_count = random.randint(2, 3)
        work_days = random.sample(list(working_days), work_days_count)

        for day in work_days:
            # Assign to either morning or afternoon short shift
            if random.random() < 0.5:  # Morning shift
                start_hour, end_hour = 9, 13  # 4-hour shift
            else:  # Afternoon shift
                start_hour, end_hour = 16, 20  # 4-hour shift

            for hour in range(start_hour, end_hour):
                availability = EmployeeAvailability(
                    employee_id=employee.id,
                    is_recurring=True,
                    day_of_week=day,
                    hour=hour,
                    is_available=True,
                    availability_type=AvailabilityType.AVAILABLE,
                )
                availabilities.append(availability)

    # Step 5: Add some random promised availability to increase flexibility
    for employee in employees:
        # 30% chance to add some promised hours
        if random.random() < 0.3:
            # Pick a day they don't already have availability
            existing_days = set(
                a.day_of_week for a in availabilities if a.employee_id == employee.id
            )
            available_days = [day for day in working_days if day not in existing_days]

            if available_days:
                extra_day = random.choice(available_days)
                if random.random() < 0.5:  # Morning shift
                    start_hour, end_hour = 9, 14
                else:  # Afternoon shift
                    start_hour, end_hour = 14, 19

                for hour in range(start_hour, end_hour):
                    availability = EmployeeAvailability(
                        employee_id=employee.id,
                        is_recurring=True,
                        day_of_week=extra_day,
                        hour=hour,
                        is_available=True,
                        availability_type=AvailabilityType.PROMISE,
                    )
                    availabilities.append(availability)

    return availabilities


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
            min_employees=1,
            max_employees=3,
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
            min_employees=1,
            max_employees=3,
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
            min_employees=1,
            max_employees=3,
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
            end_time="15:00",
            min_employees=1,
            max_employees=3,
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
            min_employees=1,
            max_employees=3,
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
            min_employees=1,
            max_employees=3,
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
            min_employees=1,
            max_employees=2,
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
            min_employees=1,
            max_employees=2,
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
