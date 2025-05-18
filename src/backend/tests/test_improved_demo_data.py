#!/usr/bin/env python
"""
Script to test the improved demo data generation and schedule generation.
This version directly implements the data generation functions in the script
to avoid conflicts with the demo_data blueprint in the app.
"""

from src.backend.app import create_app
from datetime import date, timedelta
import sys
import logging
import random
from src.backend.models import (
    db,
    Settings,
    Employee,
    Coverage,
    EmployeeAvailability,
    ShiftTemplate,
)
from src.backend.models.employee import AvailabilityType
from src.backend.models.fixed_shift import ShiftType
from src.backend.services.scheduler import ScheduleGenerator

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Copy of the improved functions from demo_data.py
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
            db.session.add(employee)

    db.session.commit()
    return employees


def generate_improved_coverage_data():
    """Generate optimized coverage data with reasonable staffing requirements"""
    # Get store settings
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()

    # Clear existing coverage data
    Coverage.query.delete()
    db.session.commit()

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

    for slot in coverage_slots:
        db.session.add(slot)

    db.session.commit()
    return coverage_slots


def generate_improved_availability_data(employees):
    """Generate optimized availability data ensuring coverage requirements are met"""
    # Clear existing availability data
    EmployeeAvailability.query.delete()
    db.session.commit()

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
                    db.session.add(availability)

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
                db.session.add(availability)

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
                db.session.add(availability)

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
                db.session.add(availability)

    # Step 5: Add some random preferred availability to increase flexibility
    for employee in employees:
        # 30% chance to add some preferred hours
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
                        availability_type=AvailabilityType.PREFERRED,
                    )
                    availabilities.append(availability)
                    db.session.add(availability)

    db.session.commit()
    return availabilities


def generate_improved_shift_templates():
    """Generate optimized shift templates aligned with coverage requirements"""
    logger.info("Generating optimized shift templates...")

    # Delete existing shift templates
    ShiftTemplate.query.delete()
    db.session.commit()

    shift_templates = [
        # Full-time shifts (8 hours) that align with coverage slots
        ShiftTemplate(
            start_time="08:00",
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
        logger.info(f"Successfully created {len(shift_templates)} shift templates")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating shift templates: {str(e)}")
        raise

    return shift_templates


def test_improved_demo_data():
    """Generate improved demo data and test scheduling"""
    logger.info("Starting improved demo data generation...")

    # Create app context
    app = create_app()  # Remove the testing parameter as it's not supported
    with app.app_context():
        try:
            # Step 1: Clear existing schedule data
            logger.info("Clearing existing schedule data...")
            from src.backend.models import Schedule

            Schedule.query.delete()
            db.session.commit()

            # Step 2: Generate improved demo data
            logger.info("Generating improved shift templates...")
            shift_templates = generate_improved_shift_templates()

            logger.info("Generating improved employee data...")
            employees = generate_improved_employee_data()

            logger.info("Generating improved coverage data...")
            coverage_slots = generate_improved_coverage_data()

            logger.info("Generating improved availability data...")
            availabilities = generate_improved_availability_data(employees)

            # Step 3: Test schedule generation
            logger.info("Testing schedule generation...")

            today = date.today()
            start_date = today
            end_date = today + timedelta(days=6)

            result = ScheduleGenerator().generate_schedule(
                start_date=start_date, end_date=end_date, create_empty_schedules=True
            )

            # Step 4: Analyze results
            schedule_entries = result.get("schedule", [])
            logger.info(f"Generated {len(schedule_entries)} schedule entries")

            # Check for entries with shifts
            entries_with_shifts = [
                e for e in schedule_entries if e.get("shift_id") is not None
            ]
            entries_with_shifts_count = len(entries_with_shifts)
            logger.info(f"Entries with assigned shifts: {entries_with_shifts_count}")

            # Check for warnings
            warnings = result.get("warnings", [])
            logger.info(f"Warnings: {len(warnings)}")
            for i, warning in enumerate(warnings[:5]):
                if i == 0:
                    logger.info("Example warnings:")
                logger.info(
                    f"  {i + 1}. {warning.get('message')} ({warning.get('type')})"
                )
                if i == 4 and len(warnings) > 5:
                    logger.info(f"  ... and {len(warnings) - 5} more")

            # Check database for saved entries
            db_entries = Schedule.query.filter(
                Schedule.date >= start_date, Schedule.date <= end_date
            ).all()
            logger.info(f"Entries in database for date range: {len(db_entries)}")

            # Check for entries with shifts
            db_entries_with_shifts = [e for e in db_entries if e.shift_id is not None]
            logger.info(
                f"Database entries with assigned shifts: {len(db_entries_with_shifts)}"
            )

            # Success criteria: we should have assigned shifts
            if len(db_entries_with_shifts) > 0:
                logger.info(
                    "SUCCESS: Schedule entries have been created and shifts have been assigned!"
                )

                # Show which days have assigned shifts
                days_with_shifts = {}
                for entry in db_entries_with_shifts:
                    day_str = entry.date.strftime("%Y-%m-%d (%A)")
                    if day_str not in days_with_shifts:
                        days_with_shifts[day_str] = 0
                    days_with_shifts[day_str] += 1

                logger.info("Shifts assigned by day:")
                for day, count in sorted(days_with_shifts.items()):
                    logger.info(f"  {day}: {count} shifts")

                return True
            else:
                logger.warning("WARNING: No shifts were assigned in the schedule!")
                return False

        except Exception as e:
            logger.error(f"Error: {e}")
            import traceback

            traceback.print_exc()
            return False


if __name__ == "__main__":
    success = test_improved_demo_data()
    sys.exit(0 if success else 1)
