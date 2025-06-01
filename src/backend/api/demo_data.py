from datetime import datetime, date, timedelta, UTC
import random
import logging
import os
import warnings
from functools import wraps
from flask import Blueprint, jsonify, request, make_response, Response
from http import HTTPStatus
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

bp = Blueprint("demo_data", __name__, url_prefix="/demo-data")


def production_safeguard(f):
    """Decorator to prevent demo data generation in production environment"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check environment variables for production indicators
        env = os.environ.get("FLASK_ENV", "development").lower()
        app_env = os.environ.get("APP_ENV", "development").lower()
        
        # Block in production environments
        if env in ["production", "prod"] or app_env in ["production", "prod"]:
            return jsonify({
                "error": "Demo data generation is disabled in production environment",
                "status": "forbidden"
            }), HTTPStatus.FORBIDDEN
        
        # Additional check for production database URLs
        db_url = os.environ.get("DATABASE_URL", "")
        if any(prod_indicator in db_url.lower() for prod_indicator in ["prod", "production"]):
            return jsonify({
                "error": "Demo data generation is disabled for production databases",
                "status": "forbidden"
            }), HTTPStatus.FORBIDDEN
        
        return f(*args, **kwargs)
    return decorated_function


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
            contracted_hours = random.randint(5, 10)
            logging.info(
                f"GFB employee: {first_name} {last_name}, contracted_hours: {contracted_hours}"
            )

        employee = Employee(
            employee_id=employee_id,
            first_name=first_name,
            last_name=last_name,
            employee_group=emp_type["id"],
            contracted_hours=contracted_hours,
            is_keyholder=emp_type["id"] != "GFB",
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


def generate_improved_availability_data(employees):
    """
    Generate realistic availability data that looks like real employee availability patterns:
    - Start with mostly AVAILABLE for business hours
    - Add strategic UNAVAILABLE blocks (lunch, personal commitments)
    - Add FIXED/PREFERRED blocks for specific regular commitments
    - Make patterns day-based and block-based, not scattered individual hours
    """
    availabilities = []
    daily_employee_day_type = {}
    employee_weekly_hours = {emp.id: 0.0 for emp in employees}
    working_days_indices = list(range(0, 6))  # Monday to Saturday
    today = date.today()
    start_of_week_date = today - timedelta(days=today.weekday())

    # Define business hours (when the store is typically open)
    business_start = 9
    business_end = 20

    for employee in employees:
        contracted_hours = employee.contracted_hours
        employee_type = employee.employee_group
        
        # Determine working days based on employee type
        if contracted_hours >= 35:  # Full-time employees (VZ, TL)
            work_days = random.sample(working_days_indices, 5)  # 5 days per week
        elif contracted_hours >= 15:  # Part-time employees (TZ)
            work_days = random.sample(working_days_indices, random.randint(3, 5))  # 3-5 days
        else:  # Low-hour employees (GFB)
            work_days = random.sample(working_days_indices, random.randint(2, 4))  # 2-4 days
        
        for day_idx in range(6):  # Process all days Monday-Saturday
            day_date_obj = start_of_week_date + timedelta(days=day_idx)
            
            if day_idx in work_days:
                # This is a working day - create realistic availability pattern
                
                # Step 1: Start with AVAILABLE for most business hours
                for hour in range(business_start, business_end):
                    avail_slot = EmployeeAvailability(
                        employee_id=employee.id,
                        day_of_week=day_idx,
                        hour=hour,
                        is_available=True,
                        availability_type=AvailabilityType.AVAILABLE,
                        start_date=day_date_obj,
                        end_date=day_date_obj,
                        is_recurring=False,
                    )
                    availabilities.append(avail_slot)
                
                # Step 2: Keep most hours as AVAILABLE (minimal unavailable blocks)
                unavailable_blocks = []
                
                # Only add occasional unavailable blocks for variety (10% chance)
                if random.random() < 0.1:
                    block_start = random.choice([10, 11, 14, 15, 16])
                    block_duration = random.choice([1, 2])
                    if block_start + block_duration <= business_end:
                        unavailable_blocks.append((block_start, block_start + block_duration))
                
                # Apply unavailable blocks
                for start_hour, end_hour in unavailable_blocks:
                    for hour in range(start_hour, end_hour):
                        if business_start <= hour < business_end:
                            # Find and remove the AVAILABLE slot for this hour
                            availabilities = [a for a in availabilities if not (
                                a.employee_id == employee.id and 
                                a.day_of_week == day_idx and 
                                a.hour == hour
                            )]
                            # Add UNAVAILABLE slot
                            unavail_slot = EmployeeAvailability(
                                employee_id=employee.id,
                                day_of_week=day_idx,
                                hour=hour,
                                is_available=False,
                                availability_type=AvailabilityType.UNAVAILABLE,
                                start_date=day_date_obj,
                                end_date=day_date_obj,
                                is_recurring=False,
                            )
                            availabilities.append(unavail_slot)
                
                # Step 3: Add FIXED blocks for regular commitments
                fixed_blocks = []
                
                if contracted_hours >= 35:  # Full-time employees
                    # 60% chance of having a fixed block (regular shift pattern)
                    if random.random() < 0.6:
                        # Fixed morning or afternoon block
                        if random.choice([True, False]):  # Morning fixed block
                            fixed_start = random.choice([9, 10])
                            fixed_duration = random.randint(3, 5)
                            fixed_blocks.append((fixed_start, fixed_start + fixed_duration))
                        else:  # Afternoon fixed block
                            fixed_start = random.choice([13, 14])
                            fixed_duration = random.randint(3, 5)
                            fixed_blocks.append((fixed_start, fixed_start + fixed_duration))
                
                elif contracted_hours >= 15:  # Part-time employees
                    # 40% chance of having a fixed block
                    if random.random() < 0.4:
                        fixed_start = random.choice([10, 11, 13, 14])
                        fixed_duration = random.randint(2, 4)
                        fixed_blocks.append((fixed_start, fixed_start + fixed_duration))
                
                # Apply fixed blocks (only if not conflicting with unavailable)
                for start_hour, end_hour in fixed_blocks:
                    conflict = False
                    for unavail_start, unavail_end in unavailable_blocks:
                        if not (end_hour <= unavail_start or start_hour >= unavail_end):
                            conflict = True
                            break
                    
                    if not conflict:
                        for hour in range(start_hour, end_hour):
                            if business_start <= hour < business_end:
                                # Find and replace AVAILABLE with FIXED
                                availabilities = [a for a in availabilities if not (
                                    a.employee_id == employee.id and 
                                    a.day_of_week == day_idx and 
                                    a.hour == hour
                                )]
                                fixed_slot = EmployeeAvailability(
                                    employee_id=employee.id,
                                    day_of_week=day_idx,
                                    hour=hour,
                                    is_available=True,
                                    availability_type=AvailabilityType.FIXED,
                                    start_date=day_date_obj,
                                    end_date=day_date_obj,
                                    is_recurring=False,
                                )
                                availabilities.append(fixed_slot)
                
                # Step 4: Add PREFERRED blocks for flexible preferences
                preferred_blocks = []
                
                # 30% chance of having preferred hours
                if random.random() < 0.3:
                    # Preferred early morning or late evening
                    if random.choice([True, False]) and business_start > 8:  # Early morning
                        pref_start = 8
                        pref_duration = random.randint(1, 2)
                        preferred_blocks.append((pref_start, pref_start + pref_duration))
                    else:  # Late evening
                        pref_start = random.choice([18, 19])
                        pref_duration = random.randint(1, 2)
                        if pref_start + pref_duration <= 21:  # Don't go too late
                            preferred_blocks.append((pref_start, pref_start + pref_duration))
                
                # Apply preferred blocks (extend beyond business hours if needed)
                for start_hour, end_hour in preferred_blocks:
                    for hour in range(start_hour, end_hour):
                        if 8 <= hour <= 21:  # Extended hours for preferred
                            # Check if this hour already has availability
                            existing = [a for a in availabilities if (
                                a.employee_id == employee.id and 
                                a.day_of_week == day_idx and 
                                a.hour == hour
                            )]
                            
                            if not existing:  # Only add if no existing availability
                                pref_slot = EmployeeAvailability(
                                    employee_id=employee.id,
                                    day_of_week=day_idx,
                                    hour=hour,
                                    is_available=True,
                                    availability_type=AvailabilityType.PREFERRED,
                                    start_date=day_date_obj,
                                    end_date=day_date_obj,
                                    is_recurring=False,
                                )
                                availabilities.append(pref_slot)
            
            else:
                # This is a non-working day - mostly unavailable with some flexibility
                
                # 80% chance of being completely unavailable on non-working days
                if random.random() < 0.8:
                    for hour in range(business_start, business_end):
                        unavail_slot = EmployeeAvailability(
                            employee_id=employee.id,
                            day_of_week=day_idx,
                            hour=hour,
                            is_available=False,
                            availability_type=AvailabilityType.UNAVAILABLE,
                            start_date=day_date_obj,
                            end_date=day_date_obj,
                            is_recurring=False,
                        )
                        availabilities.append(unavail_slot)
                else:
                    # 20% chance of some availability (flexible employees)
                    # Add a few available hours scattered throughout the day
                    available_hours = random.sample(
                        range(business_start, business_end), 
                        random.randint(2, 5)
                    )
                    
                    for hour in range(business_start, business_end):
                        if hour in available_hours:
                            avail_slot = EmployeeAvailability(
                                employee_id=employee.id,
                                day_of_week=day_idx,
                                hour=hour,
                                is_available=True,
                                availability_type=AvailabilityType.AVAILABLE,
                                start_date=day_date_obj,
                                end_date=day_date_obj,
                                is_recurring=False,
                            )
                            availabilities.append(avail_slot)
                        else:
                            unavail_slot = EmployeeAvailability(
                                employee_id=employee.id,
                                day_of_week=day_idx,
                                hour=hour,
                                is_available=False,
                                availability_type=AvailabilityType.UNAVAILABLE,
                                start_date=day_date_obj,
                                end_date=day_date_obj,
                                is_recurring=False,
                            )
                            availabilities.append(unavail_slot)
        
        # Calculate total weekly hours for this employee
        weekly_hours = len([a for a in availabilities if a.employee_id == employee.id and a.is_available])
        employee_weekly_hours[employee.id] = weekly_hours

    return availabilities, daily_employee_day_type, employee_weekly_hours


def validate_and_log_availability_distribution(employees, availabilities):
    """
    Validate and log the availability distribution to ensure it's realistic.
    This helps with debugging and transparency.
    """
    logging.info("=== Availability Distribution Analysis ===")
    
    # Group availabilities by employee
    employee_availabilities = {}
    for avail in availabilities:
        if avail.employee_id not in employee_availabilities:
            employee_availabilities[avail.employee_id] = {
                'FIXED': 0,
                'PREFERRED': 0,
                'AVAILABLE': 0,
                'UNAVAILABLE': 0,
                'total': 0
            }
        employee_availabilities[avail.employee_id][avail.availability_type.value] += 1
        employee_availabilities[avail.employee_id]['total'] += 1
    
    # Analyze by employee type
    type_stats = {}
    for employee in employees:
        emp_type = employee.employee_group
        contracted_hours = employee.contracted_hours
        
        if emp_type not in type_stats:
            type_stats[emp_type] = {
                'count': 0,
                'avg_contracted_hours': 0,
                'avg_fixed_hours': 0,
                'avg_preferred_hours': 0,
                'avg_available_hours': 0,
                'avg_total_hours': 0,
                'fixed_exceeds_contracted': 0
            }
        
        type_stats[emp_type]['count'] += 1
        type_stats[emp_type]['avg_contracted_hours'] += contracted_hours
        
        if employee.id in employee_availabilities:
            avail_data = employee_availabilities[employee.id]
            fixed_hours = avail_data['FIXED']
            preferred_hours = avail_data['PREFERRED']
            available_hours = avail_data['AVAILABLE']
            total_hours = avail_data['total']
            
            type_stats[emp_type]['avg_fixed_hours'] += fixed_hours
            type_stats[emp_type]['avg_preferred_hours'] += preferred_hours
            type_stats[emp_type]['avg_available_hours'] += available_hours
            type_stats[emp_type]['avg_total_hours'] += total_hours
            
            # Check if fixed hours exceed contracted hours (this should not happen)
            if fixed_hours > contracted_hours:
                type_stats[emp_type]['fixed_exceeds_contracted'] += 1
                logging.warning(
                    f"Employee {employee.employee_id} ({emp_type}) has {fixed_hours} FIXED hours "
                    f"but only {contracted_hours} contracted hours!"
                )
    
    # Calculate averages and log results
    for emp_type, stats in type_stats.items():
        count = stats['count']
        if count > 0:
            avg_contracted = stats['avg_contracted_hours'] / count
            avg_fixed = stats['avg_fixed_hours'] / count
            avg_preferred = stats['avg_preferred_hours'] / count
            avg_available = stats['avg_available_hours'] / count
            avg_total = stats['avg_total_hours'] / count
            
            logging.info(f"\n{emp_type} employees ({count} total):")
            logging.info(f"  Average contracted hours: {avg_contracted:.1f}")
            logging.info(f"  Average FIXED hours: {avg_fixed:.1f}")
            logging.info(f"  Average PREFERRED hours: {avg_preferred:.1f}")
            logging.info(f"  Average AVAILABLE hours: {avg_available:.1f}")
            logging.info(f"  Average total availability: {avg_total:.1f}")
            logging.info(f"  Fixed/Contracted ratio: {(avg_fixed/avg_contracted)*100:.1f}%")
            
            if stats['fixed_exceeds_contracted'] > 0:
                logging.error(f"  ⚠️  {stats['fixed_exceeds_contracted']} employees have FIXED hours exceeding contracted hours!")
            else:
                logging.info(f"  ✅ All employees have FIXED hours within contracted limits")
    
    logging.info(f"\nTotal availability records created: {len(availabilities)}")
    logging.info("=== End Availability Analysis ===\n")


def generate_shift_templates():
    """Generate demo shift templates with preset times"""
    logging.info("Generating shift templates...")

    # Delete existing shift templates
    ShiftTemplate.query.delete()
    db.session.commit()

    # Preset shift times as requested
    preset_shifts = [
        ("09:00", "14:00"),  # 5h - no break
        ("10:00", "14:00"),  # 4h - no break
        ("11:00", "14:00"),  # 3h - no break
        ("09:00", "12:00"),  # 3h - no break
        ("09:00", "13:00"),  # 4h - no break
        ("14:00", "20:00"),  # 6h - no break
        ("14:00", "19:00"),  # 5h - no break
        ("14:00", "18:00"),  # 4h - no break
        ("14:00", "17:00"),  # 3h - no break
        ("17:00", "20:00"),  # 3h - no break
        ("16:00", "20:00"),  # 4h - no break
        ("15:00", "20:00"),  # 5h - no break
        ("09:00", "20:00"),  # 11h - requires break
        ("09:00", "16:00"),  # 7h - requires break
        ("09:00", "19:00"),  # 10h - requires break
        ("09:00", "18:00"),  # 9h - requires break
    ]

    def determine_shift_type(start_time, end_time):
        """Determine shift type based on start and end times"""
        start_hour = int(start_time.split(':')[0])
        end_hour = int(end_time.split(':')[0])
        
        # EARLY: starting from 9 or 10
        if start_hour in [9, 10]:
            return ShiftType.EARLY
        # LATE: ending 19 or 20
        elif end_hour in [19, 20]:
            return ShiftType.LATE
        # MIDDLE: not EARLY and not LATE
        else:
            return ShiftType.MIDDLE

    def calculate_duration_hours(start_time, end_time):
        """Calculate duration in hours"""
        start_hour, start_min = map(int, start_time.split(':'))
        end_hour, end_min = map(int, end_time.split(':'))
        
        start_total_min = start_hour * 60 + start_min
        end_total_min = end_hour * 60 + end_min
        
        # Handle overnight shifts (though none in our preset)
        if end_total_min <= start_total_min:
            end_total_min += 24 * 60
        
        duration_min = end_total_min - start_total_min
        return duration_min / 60.0

    shift_templates = []
    for start_time, end_time in preset_shifts:
        duration = calculate_duration_hours(start_time, end_time)
        requires_break = duration > 6.0  # Break required for shifts longer than 6h
        shift_type = determine_shift_type(start_time, end_time)
        
        template = ShiftTemplate(
            start_time=start_time,
            end_time=end_time,
            requires_break=requires_break,
            shift_type=shift_type,
        )
        
        # Calculate duration and validate
        template._calculate_duration()
        template.validate()
        shift_templates.append(template)
        
        logging.info(f"Created shift template: {start_time}-{end_time} ({duration:.1f}h, "
                    f"break: {requires_break}, type: {shift_type.value})")

    # Add all templates to session
    db.session.add_all(shift_templates)

    try:
        db.session.commit()
        logging.info(f"Successfully created {len(shift_templates)} shift templates")
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating shift templates: {str(e)}")
        raise

    return shift_templates


@bp.route("/", methods=["POST", "OPTIONS"])
@bp.route("", methods=["POST", "OPTIONS"])
@production_safeguard
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

        logging.info(
            f"Generating demo data for module: {module}, num_employees: {num_employees}"
        )

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
            employees = generate_improved_employee_data(num_employees_override=num_employees)
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
                availabilities, _, _ = generate_improved_availability_data(employees)
                
                # Validate and log the availability distribution
                validate_and_log_availability_distribution(employees, availabilities)
                
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
            availabilities, _, _ = generate_improved_availability_data(employees)
            
            # Validate and log the availability distribution
            validate_and_log_availability_distribution(employees, availabilities)
            
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
                "last_execution": datetime.now(UTC).isoformat(),
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
                "timestamp": datetime.now(UTC).isoformat(),
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
    logging.info(
        f"Starting to generate improved employee data. Override: {num_employees_override}"
    )

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
        logging.info(
            f"Generating specified number of employees: {num_employees_override}"
        )
        for _ in range(num_employees_override):
            emp_type = random.choice(employee_types)
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)

            base_id = f"{first_name[0]}{last_name[:2]}".upper()
            employee_id = f"{base_id}{employee_id_counter:02d}"
            employee_id_counter += 1

            # Contracted hours based on chosen emp_type
            contracted_hours = random.randint(
                emp_type["min_hours"], emp_type["max_hours"]
            )
            if (
                emp_type["id"] in ["VZ", "TL"] and contracted_hours < 35
            ):  # Ensure VZ/TL have at least 35
                contracted_hours = 40.0
            elif (
                emp_type["id"] == "GFB" and contracted_hours > 10
            ):  # Cap GFB at 10 (was 14)
                contracted_hours = 10.0
            elif (
                emp_type["id"] == "TZ" and contracted_hours < 10
            ):  # Ensure TZ has at least 10
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
                    email=f"employee{employee_id_counter}@example.com",  # Use unique counter for email
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
                        email=f"employee{employee_id_counter}@example.com",  # Use unique counter for email
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


def generate_improved_absences(employees):
    """Generate realistic absences for 20% of employees with dates surrounding current date"""
    logging.info("Generating improved absences for 20% of employees...")

    absences = []
    today = date.today()
    
    # Generate absences in a range surrounding the current date (2 months before to 2 months after)
    date_range_start = today - timedelta(days=60)  # 2 months before
    date_range_end = today + timedelta(days=60)    # 2 months after
    total_date_range = (date_range_end - date_range_start).days

    # Define absence types with their typical durations
    absence_types = {
        "URL": {  # Vacation
            "min_duration": 5,
            "max_duration": 14,
            "weight": 0.5,  # 50% of absences will be vacation
        },
        "ABW": {  # Absent
            "min_duration": 1,
            "max_duration": 3,
            "weight": 0.3,  # 30% of absences will be sick/absent
        },
        "SLG": {  # Training
            "min_duration": 1,
            "max_duration": 3,
            "weight": 0.2,  # 20% of absences will be training
        },
    }

    # Select 20% of employees to have absences
    num_employees_with_absences = max(1, int(len(employees) * 0.2))
    employees_with_absences = random.sample(employees, num_employees_with_absences)
    
    logging.info(f"Selected {num_employees_with_absences} out of {len(employees)} employees to have absences")
    logging.info(f"Date range: {date_range_start} to {date_range_end} ({total_date_range} days)")

    for employee in employees_with_absences:
        # Each selected employee gets 1-2 absence periods
        num_absences = random.randint(1, 2)
        logging.info(f"Processing employee {employee.employee_id} for {num_absences} absences")
        
        for _ in range(num_absences):
            # Select absence type based on weights
            absence_type = random.choices(
                list(absence_types.keys()),
                weights=[config["weight"] for config in absence_types.values()],
                k=1
            )[0]
            
            config = absence_types[absence_type]
            
            # Determine duration
            duration = random.randint(config["min_duration"], config["max_duration"])

            # Find a suitable start date
            attempts = 0
            max_attempts = 20
            valid_date_found = False

            while attempts < max_attempts and not valid_date_found:
                # Random start date within the surrounding date range
                max_offset = max(0, total_date_range - duration)
                if max_offset <= 0:
                    logging.warning(f"Duration {duration} is too long for date range {total_date_range}")
                    break
                    
                days_offset = random.randint(0, max_offset)
                start_date_obj = date_range_start + timedelta(days=days_offset)
                end_date_obj = start_date_obj + timedelta(days=duration - 1)

                # Ensure we don't go beyond our date range
                if end_date_obj > date_range_end:
                    attempts += 1
                    continue

                # Check if this period overlaps with existing absences for this employee
                overlaps = False
                for existing in absences:
                    if existing.employee_id == employee.id and not (
                        end_date_obj < existing.start_date
                        or start_date_obj > existing.end_date
                    ):
                        overlaps = True
                        break

                if not overlaps:
                    valid_date_found = True
                    absence = Absence(
                        employee_id=employee.id,
                        absence_type_id=absence_type,
                        start_date=start_date_obj,
                        end_date=end_date_obj,
                        note=f"Generated {absence_type} absence",
                    )
                    absences.append(absence)
                    logging.info(
                        f"Created {absence_type} absence for {employee.employee_id} "
                        f"from {start_date_obj} to {end_date_obj}"
                    )

                attempts += 1

            if not valid_date_found:
                logging.warning(
                    f"Could not find valid date for {absence_type} absence for employee {employee.employee_id}"
                )

    logging.info(f"Generated {len(absences)} total absences for {num_employees_with_absences} employees")
    return absences


@bp.route("/optimized", methods=["POST", "OPTIONS"])
@bp.route("/optimized/", methods=["POST", "OPTIONS"])
@production_safeguard
def generate_optimized_demo_data():
    """Generate optimized demo data with diverse shift patterns."""
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

        logging.info(
            f"Generating optimized demo data with diverse shift patterns, num_employees_override: {num_employees_override}"
        )

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
            employees = generate_improved_employee_data(
                num_employees_override=num_employees_override
            )
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
        availabilities, daily_employee_day_type, employee_weekly_hours = (
            generate_improved_availability_data(employees)
        )
        
        # Validate and log the availability distribution
        validate_and_log_availability_distribution(employees, availabilities)
        
        db.session.add_all(availabilities)
        db.session.commit()
        logging.info(f"Successfully created {len(availabilities)} availabilities")

        # Generate absences
        try:
            logging.info("Generating employee absences...")
            # Refresh employees from database to ensure they have proper IDs
            fresh_employees = Employee.query.all()
            logging.info(f"Fetched {len(fresh_employees)} employees from database for absence generation")
            absences = generate_improved_absences(fresh_employees)
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
            "last_execution": datetime.now(UTC).isoformat(),
        }
        db.session.commit()
        logging.info("Successfully updated settings")

        return jsonify(
            {
                "message": "Successfully generated optimized demo data with realistic schedules",
                "timestamp": datetime.now(UTC).isoformat(),
            }
        ), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        logging.error(f"Failed to generate optimized demo data: {str(e)}")
        return jsonify(
            {
                "error": "Failed to generate optimized demo data",
                "details": str(e),
            }
        ), HTTPStatus.INTERNAL_SERVER_ERROR


def generate_optimized_shift_templates():
    """Generate optimized shift templates with preset times"""
    return generate_shift_templates()
