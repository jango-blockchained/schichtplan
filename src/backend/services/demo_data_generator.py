import logging
import random
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List

from models import (
    Absence,
    Coverage,
    Employee,
    EmployeeAvailability,
    Settings,
    ShiftTemplate,
    db,
)
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

logger = logging.getLogger(__name__)


class DemoDataGenerator:
    """A class to handle all demo data generation logic with improved error handling and transaction management."""

    def __init__(self):
        self.settings = self._get_or_create_settings()
        self.retry_config = {
            "max_retries": 3,
            "retry_delay": 1,  # seconds
        }

    def _get_or_create_settings(self) -> Settings:
        """Get existing settings or create default ones."""
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()
        return settings

    def generate_employee_types(self) -> List[Dict[str, Any]]:
        """Generate employee type configurations."""
        return [
            {
                "id": "TL",
                "name": "Teamleiter",
                "min_hours": 35,
                "max_hours": 40,
                "count": 3,
            },
            {
                "id": "VZ",
                "name": "Vollzeit",
                "min_hours": 35,
                "max_hours": 40,
                "count": 7,
            },
            {
                "id": "TZ",
                "name": "Teilzeit",
                "min_hours": 15,
                "max_hours": 34,
                "count": 12,
            },
            {
                "id": "GFB",
                "name": "Geringfügig Beschäftigt",
                "min_hours": 0,
                "max_hours": 14,
                "count": 8,
            },
        ]

    def generate_absence_types(self) -> List[Dict[str, Any]]:
        """Generate absence type configurations."""
        return [
            {"id": "URL", "name": "Urlaub", "color": "#FF9800", "type": "absence"},
            {"id": "ABW", "name": "Abwesend", "color": "#F44336", "type": "absence"},
            {"id": "SLG", "name": "Schulung", "color": "#4CAF50", "type": "absence"},
        ]

    def _clear_existing_data(self):
        """Clear all existing data with proper transaction handling."""
        try:
            with db.session.begin_nested():
                db.session.execute(text("PRAGMA foreign_keys = OFF"))
                tables = [
                    EmployeeAvailability,
                    Coverage,
                    ShiftTemplate,
                    Employee,
                    Absence,
                ]
                for table in tables:
                    db.session.execute(text(f"DELETE FROM {table.__table__.name}"))
                db.session.execute(text("PRAGMA foreign_keys = ON"))
            logger.info("Successfully cleared existing data")
        except Exception as e:
            logger.error(f"Error clearing existing data: {e}")
            raise

    def _generate_employee_data(self) -> List[Employee]:
        """Generate employee data with proper distribution."""
        employee_types = self.generate_employee_types()
        employees = []
        employee_id_counter = 1

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
            "Mateo",
            "Sofia",
            "Mohammed",
            "Aisha",
            "Giulia",
            "Luca",
            "Yusuf",
            "Fatima",
            "Ivan",
            "Olga",
            "Pierre",
            "Chloe",
            "Juan",
            "Camila",
            "Andrei",
            "Elena",
            "Omar",
            "Leila",
            "Jin",
            "Yuna",
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
            "Rossi",
            "Bianchi",
            "Murano",
            "Ricci",
            "Yılmaz",
            "Demir",
            "Şahin",
            "Kaya",
            "Papadopoulos",
            "Nikolaidis",
            "Georgiou",
            "Dimitriou",
            "Dubois",
            "Lefevre",
            "Moreau",
            "Bernard",
            "Nowak",
            "Wójcik",
            "Lewandowski",
            "Zieliński",
        ]

        for emp_type in employee_types:
            for i in range(emp_type["count"]):
                first_name = random.choice(first_names)
                last_name = random.choice(last_names)

                base_id = f"{first_name[0]}{last_name[:2]}".upper()
                employee_id = f"{base_id}{employee_id_counter:02d}"
                employee_id_counter += 1

                contracted_hours = self._calculate_contracted_hours(emp_type["id"])
                is_keyholder = self._determine_keyholder_status(
                    emp_type["id"], i, contracted_hours
                )

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

    def _calculate_contracted_hours(self, employee_group: str) -> float:
        """Calculate contracted hours based on employee group."""
        if employee_group in ["VZ", "TL"]:
            return 40.0
        elif employee_group == "TZ":
            return random.randint(20, 34)
        else:  # GFB
            return random.randint(5, 10)

    def _determine_keyholder_status(
        self, employee_group: str, index: int, contracted_hours: float
    ) -> bool:
        """Determine if an employee should be a keyholder."""
        return (
            employee_group == "TL"
            or (employee_group == "VZ" and index < 2)
            or contracted_hours > 20
        )

    def _generate_coverage_data(self) -> List[Coverage]:
        """Generate coverage data with proper distribution."""
        coverage_slots = []
        for day_index in range(0, 6):  # Monday (0) to Saturday (5)
            coverage_slots.extend(
                [
                    Coverage(
                        day_index=day_index,
                        start_time="09:00",
                        end_time="14:00",
                        min_employees=1,
                        max_employees=2,
                        employee_types=["TL", "VZ", "TZ", "GFB"],
                        requires_keyholder=True,
                        keyholder_before_minutes=self.settings.keyholder_before_minutes,
                        keyholder_after_minutes=0,
                    ),
                    Coverage(
                        day_index=day_index,
                        start_time="14:00",
                        end_time="20:00",
                        min_employees=1,
                        max_employees=2,
                        employee_types=["TL", "VZ", "TZ", "GFB"],
                        requires_keyholder=True,
                        keyholder_before_minutes=0,
                        keyholder_after_minutes=self.settings.keyholder_after_minutes,
                    ),
                ]
            )
        return coverage_slots

    def _save_data_in_chunks(self, objects: List[Any], chunk_size: int = 1000):
        """Save data in chunks to avoid memory issues."""
        for i in range(0, len(objects), chunk_size):
            chunk = objects[i : i + chunk_size]
            with db.session.begin_nested():
                db.session.bulk_save_objects(chunk)
        logger.info(f"Saved {len(objects)} objects in chunks")

    def _generate_shift_templates(self) -> List[ShiftTemplate]:
        """Generate diverse shift templates that align with coverage requirements."""
        logger.info("Generating shift templates...")

        shift_templates = [
            # Full-time shifts (8 hours)
            ShiftTemplate(
                start_time="09:00",
                end_time="17:00",
                requires_break=True,
                shift_type="EARLY",
                active_days={
                    str(i): i != 0 for i in range(7)
                },  # All days except Sunday
            ),
            ShiftTemplate(
                start_time="10:00",
                end_time="18:00",
                requires_break=True,
                shift_type="MIDDLE",
                active_days={str(i): i != 0 for i in range(7)},
            ),
            ShiftTemplate(
                start_time="12:00",
                end_time="20:00",
                requires_break=True,
                shift_type="LATE",
                active_days={str(i): i != 0 for i in range(7)},
            ),
            # Part-time shifts (6 hours)
            ShiftTemplate(
                start_time="09:00",
                end_time="15:00",
                requires_break=False,
                shift_type="EARLY",
                active_days={str(i): i != 0 for i in range(7)},
            ),
            ShiftTemplate(
                start_time="11:00",
                end_time="17:00",
                requires_break=False,
                shift_type="MIDDLE",
                active_days={str(i): i != 0 for i in range(7)},
            ),
            ShiftTemplate(
                start_time="14:00",
                end_time="20:00",
                requires_break=False,
                shift_type="LATE",
                active_days={str(i): i != 0 for i in range(7)},
            ),
            # Mini-job shifts (4-5 hours)
            ShiftTemplate(
                start_time="09:00",
                end_time="13:00",
                requires_break=False,
                shift_type="EARLY",
                active_days={str(i): i != 0 for i in range(7)},
            ),
            ShiftTemplate(
                start_time="12:00",
                end_time="16:00",
                requires_break=False,
                shift_type="MIDDLE",
                active_days={str(i): i != 0 for i in range(7)},
            ),
            ShiftTemplate(
                start_time="16:00",
                end_time="20:00",
                requires_break=False,
                shift_type="LATE",
                active_days={str(i): i != 0 for i in range(7)},
            ),
        ]

        # Calculate durations and validate before returning
        for template in shift_templates:
            template._calculate_duration()
            template.validate()

        return shift_templates

    def _generate_improved_availability_data(
        self, employees: List[Employee]
    ) -> List[EmployeeAvailability]:
        """Generate optimized availability data ensuring coverage requirements are met."""
        availabilities = []

        # Group employees by type for easier assignment
        employee_groups = {
            "TL": [e for e in employees if e.employee_group == "TL"],
            "VZ": [e for e in employees if e.employee_group == "VZ"],
            "TZ": [e for e in employees if e.employee_group == "TZ"],
            "GFB": [e for e in employees if e.employee_group == "GFB"],
        }

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
        for day in working_days:
            for slot_idx, (start_hour, end_hour) in enumerate([(9, 14), (14, 20)]):
                slot_keyholders = random.sample(keyholders, min(2, len(keyholders)))
                for keyholder in slot_keyholders:
                    for hour in range(start_hour, end_hour):
                        availability = EmployeeAvailability(
                            employee_id=keyholder.id,
                            is_recurring=True,
                            day_of_week=day,
                            hour=hour,
                            is_available=True,
                            availability_type="FIXED",
                        )
                        availabilities.append(availability)

        # Process each employee type
        for employee_type, group_employees in employee_groups.items():
            for employee in group_employees:
                employee_availabilities = []
                target_hours = employee.contracted_hours * (
                    2.5 if employee.contracted_hours <= 20 else 1.5
                )

                # Determine number of working days based on target hours
                if employee.contracted_hours <= 20:
                    min_days = 4  # More days for flexibility
                    max_days = 6
                else:
                    min_days = max(
                        3, int(employee.contracted_hours / 8)
                    )  # At least 3 days
                    max_days = 6

                work_days_count = random.randint(min_days, max_days)
                work_days = random.sample(working_days, work_days_count)

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
                    day_slots = random.sample(time_slots, num_blocks)

                    for start_hour, end_hour in day_slots:
                        for hour in range(start_hour, end_hour):
                            availability = EmployeeAvailability(
                                employee_id=employee.id,
                                is_recurring=True,
                                day_of_week=day,
                                hour=hour,
                                is_available=True,
                                availability_type="AVAILABLE",
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
                                    availability_type="PREFERRED",
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
                            availability_type="PREFERRED",
                        )
                        employee_availabilities.append(availability)

                    weekly_hours = calculate_weekly_hours(employee_availabilities)

                # Add all availabilities for this employee
                availabilities.extend(employee_availabilities)

                # Log availability statistics
                logger.info(
                    f"Employee {employee.employee_id} ({employee.employee_group}): "
                    f"Contracted={employee.contracted_hours:.1f}h/week, "
                    f"Target={target_hours:.1f}h/week, "
                    f"Available={weekly_hours}h/week"
                )

        return availabilities

    def _generate_improved_absences(self, employees: List[Employee]) -> List[Absence]:
        """Generate realistic absences for employees."""
        logger.info("Generating improved absences...")

        absences = []
        today = datetime.now().date()
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

        for employee in employees:
            employee_absences = []
            # Process each absence type
            for absence_type, config in absence_types.items():
                if random.random() < config["prob"]:
                    # Determine number of instances for this absence type
                    num_instances = random.randint(
                        config["min_instances"], config["max_instances"]
                    )

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
                                absence = Absence(
                                    employee_id=employee.id,
                                    absence_type_id=absence_type,
                                    start_date=start_date,
                                    end_date=end_date,
                                    note=f"Generated {absence_type} absence for {employee.first_name} {employee.last_name}",
                                )
                                employee_absences.append(absence)
                                absences.append(absence)
                                logger.info(
                                    f"Created {absence_type} absence for {employee.employee_id} "
                                    f"({employee.first_name} {employee.last_name}) "
                                    f"from {start_date} to {end_date}"
                                )

                            attempts += 1

                        if not valid_date_found:
                            logger.warning(
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

                absence = Absence(
                    employee_id=employee.id,
                    absence_type_id=absence_type,
                    start_date=start_date,
                    end_date=end_date,
                    note=f"Generated fallback {absence_type} absence for {employee.first_name} {employee.last_name}",
                )
                absences.append(absence)
                logger.info(
                    f"Created fallback {absence_type} absence for {employee.employee_id} "
                    f"({employee.first_name} {employee.last_name}) "
                    f"from {start_date} to {end_date}"
                )

        # Log summary statistics
        absence_stats = {}
        for absence in absences:
            if absence.absence_type_id not in absence_stats:
                absence_stats[absence.absence_type_id] = 0
            absence_stats[absence.absence_type_id] += 1

        logger.info("Absence generation summary:")
        for absence_type, count in absence_stats.items():
            logger.info(f"{absence_type}: {count} absences generated")
        logger.info(f"Total absences generated: {len(absences)}")
        logger.info(
            f"Average absences per employee: {len(absences) / len(employees):.1f}"
        )

        return absences

    def generate_demo_data(self) -> Dict[str, Any]:
        """Main method to generate all demo data with proper error handling and transactions."""
        for attempt in range(self.retry_config["max_retries"]):
            try:
                logger.info("Starting demo data generation")

                # Update settings
                self.settings.employee_types = self.generate_employee_types()
                self.settings.absence_types = self.generate_absence_types()
                db.session.commit()

                # Clear existing data
                self._clear_existing_data()

                # Generate new data
                employees = self._generate_employee_data()
                coverage_slots = self._generate_coverage_data()
                shift_templates = self._generate_shift_templates()
                availabilities = self._generate_improved_availability_data(employees)
                absences = self._generate_improved_absences(employees)

                # Save data with proper chunking
                self._save_data_in_chunks(employees)
                self._save_data_in_chunks(coverage_slots)
                self._save_data_in_chunks(shift_templates)
                self._save_data_in_chunks(availabilities)
                self._save_data_in_chunks(absences)

                # Update settings with statistics
                statistics = {
                    "employees": len(employees),
                    "coverage_slots": len(coverage_slots),
                    "shift_templates": len(shift_templates),
                    "availabilities": len(availabilities),
                    "absences": len(absences),
                }
                self.settings.actions_demo_data = {
                    "last_execution": datetime.utcnow().isoformat(),
                    "statistics": statistics,
                }
                db.session.commit()

                logger.info("Demo data generation completed successfully")
                return {
                    "message": "Demo data generation completed",
                    "statistics": statistics,
                }

            except OperationalError as e:
                if (
                    "database is locked" in str(e)
                    and attempt < self.retry_config["max_retries"] - 1
                ):
                    logger.warning(
                        f"Database lock encountered, retrying... (attempt {attempt + 1})"
                    )
                    db.session.rollback()
                    time.sleep(self.retry_config["retry_delay"])
                else:
                    logger.error("Failed to generate demo data due to database lock")
                    raise
            except Exception as e:
                logger.error(f"Failed to generate demo data: {e}")
                db.session.rollback()
                raise

        raise Exception("Failed to generate demo data after maximum retries")
